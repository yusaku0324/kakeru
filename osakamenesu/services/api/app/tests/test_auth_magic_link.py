import os
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional

import pytest
from starlette.requests import Request

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


dummy_settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
dummy_settings_module.settings = _DummySettings()
sys.modules["app.settings"] = dummy_settings_module

from app import models  # type: ignore  # noqa: E402
from app.routers import auth  # type: ignore  # noqa: E402
from app.schemas import AuthRequestLink, AuthVerifyRequest  # type: ignore  # noqa: E402
from app.settings import settings  # type: ignore  # noqa: E402
import app.utils.auth as auth_utils  # type: ignore  # noqa: E402
from app.utils.auth import hash_token  # type: ignore  # noqa: E402
from app.utils.email import MailNotConfiguredError  # type: ignore  # noqa: E402

auth_utils.settings = settings


def _request(headers: Optional[Dict[str, str]] = None) -> Request:
    raw_headers = []
    headers = headers or {}
    for key, value in headers.items():
        raw_headers.append((key.lower().encode("latin-1"), value.encode("latin-1")))
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/auth/request-link",
        "headers": raw_headers,
        "client": ("127.0.0.1", 12345),
    }
    return Request(scope)


class FakeSession:
    def __init__(self) -> None:
        self.users_by_email: Dict[str, models.User] = {}
        self.users_by_id: Dict[str, models.User] = {}
        self.tokens: list[models.UserAuthToken] = []
        self.sessions: list[models.UserSession] = []

    async def execute(self, stmt):  # type: ignore[override]
        if stmt.column_descriptions and stmt.column_descriptions[0]["name"] == "User":
            email = None
            for criterion in getattr(stmt, "_where_criteria", []):
                if getattr(criterion.left, "name", None) == "email":
                    email = getattr(criterion.right, "value", None)
            user = self.users_by_email.get(email or "")

            class Result:
                def __init__(self, value):
                    self._value = value

                def scalar_one_or_none(self):
                    return self._value

            return Result(user)
        if stmt.column_descriptions and stmt.column_descriptions[0]["name"] == "UserAuthToken":
            token_hash = None
            for criterion in getattr(stmt, "_where_criteria", []):
                if getattr(criterion.left, "name", None) == "token_hash":
                    token_hash = getattr(criterion.right, "value", None)

            match = next((t for t in self.tokens if t.token_hash == token_hash), None)

            class TokenResult:
                def __init__(self, value):
                    self._value = value

                def scalar_one_or_none(self):
                    return self._value

            return TokenResult(match)
        raw_columns = getattr(stmt, "_raw_columns", [])
        if raw_columns:
            first = raw_columns[0]
            if getattr(first, "name", None) == "count":
                class CountResult:
                    def scalar(self_inner):
                        return 0

                    def scalar_one(self_inner):
                        return 0

                    def scalar_one_or_none(self_inner):
                        return 0

                return CountResult()

        raise AssertionError(f"Unhandled statement: {stmt}")

    async def get(self, model, pk):  # type: ignore[override]
        if model is models.User:
            return self.users_by_id.get(str(pk))
        return None

    def add(self, obj: Any) -> None:
        if isinstance(obj, models.User):
            self.users_by_email[obj.email] = obj
            if obj.id is not None:
                self.users_by_id[str(obj.id)] = obj
        if isinstance(obj, models.UserAuthToken):
            self.tokens.append(obj)
        if isinstance(obj, models.UserSession):
            self.sessions.append(obj)

    async def flush(self, _=None):  # type: ignore[override]
        return None

    async def commit(self) -> None:
        return None


@pytest.mark.anyio
async def test_request_link_sends_email(monkeypatch):
    original_api_key = settings.mail_api_key
    original_from = settings.mail_from_address
    settings.mail_api_key = "test-key"
    settings.mail_from_address = "no-reply@example.com"

    sent: Dict[str, Any] = {}

    async def _fake_send_email_async(**kwargs: Any) -> Dict[str, Any]:
        sent.update(kwargs)
        return {"id": "email-id"}

    monkeypatch.setattr(auth, "send_email_async", _fake_send_email_async)
    session = FakeSession()
    payload = AuthRequestLink(email="test@example.com")

    try:
        response = await auth.request_link(payload, _request(), db=session)
    finally:
        settings.mail_api_key = original_api_key
        settings.mail_from_address = original_from

    assert response["ok"] is True
    assert response["mail_sent"] is True
    assert sent["to"] == "test@example.com"
    assert "html" in sent
    assert session.tokens  # token persisted
    assert session.tokens[0].scope == "dashboard"


