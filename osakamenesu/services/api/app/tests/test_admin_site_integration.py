"""
## フェーズ1 ― 管理APIと公開APIの対応まとめ

- **管理側 (services/api/app/domains/admin/)**
  - `profiles_router.py` に `/api/admin/shops/**` や `/api/admin/availabilities/**` があり、
    `services/profile_service.py` 経由で Profile / Availability / Menu / Diary などを管理画面から登録・更新する。
  - Availability 生成は `profile_service.create_single_availability` / `create_availability_bulk` /
    `upsert_availability` が担い、`site_bridge` を通じて公開側と同じ正規化ヘルパーを共有している。

- **公開側 (services/api/app/domains/site/)**
  - `shops.py` の `/api/v1/shops` (検索)・`/{shop_id}` (ShopDetail)・`/{shop_id}/availability` がエンドポイント本体。
  - ShopDetail は `services/shop_services.py` が Profile/Diary/Review/Availability を束ね、
    可用性取得と next slot 計算は `services/shop/availability.py` の
    `fetch_availability` / `get_next_available_slot` を再利用。
  - 検索 (`services/shop/search_service.py`) は Meili のヒットを `ShopSummary` に整形し、
    `get_next_available_slots` で next slot を一覧カードにも付与している。

- **既存テスト基盤**
  - `services/api/app/tests/test_site_shops.py` が `_get_shop_detail_impl` 等をモックしつつ FastAPI ルーターをテスト。
  - `test_admin_profiles_api.py` は管理ルーターを `TestClient` + dependency override で検証しており、
    DB 代替として FakeSession を注入するパターンが確立されている。
  - `test_profiles.py` ほかでは SQLAlchemy `Result` を模したスタブが使われており、
    これらを参考に API ↔ サービス層を結ぶ一貫性テストを書ける。

TODO: 管理APIを実際に叩いて name や availability を更新 → 公開APIに反映する E2E までは
      ここでは網羅していない（実DBセットアップが未確定）。仕様が固まったら追補する。
"""

import os
import sys
import uuid
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI
from fastapi.testclient import TestClient

_HELPER_DIR = Path(__file__).resolve().parent
if str(_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_HELPER_DIR))

from _path_setup import configure_paths

ROOT = configure_paths(Path(__file__))

for key in [
    "PROJECT_NAME",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "POSTGRES_HOST",
    "POSTGRES_PORT",
    "API_PORT",
    "API_HOST",
    "NEXT_PUBLIC_API_BASE",
    "API_INTERNAL_BASE",
    "ADMIN_BASIC_USER",
    "ADMIN_BASIC_PASS",
    "JSONL_PATH",
    "OPENAI_API_KEY",
    "X_COOKIE_PATH",
    "PROVIDERS",
    "MAX_TOKENS",
]:
    os.environ.pop(key, None)

import types

dummy_settings_module = types.ModuleType("app.settings")


class _DummySettings:
    def __init__(self) -> None:
        self.database_url = "postgresql+asyncpg://app:app@localhost:5432/osaka_menesu"
        self.api_origin = "http://localhost:3000"
        self.api_public_base_url = "http://localhost:8000"
        self.meili_host = "http://127.0.0.1:7700"
        self.meili_master_key = "dev_key"
        self.admin_api_key = "dev_admin_key"
        self.rate_limit_redis_url = None
        self.rate_limit_namespace = "test"
        self.rate_limit_redis_error_cooldown = 0.0
        self.init_db_on_startup = False
        self.slack_webhook_url = None
        self.notify_email_endpoint = None
        self.notify_line_endpoint = None
        self.notify_from_email = None
        self.mail_api_key = "test-mail-key"
        self.mail_from_address = "no-reply@example.com"
        self.mail_provider_base_url = "https://api.resend.com"
        self.dashboard_session_cookie_name = "osakamenesu_session"
        self.site_session_cookie_name = "osakamenesu_session"
        self.escalation_pending_threshold_minutes = 30
        self.escalation_check_interval_minutes = 5
        self.site_base_url = None
        self.reservation_notification_max_attempts = 3
        self.reservation_notification_retry_base_seconds = 1
        self.reservation_notification_retry_backoff_multiplier = 2.0
        self.reservation_notification_worker_interval_seconds = 1.0
        self.reservation_notification_batch_size = 10


