import os
import sys
import types
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest

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

from types import SimpleNamespace

from fastapi import HTTPException

from app import models  # type: ignore  # noqa: E402
from app.schemas import (  # type: ignore  # noqa: E402
    AvailabilityCalendar,
    AvailabilityDay,
    AvailabilitySlot,
    NextAvailableSlot,
    ShopDetail,
)
from app.domains.site import shops as site_shops  # type: ignore  # noqa: E402
from app.domains.site.services import shop_services  # type: ignore  # noqa: E402
from app.domains.site.services.shop import search_service as search_module  # type: ignore  # noqa: E402
from app.domains.site.services.shop_services import (  # type: ignore  # noqa: E402
    ShopNotFoundError,
    AvailabilityNotFoundError,
)
from app.utils.datetime import now_jst


class _StubSession:
    def __init__(self, profile: models.Profile | None = None) -> None:
        self.profile = profile

    async def get(self, model, pk):  # type: ignore[override]
        if self.profile and model is models.Profile and pk == self.profile.id:
            return self.profile
        return None


def _example_profile() -> models.Profile:
    now = now_jst()
    profile = models.Profile(
        id=uuid.uuid4(),
        slug="shop-a",
        name="Shop A",
        area="Umeda",
        price_min=8000,
        price_max=12000,
        bust_tag="C",
        service_type="store",
        nearest_station="Umeda",
        status="published",
        created_at=now,
        updated_at=now,
    )
    profile.photos = ["https://example.com/photo.jpg"]
    profile.contact_json = {
        "phone": "0120-111-222",
        "sns": [{"platform": "instagram", "url": "https://instagram.com/shop"}],
        "store_name": "Shop A",
    }
    profile.body_tags = ["relax"]
    profile.discounts = [{"label": "Summer", "description": "10% off"}]
    profile.ranking_badges = ["Top"]

    diary = models.Diary(
        id=uuid.uuid4(),
        profile_id=profile.id,
        external_id=None,
        title="Diary title",
        text="Diary body",
        photos=["https://example.com/diary.jpg"],
        hashtags=["#relax"],
        status="published",
        created_at=now,
    )
    profile.diaries = [diary]

    therapist = models.Therapist(
        id=uuid.uuid4(),
        profile_id=profile.id,
        name="Therapist A",
        alias="Aさん",
        headline="人気セラピスト",
        biography="Bio",
        specialties=["oil"],
        qualifications=None,
        experience_years=3,
        photo_urls=["https://example.com/therapist.jpg"],
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
        title="Great",
        body="Excellent experience",
        author_alias="user",
        visited_at=date.today(),
        created_at=now,
        updated_at=now,
        aspect_scores={"therapist_service": {"score": 5}},
    )
    profile.reviews = [review]
    return profile


@pytest.mark.asyncio
async def test_get_shop_detail_impl_maps_profile(monkeypatch):
    profile = _example_profile()
    today = date.today()

    async def fake_load(db, identifier):
        return profile

    calendar = AvailabilityCalendar(
        shop_id=profile.id,
        generated_at=now_jst(),
        days=[
            AvailabilityDay(
                date=today,
                is_today=True,
                slots=[
                    AvailabilitySlot(
                        start_at=now_jst(),
                        end_at=now_jst() + timedelta(hours=1),
                        status="open",
                    )
                ],
            )
        ],
    )

    async def fake_fetch_availability(db, shop_id, start_date=None, end_date=None):
        assert shop_id == profile.id
        return calendar

    next_slot = NextAvailableSlot(
        start_at=now_jst() + timedelta(hours=2),
        status="ok",
    )

    async def fake_get_next_slot(db, shop_id, lookahead_days=14):
        assert shop_id == profile.id
        return next_slot

    monkeypatch.setattr(shop_services, "_load_profile", fake_load)
    monkeypatch.setattr(shop_services, "_fetch_availability", fake_fetch_availability)
    monkeypatch.setattr(shop_services, "_get_next_available_slot", fake_get_next_slot)

    detail = await shop_services._get_shop_detail_impl(
        SimpleNamespace(), profile.id, today=today
    )

    assert detail.id == profile.id
    assert detail.promotions
    assert detail.availability_calendar is calendar
    assert detail.today_available is True
    assert detail.next_available_slot == next_slot
    assert detail.diaries