@pytest.mark.anyio
async def test_request_link_site_scope_sets_scope(monkeypatch):
    sent: Dict[str, Any] = {}

    async def _fake_send_email_async(**kwargs: Any) -> Dict[str, Any]:
        sent.update(kwargs)
        return {"id": "email-id"}

    monkeypatch.setattr(auth, "send_email_async", _fake_send_email_async)
    session = FakeSession()
    payload = AuthRequestLink(email="site@example.com", scope="site")

    response = await auth.request_link(payload, _request(), db=session)

    assert response["ok"] is True
    assert session.tokens
    assert session.tokens[0].scope == "site"


@pytest.mark.anyio
async def test_request_link_handles_missing_mail_config(monkeypatch):
    original_api_key = settings.mail_api_key
    original_from = settings.mail_from_address
    settings.mail_api_key = None
    settings.mail_from_address = "no-reply@example.com"

    async def _raise_mail_not_configured(**kwargs: Any) -> Dict[str, Any]:
        raise MailNotConfiguredError("missing key")

    monkeypatch.setattr(auth, "send_email_async", _raise_mail_not_configured)
    session = FakeSession()
    payload = AuthRequestLink(email="test@example.com")

    try:
        response = await auth.request_link(payload, _request(), db=session)
    finally:
        settings.mail_api_key = original_api_key
        settings.mail_from_address = original_from

    assert response["ok"] is True
    assert response["mail_sent"] is False
    assert response.get("message") == "mail_not_configured"


@pytest.mark.anyio
async def test_verify_dashboard_scope_sets_dashboard_cookie():
    original_dashboard = settings.dashboard_session_cookie_name
    original_site = settings.site_session_cookie_name
    settings.dashboard_session_cookie_name = "dash_cookie"
    settings.site_session_cookie_name = "site_cookie"

    session = FakeSession()
    user = models.User(id=uuid.uuid4(), email="verify@example.com")
    session.add(user)

    raw_token = "verify-token"
    token_hash = hash_token(raw_token)
    auth_token = models.UserAuthToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(UTC) + timedelta(minutes=15),
        ip_hash=None,
        user_agent=None,
    )
    session.add(auth_token)

    payload = AuthVerifyRequest(token=raw_token)
    try:
        response = await auth.verify_token(payload, _request(), db=session)
    finally:
        settings.dashboard_session_cookie_name = original_dashboard
        settings.site_session_cookie_name = original_site
    cookies = response.headers.getlist("set-cookie")
    assert any("dash_cookie" in cookie for cookie in cookies)
    assert not any("site_cookie" in cookie for cookie in cookies)


@pytest.mark.anyio
async def test_verify_site_scope_sets_site_cookie_only():
    original_dashboard = settings.dashboard_session_cookie_name
    original_site = settings.site_session_cookie_name
    settings.dashboard_session_cookie_name = "dash_cookie"
    settings.site_session_cookie_name = "site_cookie"

    session = FakeSession()
    user = models.User(id=uuid.uuid4(), email="verify@example.com")
    session.add(user)

    raw_token = "verify-token"
    token_hash = hash_token(raw_token)
    auth_token = models.UserAuthToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(UTC) + timedelta(minutes=15),
        ip_hash=None,
        user_agent=None,
        scope="site",
    )
    session.add(auth_token)

    payload = AuthVerifyRequest(token=raw_token)
    try:
        response = await auth.verify_token(payload, _request(), db=session)
    finally:
        settings.dashboard_session_cookie_name = original_dashboard
        settings.site_session_cookie_name = original_site

    cookies = response.headers.getlist("set-cookie")
    assert any("site_cookie" in cookie for cookie in cookies)
    assert not any("dash_cookie" in cookie for cookie in cookies)


@pytest.mark.anyio
async def test_logout_deletes_both_cookies():
    original_dashboard = settings.dashboard_session_cookie_name
    original_site = settings.site_session_cookie_name
    settings.dashboard_session_cookie_name = "dash_cookie"
    settings.site_session_cookie_name = "site_cookie"

    try:
        response = await auth.logout(_request(), db=FakeSession())
    finally:
        settings.dashboard_session_cookie_name = original_dashboard
        settings.site_session_cookie_name = original_site

    cookies = [cookie.lower() for cookie in response.headers.getlist("set-cookie")]
    assert any("dash_cookie=" in cookie and "max-age=0" in cookie for cookie in cookies)
    assert any("site_cookie=" in cookie and "max-age=0" in cookie for cookie in cookies)
