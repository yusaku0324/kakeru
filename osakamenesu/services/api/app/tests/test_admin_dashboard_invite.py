import os
import sys
import uuid
from datetime import datetime, UTC
from pathlib import Path
from typing import Any, Dict, List, Optional

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
        self.site_base_url = "https://example.com"


dummy_settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
dummy_settings_module.settings = _DummySettings()
sys.modules.setdefault("app.settings", dummy_settings_module)

from app import models  # type: ignore  # noqa: E402
from app.routers import admin as admin_router  # type: ignore  # noqa: E402
from app.schemas import DashboardInviteRequest  # type: ignore  # noqa: E402


class FakeResult:
    def __init__(self, *, scalar_one_or_none: Any = None) -> None:
        self._value = scalar_one_or_none

    def scalar_one_or_none(self) -> Any:
        return self._value


class FakeSession:
    def __init__(
        self,
        profiles: Dict[uuid.UUID, models.Profile],
        dashboard_users: Optional[List[models.DashboardUser]] = None,
    ) -> None:
        self._profiles = profiles
        self.dashboard_users = dashboard_users or []
        self.added: List[models.DashboardUser] = []
        self.commits = 0

    async def get(self, model, pk):  # type: ignore[override]
        if model is models.Profile:
            return self._profiles.get(pk)
        return None

    async def execute(self, query):  # type: ignore[override]
        criteria = getattr(query, "_where_criteria", [])
        email = None
        profile_id = None
        for criterion in criteria:
            left = getattr(criterion, "left", None)
            if getattr(left, "name", None) == "email":
                email = getattr(criterion.right, "value", None)
            if getattr(left, "name", None) == "profile_id":
                value = getattr(criterion.right, "value", None)
                if value is not None:
                    profile_id = uuid.UUID(str(value))

        if email is not None:
            match = next((u for u in self.dashboard_users if u.email == email), None)
            return FakeResult(scalar_one_or_none=match)

        if profile_id is not None:
            match = next((u for u in self.dashboard_users if u.profile_id == profile_id), None)
            return FakeResult(scalar_one_or_none=match)

        raise AssertionError(f"Unhandled query: {query}")

    async def flush(self) -> None:
        return None

    async def commit(self) -> None:
        self.commits += 1

    def add(self, obj: Any) -> None:
        if isinstance(obj, models.DashboardUser):
            self.dashboard_users.append(obj)
            self.added.append(obj)
            if obj.id is None:
                obj.id = uuid.uuid4()


def _make_profile(**overrides: Any) -> models.Profile:
    now = datetime.now(UTC)
    defaults: Dict[str, Any] = {
        "id": uuid.uuid4(),
        "name": "テスト店舗",
        "area": "難波/日本橋",
        "price_min": 9000,
        "price_max": 16000,
        "bust_tag": "C",
        "service_type": "store",
        "contact_json": {"store_name": "テスト店舗"},
        "created_at": now,
        "updated_at": now,
        "status": "published",
    }
    defaults.update(overrides)
    return models.Profile(**defaults)


def _request_with_headers(headers: Dict[str, str]) -> Request:
    raw_headers = [(key.lower().encode("latin-1"), value.encode("latin-1")) for key, value in headers.items()]
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/admin/dashboard/users/invite",
        "headers": raw_headers,
        "client": ("127.0.0.1", 12345),
    }
    return Request(scope)


@pytest.mark.anyio
async def test_invite_creates_dashboard_user(monkeypatch):
    profile = _make_profile()
    session = FakeSession({profile.id: profile})

    sent: Dict[str, Any] = {}

    async def _fake_send_email_async(**kwargs: Any) -> Dict[str, Any]:
        sent.update(kwargs)
        return {"id": "test-email-id"}

    async def _noop_record_change(*args: Any, **kwargs: Any) -> None:
        return None

    monkeypatch.setattr(admin_router, "send_email_async", _fake_send_email_async)
    monkeypatch.setattr(admin_router, "_record_change", _noop_record_change)

    payload = DashboardInviteRequest(profile_id=profile.id, email="store@example.com", invited_by="tester")
    request = _request_with_headers({"x-admin-key": "dev_admin_key"})

    response = await admin_router.invite_dashboard_user(payload, request, db=session)

    assert response.email == "store@example.com"
    assert response.status == "pending"
    assert sent["to"] == "store@example.com"
    assert len(session.dashboard_users) == 1
    assert session.dashboard_users[0].invited_by == "tester"


@pytest.mark.anyio
async def test_invite_updates_existing_user(monkeypatch):
    profile = _make_profile()
    existing = models.DashboardUser(
        id=uuid.uuid4(),
        profile_id=profile.id,
        email="old@example.com",
        status="active",
        invited_by="admin",
        invited_at=datetime.now(UTC),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session = FakeSession({profile.id: profile}, dashboard_users=[existing])

    async def _fake_send_email_async(**kwargs: Any) -> Dict[str, Any]:
        return {"id": "reinvite"}

    async def _noop_record_change(*args: Any, **kwargs: Any) -> None:
        return None

    monkeypatch.setattr(admin_router, "send_email_async", _fake_send_email_async)
    monkeypatch.setattr(admin_router, "_record_change", _noop_record_change)

    payload = DashboardInviteRequest(profile_id=profile.id, email="new@example.com", invited_by="admin")
    request = _request_with_headers({"x-admin-key": "dev_admin_key"})

    response = await admin_router.invite_dashboard_user(payload, request, db=session)

    assert response.email == "new@example.com"
    assert session.dashboard_users[0].email == "new@example.com"
    assert session.dashboard_users[0].status == "pending"


@pytest.mark.anyio
async def test_invite_conflicts_on_existing_email(monkeypatch):
    profile = _make_profile()
    other_profile = _make_profile()
    existing = models.DashboardUser(
        id=uuid.uuid4(),
        profile_id=other_profile.id,
        email="dup@example.com",
        status="active",
        invited_by="admin",
        invited_at=datetime.now(UTC),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session = FakeSession({profile.id: profile, other_profile.id: other_profile}, dashboard_users=[existing])

    async def _fake_send_email_async(**kwargs: Any) -> Dict[str, Any]:
        return {"id": "noop"}

    async def _noop_record_change(*args: Any, **kwargs: Any) -> None:
        return None

    monkeypatch.setattr(admin_router, "send_email_async", _fake_send_email_async)
    monkeypatch.setattr(admin_router, "_record_change", _noop_record_change)

    payload = DashboardInviteRequest(profile_id=profile.id, email="dup@example.com")
    request = _request_with_headers({"x-admin-key": "dev_admin_key"})

    with pytest.raises(admin_router.HTTPException) as exc:
        await admin_router.invite_dashboard_user(payload, request, db=session)

    assert exc.value.status_code == 409