dummy_settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
dummy_settings_module.settings = _DummySettings()
sys.modules.setdefault("app.settings", dummy_settings_module)

from app import models  # type: ignore  # noqa: E402
from app.db import get_session  # type: ignore  # noqa: E402
from app.schemas import (  # type: ignore  # noqa: E402
    AvailabilityCalendar,
    AvailabilityDay,
    AvailabilitySlot,
    NextAvailableSlot,
)
from app.domains.site import shops as site_shops  # type: ignore  # noqa: E402
from app.domains.site.services import shop_services  # type: ignore  # noqa: E402
from app.domains.site.services.shop import search_service as search_module  # type: ignore  # noqa: E402
from app.utils.datetime import JST, now_jst


class _SessionStub:
    def __init__(self, profile: models.Profile) -> None:
        self._profile = profile

    async def get(self, model, ident):  # type: ignore[override]
        if model is models.Profile and ident == self._profile.id:
            return self._profile
        return None


def _build_profile_fixture() -> models.Profile:
    now = now_jst()
    profile = models.Profile(
        id=uuid.uuid4(),
        slug="relax-admin",
        name="管理サロン",
        area="梅田",
        price_min=9000,
        price_max=18000,
        bust_tag="C",
        service_type="store",
        nearest_station="梅田駅",
        station_line="御堂筋線",
        station_exit="北口",
        station_walk_minutes=5,
        latitude=34.702485,
        longitude=135.495951,
        status="published",
        created_at=now,
        updated_at=now,
    )
    profile.body_tags = ["relax", "oil"]
    profile.discounts = [
        {"label": "Weekday", "description": "平日1,000円OFF"},
    ]
    profile.photos = [
        "https://images.example.com/sh1.jpg",
        "https://images.example.com/sh2.jpg",
    ]
    profile.contact_json = {
        "phone": "0120-123-456",
        "line_id": "line-admin",
        "website_url": "https://salon.example.com",
        "reservation_form_url": "https://salon.example.com/reserve",
        "sns": [
            {
                "platform": "instagram",
                "url": "https://instagram.com/admin-shop",
                "label": "IG",
            }
        ],
        "store_name": "管理Salon",
        "area_name": "大阪",
        "address": "大阪市北区1-2-3",
        "catch_copy": "極上の癒し",
        "online_reservation": True,
    }

    diary = models.Diary(
        id=uuid.uuid4(),
        profile_id=profile.id,
        external_id=None,
        title="セラピスト日記",
        text="人気メニューのご紹介",
        photos=["https://images.example.com/diary.jpg"],
        hashtags=["#癒し"],
        status="published",
        created_at=now - timedelta(days=1),
    )
    profile.diaries = [diary]

    therapist = models.Therapist(
        id=uuid.uuid4(),
        profile_id=profile.id,
        name="Yuna",
        alias="ゆな",
        headline="人気No.1",
        biography="セラピスト歴5年",
        specialties=["アロマ"],
        photo_urls=["https://images.example.com/staff.jpg"],
        display_order=0,
        status="published",
        is_booking_enabled=True,
        created_at=now,
        updated_at=now,
    )
    profile.therapists = [therapist]

    review = models.Review(
        id=uuid.uuid4(),
        profile_id=profile.id,
        status="published",
        external_id=None,
        score=5,
        title="最高",
        body="とても良かったです",
        author_alias="user1",
        visited_at=date.today(),
        created_at=now,
        updated_at=now,
        aspect_scores={"therapist_service": {"score": 5, "note": "good"}},
    )
    profile.reviews = [review]
    return profile


