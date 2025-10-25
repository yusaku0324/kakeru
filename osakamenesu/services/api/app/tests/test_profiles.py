import asyncio
import os
import sys
import uuid
from datetime import date, datetime, UTC
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest


# Ensure app package is importable when tests are executed from repo root
ROOT = Path(__file__).resolve().parents[4]
os.chdir(ROOT)
sys.path.insert(0, str(ROOT / "services" / "api"))

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
        self.database_url = os.environ.get(
            "DATABASE_URL",
            "postgresql+asyncpg://app:app@localhost:5432/osaka_menesu",
        )
        self.api_origin = os.environ.get("API_ORIGIN", "http://localhost:3000")
        self.api_public_base_url = os.environ.get("OSAKAMENESU_API_BASE", "http://localhost:8000")
        self.api_public_base_url = os.environ.get("OSAKAMENESU_API_BASE", "http://localhost:8000")
        self.meili_host = os.environ.get("MEILI_HOST", "http://127.0.0.1:7700")
        self.meili_master_key = os.environ.get("MEILI_MASTER_KEY", "dev_key")
        self.admin_api_key = os.environ.get("ADMIN_API_KEY", "dev_admin_key")
        self.rate_limit_redis_url = os.environ.get("RATE_LIMIT_REDIS_URL")
        self.rate_limit_namespace = os.environ.get("RATE_LIMIT_NAMESPACE", "test")
        self.rate_limit_redis_error_cooldown = float(os.environ.get("RATE_LIMIT_REDIS_ERROR_COOLDOWN", "0"))
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


dummy_settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
dummy_settings_module.settings = _DummySettings()
sys.modules.setdefault("app.settings", dummy_settings_module)

from app import models  # type: ignore  # noqa: E402
from app.routers import admin as admin_router  # type: ignore  # noqa: E402
from app.utils.profiles import build_profile_doc, compute_review_summary, normalize_review_aspects  # type: ignore  # noqa: E402
from app.routers.shops import _prepare_aspect_scores, _collect_review_aspect_stats, serialize_review  # type: ignore  # noqa: E402


class FakeScalarResult:
    def __init__(self, data: List[Any]):
        self._data = data

    def all(self) -> List[Any]:
        return self._data


class FakeResult:
    def __init__(
        self,
        *,
        scalars: Optional[List[Any]] = None,
        scalar_one: Optional[Any] = None,
        scalar_one_or_none: Optional[Any] = None,
    ) -> None:
        self._scalars = scalars or []
        self._scalar_one = scalar_one
        self._scalar_one_or_none = scalar_one_or_none

    def scalars(self) -> FakeScalarResult:
        return FakeScalarResult(self._scalars)

    def scalar_one(self) -> Any:
        return self._scalar_one

    def scalar_one_or_none(self) -> Any:
        return self._scalar_one_or_none


def _extract_profile_id(query) -> uuid.UUID:
    for criterion in getattr(query, "_where_criteria", []):
        left = getattr(criterion, "left", None)
        if getattr(left, "name", None) == "profile_id":
            raw = getattr(criterion.right, "value", None)
            return uuid.UUID(str(raw))
    raise AssertionError("profile_id not found in query criteria")


class FakeSession:
    def __init__(
        self,
        profiles: List[models.Profile],
        availability: Dict[uuid.UUID, bool],
        outlinks: Dict[uuid.UUID, List[models.Outlink]],
    ) -> None:
        self._profiles = profiles
        self._availability = availability
        self._outlinks = outlinks

    async def execute(self, query):  # type: ignore[override]
        desc = query.column_descriptions[0]
        entity = desc.get("entity")
        if entity is models.Profile:
            return FakeResult(scalars=self._profiles)
        if entity is models.Outlink:
            pid = _extract_profile_id(query)
            return FakeResult(scalars=self._outlinks.get(pid, []))
        if desc.get("name") == "count" and entity is None:
            pid = _extract_profile_id(query)
            count = 1 if self._availability.get(pid, False) else 0
            return FakeResult(scalar_one=count)
        raise AssertionError(f"Unhandled query: {query}")

    async def refresh(self, instance: Any, attribute_names: Optional[List[str]] = None) -> None:
        # The real session only ensures relationships like reviews are loaded; here the profiles
        # already carry eager data so the method becomes a no-op for compatibility.
        if attribute_names and "reviews" in attribute_names and not hasattr(instance, "reviews"):
            instance.reviews = []


