import os
import sys
import types
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List

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
        self.auth_magic_link_expire_minutes = 15
        self.auth_magic_link_rate_limit = 5
        self.auth_session_ttl_days = 30
        self.auth_session_cookie_secure = False
        self.auth_session_cookie_domain = None
        self.auth_magic_link_redirect_path = "/auth/complete"
        self.auth_magic_link_debug = True
        self.reservation_notification_max_attempts = 5
        self.reservation_notification_retry_base_seconds = 30
        self.reservation_notification_retry_backoff_multiplier = 2.0
        self.reservation_notification_worker_interval_seconds = 1.0
        self.reservation_notification_batch_size = 20

    @property
    def auth_session_cookie_name(self) -> str:
        return self.dashboard_session_cookie_name


dummy_settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
dummy_settings_module.settings = _DummySettings()
sys.modules["app.settings"] = dummy_settings_module

from app import models  # type: ignore  # noqa: E402
import app.notifications as notifications  # type: ignore  # noqa: E402


class FakeSession:
    def __init__(self) -> None:
        self.added_all: List[Any] = []
        self.added: List[Any] = []
        self.flush_count = 0

    def add_all(self, items: List[Any]) -> None:
        self.added_all.extend(items)

    def add(self, item: Any) -> None:
        self.added.append(item)

    async def flush(self) -> None:
        self.flush_count += 1


@pytest.mark.anyio
async def test_enqueue_creates_deliveries_for_available_channels(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(notifications, "EMAIL_ENDPOINT", "https://email.test/api")
    monkeypatch.setattr(notifications, "SLACK_WEBHOOK", None)
    monkeypatch.setattr(notifications, "LINE_ENDPOINT", None)

    session = FakeSession()
    payload = notifications.ReservationNotification(
        reservation_id=str(uuid.uuid4()),
        shop_id=str(uuid.uuid4()),
        shop_name="テスト店",
        customer_name="山田太郎",
        customer_phone="000-0000-0000",
        desired_start="2025-01-01T10:00:00+00:00",
        desired_end="2025-01-01T11:00:00+00:00",
        status="pending",
        channel="web",
        notes="よろしくお願いします",
        customer_email="guest@example.com",
        email_recipients=["notify@example.com"],
        slack_webhook_url="https://slack.test/webhook",
    )

    deliveries = await notifications.enqueue_reservation_notification(session, payload)

    assert session.flush_count == 1
    assert len(deliveries) == 2
    channels = {delivery.channel for delivery in session.added_all}
    assert channels == {"email", "slack"}
    for delivery in deliveries:
        assert delivery.payload["notification"]["reservation_id"] == payload.reservation_id
        assert delivery.payload["message"]


@pytest.mark.anyio
async def test_dispatch_delivery_success() -> None:
    session = FakeSession()
    reservation_id = uuid.uuid4()
    payload = notifications.ReservationNotification(
        reservation_id=str(reservation_id),
        shop_id=str(uuid.uuid4()),
        shop_name="成功店",
        customer_name="田中花子",
        customer_phone="09000000000",
        desired_start="2025-02-02T10:00:00+00:00",
        desired_end="2025-02-02T11:00:00+00:00",
        status="confirmed",
    )
    job_payload: Dict[str, Any] = {
        "notification": payload.to_dict(),
        "message": "test message",
        "config": {},
    }
    delivery = models.ReservationNotificationDelivery(
        reservation_id=reservation_id,
        channel="email",
        status="pending",
        payload=job_payload,
        attempt_count=0,
    )

    class _Resp:
        status_code = 202

    async def _success_sender(*_: Any, **__: Any) -> _Resp:
        return _Resp()

    fixed_now = datetime(2025, 2, 2, 12, 0, tzinfo=UTC)
    handled = await notifications._dispatch_delivery(  # type: ignore[attr-defined]
        session,
        delivery,
        senders={"email": _success_sender},
        now=fixed_now,
    )

    assert handled is True
    assert delivery.status == "succeeded"
    assert delivery.next_attempt_at is None
    assert delivery.attempt_count == 1
    assert delivery.last_error is None
    assert session.added[0].status == "success"
    assert session.added[0].response_status == 202
    assert session.added[0].attempted_at == fixed_now


@pytest.mark.anyio
async def test_dispatch_delivery_failure_schedules_retry() -> None:
    session = FakeSession()
    reservation_id = uuid.uuid4()
    payload = notifications.ReservationNotification(
        reservation_id=str(reservation_id),
        shop_id=str(uuid.uuid4()),
        shop_name="失敗店",
        customer_name="佐藤次郎",
        customer_phone="08000000000",
        desired_start="2025-03-03T10:00:00+00:00",
        desired_end="2025-03-03T11:00:00+00:00",
        status="pending",
    )
    job_payload: Dict[str, Any] = {
        "notification": payload.to_dict(),
        "message": "failure message",
        "config": {},
    }
    delivery = models.ReservationNotificationDelivery(
        reservation_id=reservation_id,
        channel="email",
        status="pending",
        payload=job_payload,
        attempt_count=0,
    )

    async def _fail_sender(*_: Any, **__: Any) -> None:
        raise RuntimeError("boom")

    fixed_now = datetime(2025, 3, 3, 12, 0, tzinfo=UTC)
    handled = await notifications._dispatch_delivery(  # type: ignore[attr-defined]
        session,
        delivery,
        senders={"email": _fail_sender},
        now=fixed_now,
    )

    assert handled is False
    assert delivery.status == "pending"
    assert delivery.next_attempt_at == fixed_now + timedelta(seconds=notifications.settings.reservation_notification_retry_base_seconds)
    assert delivery.attempt_count == 1
    assert delivery.last_error == "boom"
    assert session.added[0].status == "failure"
    assert session.added[0].error_message == "boom"


@pytest.mark.anyio
async def test_dispatch_delivery_failure_reaches_max_marks_failed(monkeypatch: pytest.MonkeyPatch) -> None:
    session = FakeSession()
    reservation_id = uuid.uuid4()
    payload = notifications.ReservationNotification(
        reservation_id=str(reservation_id),
        shop_id=str(uuid.uuid4()),
        shop_name="最大試行",
        customer_name="高橋健",
        customer_phone="07000000000",
        desired_start="2025-04-04T10:00:00+00:00",
        desired_end="2025-04-04T11:00:00+00:00",
        status="pending",
    )
    job_payload: Dict[str, Any] = {
        "notification": payload.to_dict(),
        "message": "give up",
        "config": {},
    }
    delivery = models.ReservationNotificationDelivery(
        reservation_id=reservation_id,
        channel="email",
        status="pending",
        payload=job_payload,
        attempt_count=0,
    )

    async def _fail_sender(*_: Any, **__: Any) -> None:
        raise RuntimeError("error")

    monkeypatch.setattr(notifications.settings, "reservation_notification_max_attempts", 1)

    handled = await notifications._dispatch_delivery(  # type: ignore[attr-defined]
        session,
        delivery,
        senders={"email": _fail_sender},
        now=datetime(2025, 4, 4, 12, 0, tzinfo=UTC),
    )

    assert handled is False
    assert delivery.status == "failed"
    assert delivery.next_attempt_at is None
    assert delivery.last_error == "error"