def _build_availability(
    profile_id: uuid.UUID,
) -> tuple[AvailabilityCalendar, NextAvailableSlot, AvailabilitySlot]:
    slot_date = date.today()
    slot_start = datetime.combine(slot_date, time(hour=6, minute=0, tzinfo=JST))
    slot_end = slot_start + timedelta(hours=1)
    staff_id = uuid.uuid4()
    menu_id = uuid.uuid4()
    slot = AvailabilitySlot(
        start_at=slot_start,
        end_at=slot_end,
        status="open",
        staff_id=staff_id,
        menu_id=menu_id,
    )
    calendar = AvailabilityCalendar(
        shop_id=profile_id,
        generated_at=now_jst(),
        days=[
            AvailabilityDay(
                date=slot_date,
                is_today=True,
                slots=[slot],
            )
        ],
    )
    next_slot = NextAvailableSlot(start_at=slot_start, status="ok")
    return calendar, next_slot, slot


def _build_app(
    monkeypatch,
    *,
    profile: models.Profile,
    calendar: AvailabilityCalendar,
    next_slot: NextAvailableSlot,
    search_hits: Dict[str, Any] | None = None,
) -> FastAPI:
    app = FastAPI()
    app.include_router(site_shops.router)

    session = _SessionStub(profile)

    async def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session

    async def fake_load(db, identifier):
        assert identifier in {profile.id, str(profile.id), profile.slug}
        return profile

    async def fake_fetch_availability(db, shop_id, start_date=None, end_date=None):
        assert shop_id == profile.id
        return calendar

    async def fake_next_slot(db, shop_id, lookahead_days=14):
        assert shop_id == profile.id
        return next_slot

    async def fake_derive_next_availability_from_slots_sot(
        db, therapist_ids, *, lookahead_days: int = 14
    ):
        # Search cards derive next slot from staff availability SoT. For tests, return the
        # same next_slot for any staff_id passed from staff_preview.
        mapping: dict[uuid.UUID, tuple[bool, NextAvailableSlot]] = {}
        for therapist_id in therapist_ids:
            try:
                normalized = (
                    therapist_id
                    if isinstance(therapist_id, uuid.UUID)
                    else uuid.UUID(str(therapist_id))
                )
            except Exception:
                continue
            mapping[normalized] = (True, next_slot)
        return mapping

    def fake_meili_search(
        q: str | None,
        filter_expr: str | None,
        sort: list[str] | str | None,
        page: int,
        page_size: int,
        facets: list[str] | None = None,
    ) -> dict:
        return search_hits or {
            "hits": [],
            "estimatedTotalHits": 0,
            "facetDistribution": {},
        }

    monkeypatch.setattr(shop_services, "_load_profile", fake_load)
    monkeypatch.setattr(shop_services, "_fetch_availability", fake_fetch_availability)
    monkeypatch.setattr(shop_services, "_get_next_available_slot", fake_next_slot)
    monkeypatch.setattr(
        search_module,
        "_derive_next_availability_from_slots_sot",
        fake_derive_next_availability_from_slots_sot,
    )
    monkeypatch.setattr(search_module, "meili_search", fake_meili_search)

    return app


def _extract_slot_from_calendar(calendar_payload: Dict[str, Any]) -> Dict[str, Any]:
    assert calendar_payload["days"], "calendar should contain at least one day"
    first_day = calendar_payload["days"][0]
    assert first_day["slots"], "day should contain slots"
    return first_day["slots"][0]


def _build_search_hits(
    profile: models.Profile, *, staff_id: uuid.UUID
) -> Dict[str, Any]:
    return {
        "hits": [
            {
                "id": str(profile.id),
                "slug": profile.slug,
                "name": profile.name,
                "area": profile.area,
                "area_name": profile.contact_json.get("area_name"),
                "address": profile.contact_json.get("address"),
                "categories": [],
                "body_tags": profile.body_tags,
                "price_min": profile.price_min,
                "price_max": profile.price_max,
                "nearest_station": profile.nearest_station,
                "station_line": profile.station_line,
                "station_exit": profile.station_exit,
                "station_walk_minutes": profile.station_walk_minutes,
                "latitude": profile.latitude,
                "longitude": profile.longitude,
                "review_score": 4.8,
                "review_count": 12,
                "photos": profile.photos,
                "ranking_badges": ["注目"],
                "promotions": profile.discounts,
                "has_promotions": True,
                "has_discounts": True,
                "today": True,
                "staff_preview": [
                    {
                        "id": str(staff_id),
                        "name": profile.therapists[0].name
                        if profile.therapists
                        else "staff",
                    }
                ],
                "updated_at": now_jst().timestamp(),
            }
        ],
        "estimatedTotalHits": 1,
        "facetDistribution": {},
    }