def _make_profile(**overrides: Any) -> models.Profile:
    now = datetime.now(UTC)
    defaults: Dict[str, Any] = {
        "id": uuid.uuid4(),
        "name": "テスト店",
        "area": "難波/日本橋",
        "price_min": 12000,
        "price_max": 18000,
        "bust_tag": "C",
        "service_type": "store",
        "height_cm": 160,
        "age": 24,
        "body_tags": ["癒し", "清楚"],
        "photos": ["https://example.com/1.jpg"],
        "contact_json": {
            "store_name": "癒しサロン",
            "ranking_reason": "編集部ピックアップ",
            "promotions": [
                {
                    "label": "朝割",
                    "description": "11時まで1,000円OFF",
                }
            ],
            "reviews": {
                "average_score": 4.6,
                "review_count": 12,
                "highlighted": [
                    {
                        "title": "極上の癒し",
                        "body": "接客も技術も素晴らしいです",
                        "score": 5,
                        "visited_at": date.today().isoformat(),
                        "author_alias": "匿名ユーザー",
                        "aspects": {
                            "therapist_service": {"score": 5},
                            "staff_response": {"score": 4},
                        },
                    }
                ],
            },
        },
        "discounts": [
            {
                "label": "WEB割",
                "description": "ネット予約で500円OFF",
            }
        ],
        "ranking_badges": ["人気No.1"],
        "ranking_weight": 80,
        "status": "published",
        "created_at": now,
        "updated_at": now,
    }
    defaults.update(overrides)
    profile = models.Profile(**defaults)
    review = models.Review(
        id=uuid.uuid4(),
        profile_id=profile.id,
        status='published',
        score=5,
        title="極上の癒し",
        body="接客も技術も素晴らしいです",
        author_alias="匿名ユーザー",
        visited_at=date.today(),
        created_at=now,
        updated_at=now,
        aspect_scores={
            "therapist_service": {"score": 5, "note": "丁寧"},
            "staff_response": {"score": 4},
        },
    )
    profile.reviews = [review]
    return profile


def test_build_profile_doc_promotions_and_reviews() -> None:
    profile = _make_profile()
    outlink = models.Outlink(
        id=uuid.uuid4(),
        profile_id=profile.id,
        kind="web",
        token="web-token",
        target_url="https://example.com",
        utm=None,
    )

    doc = build_profile_doc(profile, today=True, outlinks=[outlink])

    assert doc["store_name"] == "癒しサロン"
    assert doc["today"] is True
    # Promotions should merge discounts and contact promotions without dropping data
    labels = {promo["label"] for promo in doc["promotions"]}
    assert "WEB割" in labels
    assert "朝割" in labels
    assert doc["review_score"] == pytest.approx(5.0)
    assert doc["review_count"] == 1
    assert doc["review_aspect_averages"]["therapist_service"] == pytest.approx(5.0)
    assert doc["review_aspect_counts"]["therapist_service"] == 1
    assert doc["ranking_reason"] == "編集部ピックアップ"

def test_compute_review_summary_returns_aspects() -> None:
    profile = _make_profile()
    average, count, highlights, aspect_averages, aspect_counts = compute_review_summary(
        profile,
        include_aspects=True,
    )

    assert average == pytest.approx(5.0)
    assert count == 1
    assert aspect_averages["therapist_service"] == pytest.approx(5.0)
    assert aspect_counts["therapist_service"] == 1
    assert highlights[0]["aspects"]["therapist_service"]["score"] == 5


def test_prepare_aspect_scores_normalizes_input() -> None:
    raw = {
        "therapist_service": {"score": "5", "note": " 丁寧 "},
        "staff_response": {"score": 4, "note": ""},
        "invalid": {"score": 3},
    }

    cleaned = _prepare_aspect_scores(raw)

    assert cleaned == {
        "therapist_service": {"score": 5, "note": "丁寧"},
        "staff_response": {"score": 4},
    }