@pytest.mark.asyncio
async def test_get_shop_detail_impl_missing_shop(monkeypatch):
    async def fake_load(db, identifier):
        return None

    monkeypatch.setattr(shop_services, "_load_profile", fake_load)

    with pytest.raises(ShopNotFoundError):
        await shop_services._get_shop_detail_impl(SimpleNamespace(), uuid.uuid4())


@pytest.mark.asyncio
async def test_get_shop_availability_impl_returns_calendar(monkeypatch):
    profile = _example_profile()
    session = _StubSession(profile)
    captured: dict[str, date] = {}

    async def fake_fetch(db, shop_id, start_date=None, end_date=None):
        captured["start"] = start_date
        captured["end"] = end_date
        return AvailabilityCalendar(
            shop_id=shop_id,
            generated_at=now_jst(),
            days=[
                AvailabilityDay(
                    date=start_date,
                    is_today=True,
                    slots=[
                        AvailabilitySlot(
                            start_at=now_jst(),
                            end_at=now_jst() + timedelta(hours=1),
                            status="open",
                        )
                    ],
                )
            ],
        )

    monkeypatch.setattr(shop_services, "_fetch_availability", fake_fetch)

    start = date(2024, 1, 1)
    end = date(2024, 1, 3)
    calendar = await shop_services._get_shop_availability_impl(
        session, profile.id, date_from=start, date_to=end
    )

    assert calendar.shop_id == profile.id
    assert captured["start"] == start
    assert captured["end"] == end


@pytest.mark.asyncio
async def test_get_shop_availability_impl_missing_shop(monkeypatch):
    session = _StubSession(None)
    with pytest.raises(ShopNotFoundError):
        await shop_services._get_shop_availability_impl(session, uuid.uuid4())


@pytest.mark.asyncio
async def test_get_shop_availability_impl_no_slots(monkeypatch):
    profile = _example_profile()
    session = _StubSession(profile)

    async def fake_fetch(db, shop_id, start_date=None, end_date=None):
        return None

    monkeypatch.setattr(shop_services, "_fetch_availability", fake_fetch)

    with pytest.raises(AvailabilityNotFoundError):
        await shop_services._get_shop_availability_impl(session, profile.id)


@pytest.mark.asyncio
async def test_search_and_detail_share_next_slot(monkeypatch):
    profile = _example_profile()
    slot = NextAvailableSlot(
        start_at=now_jst() + timedelta(hours=4),
        status="ok",
    )

    async def fake_load(db, identifier):
        return profile

    async def fake_fetch_availability(db, shop_id, start_date=None, end_date=None):
        return AvailabilityCalendar(
            shop_id=shop_id,
            generated_at=now_jst(),
            days=[],
        )

    async def fake_get_slot(db, shop_id, lookahead_days=14):
        assert shop_id == profile.id
        return slot

    async def fake_get_slots(db, shop_ids, lookahead_days=14):
        return ({sid: slot for sid in shop_ids}, {})

    async def fake_meili_search(index, params):
        return {
            "hits": [
                {
                    "id": str(profile.id),
                    "name": profile.name,
                    "area": profile.area,
                    "price_min": profile.price_min,
                    "price_max": profile.price_max,
                    "ranking_badges": [],
                    "photos": [],
                }
            ],
            "estimatedTotalHits": 1,
            "facetDistribution": {},
        }

    monkeypatch.setattr(shop_services, "_load_profile", fake_load)
    monkeypatch.setattr(shop_services, "_fetch_availability", fake_fetch_availability)
    monkeypatch.setattr(shop_services, "_get_next_available_slot", fake_get_slot)
    monkeypatch.setattr(search_module, "get_next_available_slots", fake_get_slots)
    monkeypatch.setattr(search_module, "meili_search", fake_meili_search)

    detail = await shop_services._get_shop_detail_impl(SimpleNamespace(), profile.id)
    search_response = await search_module._search_shops_impl(
        SimpleNamespace(), page=1, page_size=1
    )
    result_slot = search_response["results"][0]["next_available_slot"]

    assert detail.next_available_slot is not None
    assert (
        result_slot["start_at"].isoformat()
        == detail.next_available_slot.start_at.isoformat()
    )


