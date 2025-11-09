import json
import os
import sys
import types
from pathlib import Path

_HELPER_DIR = Path(__file__).resolve().parent
if str(_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_HELPER_DIR))

from _path_setup import configure_paths

import pytest
from fastapi import HTTPException
from starlette.requests import Request

ROOT = configure_paths(Path(__file__))

for key in [
    "API_PROXY_HMAC_SECRET",
    "PROXY_SHARED_SECRET",
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
        self.reservation_notification_max_attempts = 5
        self.reservation_notification_retry_base_seconds = 30
        self.reservation_notification_retry_backoff_multiplier = 2.0
        self.reservation_notification_worker_interval_seconds = 1.0
        self.reservation_notification_batch_size = 20
        self.proxy_shared_secret = "unit-test-secret"


dummy_settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
dummy_settings_module.settings = _DummySettings()
sys.modules["app.settings"] = dummy_settings_module

import app.domains.async_tasks.router as async_router  # noqa: E402


class DummySession:
    def __init__(self) -> None:
        self.committed = False

    async def commit(self):
        self.committed = True


def make_request(body: dict) -> Request:
    raw = json.dumps(body).encode()
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": raw, "more_body": False}

    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "POST",
        "path": "/api/async/jobs",
        "raw_path": b"/api/async/jobs",
        "root_path": "",
        "scheme": "http",
        "query_string": b"",
        "headers": [],
        "client": ("test", 123),
        "server": ("testserver", 80),
    }
    return Request(scope, receive)


def build_notification_payload(**overrides):
    base = {
        "reservation_id": "00000000-0000-0000-0000-000000000001",
        "shop_id": "00000000-0000-0000-0000-000000000010",
        "shop_name": "テスト店",
        "customer_name": "山田太郎",
        "customer_phone": "090",
        "desired_start": "2025-11-08T12:00:00+09:00",
        "desired_end": "2025-11-08T13:00:00+09:00",
        "status": "pending",
    }
    base.update(overrides)
    return base


@pytest.mark.anyio
async def test_enqueue_reservation_notification_job(monkeypatch: pytest.MonkeyPatch):
    called = {}

    async def fake_enqueue(db, notification, schedule_at=None):
        called["notification"] = notification
        called["schedule_at"] = schedule_at

    monkeypatch.setattr(async_router, "enqueue_reservation_notification", fake_enqueue)

    request = make_request(
        {
            "type": "reservation_notification",
            "schedule_at": "2025-11-07T12:00:00+09:00",
            "notification": build_notification_payload(),
        }
    )
    session = DummySession()

    result = await async_router.enqueue_job(request, _verified=None, db=session)

    assert result["type"] == "reservation_notification"
    assert called["notification"].shop_name == "テスト店"
    assert called["schedule_at"].isoformat().startswith("2025-11-07T03:00:00+00:00")
    assert session.committed is True


@pytest.mark.anyio
async def test_enqueue_reservation_reminder_job(monkeypatch: pytest.MonkeyPatch):
    called = {}

    async def fake_enqueue(db, notification, schedule_at=None):
        called["notification"] = notification
        called["schedule_at"] = schedule_at

    monkeypatch.setattr(async_router, "enqueue_reservation_notification", fake_enqueue)

    request = make_request(
        {
            "type": "reservation_reminder",
            "notification": build_notification_payload(reminder_at="2025-11-08T10:00:00+09:00", status="confirmed"),
        }
    )
    session = DummySession()
    result = await async_router.enqueue_job(request, _verified=None, db=session)

    assert result["type"] == "reservation_reminder"
    assert called["notification"].event == "reminder"
    assert called["notification"].audience == "customer"
    assert called["notification"].status == "confirmed"
    assert session.committed


@pytest.mark.anyio
async def test_enqueue_reservation_cancellation_job(monkeypatch: pytest.MonkeyPatch):
    called = {}

    async def fake_enqueue(db, notification, schedule_at=None):
        called["notification"] = notification

    monkeypatch.setattr(async_router, "enqueue_reservation_notification", fake_enqueue)

    request = make_request(
        {
            "type": "reservation_cancellation",
            "notification": build_notification_payload(status="declined"),
        }
    )
    session = DummySession()
    result = await async_router.enqueue_job(request, _verified=None, db=session)

    assert result["type"] == "reservation_cancellation"
    assert called["notification"].status == "cancelled"


@pytest.mark.anyio
async def test_enqueue_job_missing_type():
    request = make_request({})
    session = DummySession()
    with pytest.raises(HTTPException) as exc:
        await async_router.enqueue_job(request, _verified=None, db=session)
    assert exc.value.status_code == 400
    assert exc.value.detail == "job_type_required"


@pytest.mark.anyio
async def test_enqueue_job_unsupported():
    request = make_request({"type": "unknown"})
    session = DummySession()
    with pytest.raises(HTTPException) as exc:
        await async_router.enqueue_job(request, _verified=None, db=session)
    assert exc.value.status_code == 400
    assert exc.value.detail == "unsupported_job_type"


def test_require_worker_token_validates(monkeypatch: pytest.MonkeyPatch) -> None:
    async_router.settings.async_worker_token = "worker-secret"

    with pytest.raises(HTTPException):
        async_router.require_worker_token(None)

    with pytest.raises(HTTPException):
        async_router.require_worker_token("Bearer wrong")

    async_router.require_worker_token("worker-secret")
    async_router.require_worker_token("Bearer worker-secret")