def test_shop_detail_matches_admin_profile(monkeypatch):
    profile = _build_profile_fixture()
    calendar, next_slot, _slot = _build_availability(profile.id)
    app = _build_app(
        monkeypatch, profile=profile, calendar=calendar, next_slot=next_slot
    )

    with TestClient(app) as client:
        response = client.get(f"/api/v1/shops/{profile.id}")

    assert response.status_code == 200, response.json()
    data = response.json()
    assert data["name"] == profile.name
    assert data["area"] == profile.area
    assert data["min_price"] == profile.price_min
    assert data["max_price"] == profile.price_max
    assert data["location"]["latitude"] == profile.latitude
    assert data["location"]["nearest_station"] == profile.nearest_station
    assert data["promotions"][0]["label"] == profile.discounts[0]["label"]
    assert data["contact"]["phone"] == profile.contact_json["phone"]
    assert data["photos"][0]["url"] == profile.photos[0]
    assert data["diaries"][0]["title"] == profile.diaries[0].title
    assert data["reviews"]["review_count"] == 1
    assert data["next_available_slot"]["start_at"].startswith(
        str(next_slot.start_at.date())
    )


def test_availability_endpoint_matches_detail_calendar(monkeypatch):
    profile = _build_profile_fixture()
    calendar, next_slot, raw_slot = _build_availability(profile.id)
    app = _build_app(
        monkeypatch, profile=profile, calendar=calendar, next_slot=next_slot
    )

    with TestClient(app) as client:
        detail_resp = client.get(f"/api/v1/shops/{profile.id}")
        availability_resp = client.get(f"/api/v1/shops/{profile.id}/availability")

    assert detail_resp.status_code == 200
    assert availability_resp.status_code == 200

    detail = detail_resp.json()
    availability = availability_resp.json()

    detail_calendar = detail["availability_calendar"]
    assert detail_calendar is not None
    detail_slot = _extract_slot_from_calendar(detail_calendar)
    availability_slot = _extract_slot_from_calendar(availability)

    assert detail_slot == availability_slot
    assert detail["next_available_slot"]["start_at"] == detail_slot["start_at"]
    assert detail["today_available"] is True
    assert availability_slot["staff_id"] == str(raw_slot.staff_id)
    assert availability_slot["menu_id"] == str(raw_slot.menu_id)


def test_search_list_and_detail_share_next_slot(monkeypatch):
    profile = _build_profile_fixture()
    calendar, next_slot, raw_slot = _build_availability(profile.id)
    hits = _build_search_hits(profile, staff_id=raw_slot.staff_id)
    app = _build_app(
        monkeypatch,
        profile=profile,
        calendar=calendar,
        next_slot=next_slot,
        search_hits=hits,
    )

    with TestClient(app) as client:
        detail_resp = client.get(f"/api/v1/shops/{profile.id}")
        search_resp = client.get("/api/v1/shops")

    assert detail_resp.status_code == 200
    assert search_resp.status_code == 200

    detail_slot = detail_resp.json()["next_available_slot"]
    results = search_resp.json()
    assert results["results"], "search results must not be empty"
    card_slot = results["results"][0]["next_available_slot"]

    assert card_slot is not None
    assert detail_slot is not None

    def _as_iso(value: str) -> str:
        return value.replace("Z", "+00:00")

    assert datetime.fromisoformat(
        _as_iso(card_slot["start_at"])
    ) == datetime.fromisoformat(_as_iso(detail_slot["start_at"]))