@pytest.mark.asyncio
async def test_router_get_shop_detail_returns_value(monkeypatch):
    detail = ShopDetail(
        id=uuid.uuid4(),
        slug="shop",
        name="Shop",
        store_name="Shop",
        area="Umeda",
        area_name=None,
        address=None,
        categories=[],
        service_tags=[],
        min_price=8000,
        max_price=12000,
        nearest_station=None,
        station_line=None,
        station_exit=None,
        station_walk_minutes=None,
        latitude=None,
        longitude=None,
        rating=None,
        review_count=None,
        lead_image_url=None,
        badges=[],
        today_available=False,
        next_available_at=None,
        next_available_slot=None,
        distance_km=None,
        online_reservation=None,
        updated_at=now_jst(),
        ranking_reason=None,
        promotions=[],
        price_band=None,
        price_band_label=None,
        has_promotions=False,
        has_discounts=False,
        promotion_count=0,
        ranking_score=None,
        staff_preview=[],
        description=None,
        catch_copy=None,
        photos=[],
        contact=None,
        location=None,
        menus=[],
        staff=[],
        availability_calendar=None,
        reviews=None,
        metadata={},
        diaries=[],
    )

    class StubAssembler:
        def __init__(self, db):
            self.db = db

        async def get_detail(self, shop_id):
            return detail

    monkeypatch.setattr(site_shops, "ShopDetailAssembler", StubAssembler)

    response = await site_shops.get_shop_detail(str(detail.id), db=SimpleNamespace())
    assert response is detail


@pytest.mark.asyncio
async def test_router_get_shop_detail_not_found(monkeypatch):
    class StubAssembler:
        def __init__(self, db):
            self.db = db

        async def get_detail(self, shop_id):
            raise ShopNotFoundError("missing")

    monkeypatch.setattr(site_shops, "ShopDetailAssembler", StubAssembler)

    with pytest.raises(HTTPException) as exc:
        await site_shops.get_shop_detail("missing", db=SimpleNamespace())
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_router_get_shop_availability_returns_calendar(monkeypatch):
    shop_id = uuid.uuid4()
    calendar = AvailabilityCalendar(
        shop_id=shop_id,
        generated_at=now_jst(),
        days=[],
    )

    class StubAvailabilityService:
        def __init__(self, db):
            self.db = db

        async def get_availability(self, shop_id, *, date_from=None, date_to=None):
            return calendar

    monkeypatch.setattr(site_shops, "ShopAvailabilityService", StubAvailabilityService)

    response = await site_shops.get_shop_availability(shop_id, db=SimpleNamespace())
    assert response is calendar


@pytest.mark.asyncio
async def test_router_get_shop_availability_not_found(monkeypatch):
    class StubAvailabilityService:
        def __init__(self, db):
            self.db = db

        async def get_availability(self, shop_id, *, date_from=None, date_to=None):
            raise AvailabilityNotFoundError("none")

    monkeypatch.setattr(site_shops, "ShopAvailabilityService", StubAvailabilityService)

    with pytest.raises(HTTPException) as exc:
        await site_shops.get_shop_availability(uuid.uuid4(), db=SimpleNamespace())
    assert exc.value.status_code == 404
