from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest

ROOT = Path(__file__).resolve().parents[4]
os.chdir(ROOT)
sys.path.insert(0, str(ROOT / "services" / "api"))

import importlib
import types

MODULES_TO_CLEAN = [
    "app.settings",
    "app.schemas",
    "app.models",
    "app.utils.profiles",
]


def _install_dummy_settings(monkeypatch: pytest.MonkeyPatch) -> None:
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

    dummy_settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
    dummy_settings_module.settings = _DummySettings()
    monkeypatch.setitem(sys.modules, "app.settings", dummy_settings_module)


def _install_dummy_schemas(monkeypatch: pytest.MonkeyPatch) -> None:
    dummy_schemas = types.ModuleType("app.schemas")
    dummy_schemas.REVIEW_ASPECT_KEYS = [
        "technique",
        "ambience",
        "therapist_service",
        "staff_response",
        "room_cleanliness",
    ]
    dummy_schemas.ReservationStatusLiteral = str  # type: ignore[assignment]
    dummy_schemas.DashboardNotificationStatus = str  # type: ignore[assignment]
    monkeypatch.setitem(sys.modules, "app.schemas", dummy_schemas)


def _install_dummy_models(monkeypatch: pytest.MonkeyPatch) -> None:
    dummy_models = types.ModuleType("app.models")

    class _DummyProfile:
        pass

    class _DummyReview:
        pass

    class _DummyTherapist:
        pass

    dummy_models.Profile = _DummyProfile
    dummy_models.Review = _DummyReview
    dummy_models.Therapist = _DummyTherapist
    monkeypatch.setitem(sys.modules, "app.models", dummy_models)


@pytest.fixture
def profile_utils(monkeypatch: pytest.MonkeyPatch):
    for module_name in MODULES_TO_CLEAN:
        sys.modules.pop(module_name, None)
    _install_dummy_settings(monkeypatch)
    _install_dummy_schemas(monkeypatch)
    _install_dummy_models(monkeypatch)
    return importlib.import_module("app.utils.profiles")


def test_compute_price_band_variants(profile_utils):
    assert profile_utils._compute_price_band(None, None) == ("unknown", "価格未設定")
    assert profile_utils._compute_price_band(15000, None) == ("14k_18k", "1.4〜1.8万円")
    assert profile_utils._compute_price_band(None, 9000) == ("under_10k", "〜1万円")


def test_normalize_helpers(profile_utils):
    assert profile_utils._normalize_text("  Hello  ") == "Hello"
    assert profile_utils._normalize_text("   ") is None
    assert profile_utils._normalize_text(123) == "123"
    assert profile_utils._collect_staff_specialties([" Head ", "", None, " Body "]) == ["Head", "Body"]
    assert profile_utils._collect_staff_specialties("invalid") == []


def test_safe_int_and_float(profile_utils):
    assert profile_utils._safe_int("42") == 42
    assert profile_utils._safe_int(None) is None
    assert profile_utils._safe_int("oops") is None
    assert profile_utils._safe_float("4.2") == 4.2
    assert profile_utils._safe_float(object()) is None


def test_normalize_review_aspects_filters_invalid_entries(profile_utils):
    raw = {
        "technique": {"score": 5, "note": " excellent "},
        "ambience": {"rating": "2"},
        "invalid": {"score": 6},
    }
    normalized = profile_utils.normalize_review_aspects(raw)
    assert normalized == {"technique": {"score": 5, "note": "excellent"}, "ambience": {"score": 2, "note": None}}


class DummyReview(SimpleNamespace):
    def __init__(self, score: int, *, status: str = "published", visited_offset_days: int = 0, **extra):
        now = datetime(2024, 1, 1, tzinfo=timezone.utc)
        visited = now + timedelta(days=visited_offset_days)
        super().__init__(
            id=uuid4(),
            score=score,
            status=status,
            created_at=now,
            visited_at=visited,
            title="",
            body="Review body",
            author_alias="alias",
            aspect_scores=extra.get("aspect_scores", {}),
        )


def test_compute_review_summary_with_published_reviews(profile_utils):
    reviews = [
        DummyReview(5, aspect_scores={"technique": {"score": 5}}),
        DummyReview(4, visited_offset_days=-1, aspect_scores={"technique": {"score": 3}}),
        DummyReview(1, status="draft"),
    ]
    profile = SimpleNamespace(reviews=reviews)

    average, count, highlights, aspect_avgs, aspect_counts = profile_utils.compute_review_summary(
        profile,
        include_aspects=True,
        highlight_limit=1,
    )

    assert average == 4.5
    assert count == 2
    assert len(highlights) == 1
    assert highlights[0]["review_id"] == str(reviews[0].id)
    assert aspect_avgs["technique"] == 4.0
    assert aspect_counts["technique"] == 2


def test_compute_review_summary_with_fallback_data(profile_utils):
    profile = SimpleNamespace(reviews=[])
    fallback = {
        "reviews": [
            {"score": 3, "aspects": {"technique": {"score": 5}}},
            {"rating": 4, "aspects": {"technique": {"score": 4}, "ambience": {"score": 4}}},
        ]
    }

    average, count, highlights, aspect_avgs, aspect_counts = profile_utils.compute_review_summary(
        profile,
        fallback_reviews=fallback,
        include_aspects=True,
    )

    assert average == 3.5
    assert count == 2
    assert len(highlights) == 2
    assert aspect_avgs["technique"] == 4.5
    assert aspect_counts["ambience"] == 1


def test_infer_height_age_uses_contact_json(profile_utils):
    profile = SimpleNamespace(height_cm=None, age=None, contact_json={"height_cm": "170", "age": 29})
    assert profile_utils.infer_height_age(profile) == (170, 29)
