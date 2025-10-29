import os
import sys
import types
import uuid
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import pytest

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
]:
    os.environ.pop(key, None)

settings_module = types.ModuleType("app.settings")


class _DummySettings:
    def __init__(self) -> None:
        self.database_url = "postgresql+asyncpg://app:app@localhost:5432/osaka_menesu"
        self.api_origin = "http://localhost:3000"
        self.api_public_base_url = "http://localhost:8000"
        self.meili_host = "http://127.0.0.1:7700"
        self.meili_master_key = "dev"
        self.admin_api_key = "admin-key"
        self.rate_limit_redis_url = None
        self.rate_limit_namespace = "test"
        self.rate_limit_redis_error_cooldown = 0.0
        self.init_db_on_startup = False
        self.slack_webhook_url = None
        self.notify_email_endpoint = None
        self.notify_line_endpoint = None
        self.notify_from_email = None
        self.mail_api_key = "mail"
        self.mail_from_address = "no-reply@example.com"
        self.mail_provider_base_url = "https://example.com"
        self.escalation_pending_threshold_minutes = 30
        self.escalation_check_interval_minutes = 5
        self.auth_magic_link_expire_minutes = 15
        self.auth_magic_link_rate_limit = 5
        self.auth_session_ttl_days = 30
        self.dashboard_session_cookie_name = "osakamenesu_session"
        self.site_session_cookie_name = "osakamenesu_session"
        self.auth_session_cookie_secure = False
        self.auth_session_cookie_domain = None
        self.auth_magic_link_redirect_path = "/auth/complete"
        self.auth_magic_link_debug = True
        self.site_base_url = "https://example.com"
        self.reservation_notification_max_attempts = 3
        self.reservation_notification_retry_base_seconds = 1
        self.reservation_notification_retry_backoff_multiplier = 2.0
        self.reservation_notification_worker_interval_seconds = 1.0
        self.reservation_notification_batch_size = 10

    @property
    def auth_session_cookie_name(self) -> str:
        return self.dashboard_session_cookie_name


settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
settings_module.settings = _DummySettings()
sys.modules["app.settings"] = settings_module

from app.services.reservations_admin import build_reservation_summary  # type: ignore  # noqa: E402


def _make_reservation(**overrides):
    now = datetime.now(UTC)
    base = {
        "id": uuid.uuid4(),
        "shop_id": uuid.uuid4(),
        "status": "confirmed",
        "desired_start": now,
        "desired_end": now,
        "channel": "web",
        "notes": "memo",
        "customer_name": "Tester",
        "customer_phone": "090-0000-0000",
        "customer_email": "tester@example.com",
        "created_at": now,
        "updated_at": now,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_build_reservation_summary_normalizes_non_string_fields():
    reservation = _make_reservation(
        channel=["form"],
        notes={"key": "value"},
        customer_name=12345,
        customer_phone=98765,
        customer_email="  ",
    )

    summary = build_reservation_summary(reservation, {})

    assert summary.channel == "['form']"
    assert summary.notes == "{'key': 'value'}"
    assert summary.customer_name == "12345"
    assert summary.customer_phone == "98765"
    assert summary.customer_email is None


def test_build_reservation_summary_falls_back_for_unknown_status():
    reservation = _make_reservation(status="unexpected", channel=None, notes=None)

    summary = build_reservation_summary(reservation, {reservation.shop_id: "Shop"})

    assert summary.status == "pending"
    assert summary.shop_name == "Shop"
