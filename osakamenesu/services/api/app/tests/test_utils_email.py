from __future__ import annotations

import os
import sys
from pathlib import Path
import asyncio
from typing import Any, Dict

import httpx
import pytest

ROOT = Path(__file__).resolve().parents[4]
os.chdir(ROOT)
sys.path.insert(0, str(ROOT / "services" / "api"))

import importlib
import types

MODULES_TO_CLEAN = [
    "app.settings",
    "app.utils.email",
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


@pytest.fixture
def email_utils(monkeypatch: pytest.MonkeyPatch):
    for module_name in MODULES_TO_CLEAN:
        sys.modules.pop(module_name, None)
    _install_dummy_settings(monkeypatch)
    return importlib.import_module("app.utils.email")


def test_normalize_recipients_filters_empty_entries(email_utils):
    assert email_utils._normalize_recipients("user@example.com") == ["user@example.com"]
    assert email_utils._normalize_recipients(["foo@example.com", "", None, "bar@example.com"]) == [
        "foo@example.com",
        "bar@example.com",
    ]
    with pytest.raises(ValueError):
        email_utils._normalize_recipients(["", None])


@pytest.mark.anyio
async def test_send_email_async_requires_configuration(email_utils, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(email_utils.settings, "mail_api_key", None)
    with pytest.raises(email_utils.MailNotConfiguredError):
        await email_utils.send_email_async(to="user@example.com", subject="Hello", html="<p>Hi</p>")


@pytest.mark.anyio
async def test_send_email_async_success(email_utils, monkeypatch: pytest.MonkeyPatch):
    payload: Dict[str, Any] = {}

    class DummyResponse:
        status_code = 200
        text = "{}"

        @staticmethod
        def raise_for_status() -> None:
            return None

        @staticmethod
        def json() -> dict:
            return {"ok": True}

    class DummyClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            payload["init"] = {"args": args, "kwargs": kwargs}

        async def __aenter__(self) -> "DummyClient":
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def post(self, path: str, json: Dict[str, Any], headers: Dict[str, str]) -> DummyResponse:
            payload["request"] = {"path": path, "json": json, "headers": headers}
            return DummyResponse()

    monkeypatch.setattr(email_utils.httpx, "AsyncClient", DummyClient)
    monkeypatch.setattr(email_utils.settings, "mail_api_key", "secret-token")
    monkeypatch.setattr(email_utils.settings, "mail_from_address", "no-reply@example.com")
    monkeypatch.setattr(email_utils.settings, "mail_provider_base_url", "https://api.mail.example")

    result = await email_utils.send_email_async(
        to=["recipient@example.com", ""],
        subject="Greetings",
        html="<p>Hello</p>",
        text="Hello",
        tags=["welcome", "test"],
    )

    assert result == {"ok": True}
    request = payload["request"]
    assert request["path"] == "/emails"
    assert request["json"]["from"] == "no-reply@example.com"
    assert request["json"]["to"] == ["recipient@example.com"]
    assert request["json"]["tags"] == [{"name": "welcome", "value": "welcome"}, {"name": "test", "value": "test"}]
    assert request["headers"]["Authorization"] == "Bearer secret-token"
    assert payload["init"]["kwargs"]["base_url"] == "https://api.mail.example"


@pytest.mark.anyio
async def test_send_email_async_logs_and_raises_http_error(email_utils, monkeypatch: pytest.MonkeyPatch):
    class DummyResponse:
        status_code = 503
        text = "error"

        def raise_for_status(self) -> None:
            raise httpx.HTTPStatusError(
                "boom",
                request=httpx.Request("POST", "https://api.mail.example/emails"),
                response=self,
            )

    class DummyClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            return None

        async def __aenter__(self) -> "DummyClient":
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def post(self, *args: Any, **kwargs: Any) -> DummyResponse:
            return DummyResponse()

    monkeypatch.setattr(email_utils.httpx, "AsyncClient", DummyClient)
    monkeypatch.setattr(email_utils.settings, "mail_api_key", "secret-token")
    monkeypatch.setattr(email_utils.settings, "mail_from_address", "no-reply@example.com")
    monkeypatch.setattr(email_utils.settings, "mail_provider_base_url", "https://api.mail.example")

    with pytest.raises(httpx.HTTPStatusError):
        await email_utils.send_email_async(to="recipient@example.com", subject="Fail", html="<p>Fail</p>")


def test_send_email_runs_outside_event_loop(email_utils, monkeypatch: pytest.MonkeyPatch):
    captured: Dict[str, Any] = {}

    async def fake_async(**kwargs: Any) -> dict:
        return {"sent": kwargs}

    def fake_run(coro: Any) -> dict:
        captured["coro"] = coro
        loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(coro)
        finally:
            loop.close()
            asyncio.set_event_loop(None)
        return result

    def raise_runtime_error() -> None:
        raise RuntimeError("no loop")

    monkeypatch.setattr(email_utils, "send_email_async", fake_async)
    monkeypatch.setattr(email_utils.asyncio, "run", fake_run)
    monkeypatch.setattr(email_utils.asyncio, "get_running_loop", raise_runtime_error)

    result = email_utils.send_email(to="foo@example.com", subject="Hi", html="<p>Hi</p>")
    assert result == {"sent": {"to": "foo@example.com", "subject": "Hi", "html": "<p>Hi</p>", "text": None, "tags": None}}
    assert captured["coro"] is not None


def test_send_email_disallowed_inside_event_loop(email_utils, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(email_utils.asyncio, "get_running_loop", lambda: object())
    with pytest.raises(RuntimeError):
        email_utils.send_email(to="foo@example.com", subject="Hi", html="<p>Hi</p>")