def test_serialize_review_includes_aspects() -> None:
    profile = _make_profile()
    item = serialize_review(profile.reviews[0])

    assert item.aspects["therapist_service"].score == 5
    assert item.aspects["therapist_service"].note == "丁寧"
    assert item.aspects["staff_response"].score == 4


def test_collect_review_aspect_stats_handles_models() -> None:
    profile = _make_profile()
    item = serialize_review(profile.reviews[0])
    averages, counts = _collect_review_aspect_stats([item])

    assert averages["therapist_service"] == pytest.approx(5.0)
    assert counts["therapist_service"] == 1


def test_compute_review_summary_returns_aspects() -> None:
    profile = _make_profile()
    average, count, highlights, aspect_averages, aspect_counts = compute_review_summary(
        profile,
        include_aspects=True,
    )

    assert average == pytest.approx(5.0)
    assert count == 1
    assert aspect_averages["therapist_service"] == pytest.approx(5.0)
    assert aspect_counts["therapist_service"] == 1
    assert highlights[0]["aspects"]["therapist_service"]["score"] == 5


def test_prepare_aspect_scores_normalizes_input() -> None:
    raw = {
        "therapist_service": {"score": "5", "note": " 丁寧 "},
        "staff_response": {"score": 4, "note": ""},
        "invalid": {"score": 3},
    }

    cleaned = _prepare_aspect_scores(raw)

    assert cleaned == {
        "therapist_service": {"score": 5, "note": "丁寧"},
        "staff_response": {"score": 4},
    }


def test_serialize_review_includes_aspects() -> None:
    profile = _make_profile()
    item = serialize_review(profile.reviews[0])

    assert item.aspects["therapist_service"].score == 5
    assert item.aspects["therapist_service"].note == "丁寧"
    assert item.aspects["staff_response"].score == 4




@pytest.mark.anyio
async def test_admin_reindex_uses_build_profile_doc(monkeypatch: pytest.MonkeyPatch) -> None:
    profile_a = _make_profile(name="凛", area="梅田")
    profile_b = _make_profile(name="葵", area="天王寺")

    availability_map = {
        profile_a.id: True,
        profile_b.id: False,
    }
    outlinks_map = {
        profile_a.id: [
            models.Outlink(
                id=uuid.uuid4(),
                profile_id=profile_a.id,
                kind="web",
                token="web-a",
                target_url="https://salon-a.example",
                utm=None,
            )
        ],
        profile_b.id: [],
    }

    fake_session = FakeSession([profile_a, profile_b], availability_map, outlinks_map)

    purge_called: List[str] = []
    captured_docs: List[List[dict]] = []

    monkeypatch.setattr(admin_router, "purge_all", lambda: purge_called.append("ok"))

    def fake_index_bulk(docs: List[dict]) -> None:
        captured_docs.append(docs)

    monkeypatch.setattr(admin_router, "index_bulk", fake_index_bulk)

    payload = await admin_router.reindex_all(purge=False, db=fake_session)  # type: ignore[arg-type]
    assert payload["indexed"] == 2
    assert not purge_called  # purge is only invoked when purge=True
    assert captured_docs, "index_bulk should be invoked"

    docs = captured_docs[0]
    doc_by_id = {doc["id"]: doc for doc in docs}
    assert str(profile_a.id) in doc_by_id
    assert str(profile_b.id) in doc_by_id

    doc_a = doc_by_id[str(profile_a.id)]
    assert doc_a["today"] is True
    assert doc_a["promotions"], "promotions should be preserved"
    assert doc_a["ranking_reason"] == "編集部ピックアップ"
    assert doc_a["review_aspect_averages"]["therapist_service"] == pytest.approx(5.0)
    assert doc_a["review_aspect_counts"]["therapist_service"] == 1

    doc_b = doc_by_id[str(profile_b.id)]
    assert doc_b["today"] is False
    # Reviews data should still be populated from contact JSON
    assert doc_b["review_score"] is not None
    assert doc_b["review_aspect_averages"]["therapist_service"] == pytest.approx(5.0)
    assert doc_b["review_aspect_counts"]["therapist_service"] == 1
