import os
import sys
import types
import uuid
from datetime import datetime, UTC
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


dummy_settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
dummy_settings_module.settings = _DummySettings()
sys.modules.setdefault("app.settings", dummy_settings_module)

from app import models  # type: ignore  # noqa: E402
from app.routers import dashboard_shops  # type: ignore  # noqa: E402


class FakeSession:
    def __init__(self, profile: models.Profile) -> None:
        self._profile = profile
        self.committed = False
        self.refreshed = False
        self.logs: list[models.AdminChangeLog] = []

    async def get(self, model, pk):  # type: ignore[override]
        if model is models.Profile and pk == self._profile.id:
            return self._profile
        return None

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, instance):  # type: ignore[override]
        self.refreshed = True

    def add(self, instance):  # type: ignore[override]
        if isinstance(instance, models.AdminChangeLog):
            self.logs.append(instance)


class FakeListSession:
    def __init__(self, profiles: list[models.Profile]) -> None:
        self._profiles = profiles

    async def execute(self, stmt):  # type: ignore[override]
        _ = stmt

        class _ScalarResult:
            def __init__(self, profiles: list[models.Profile]) -> None:
                self._profiles = profiles

            def all(self) -> list[models.Profile]:
                return self._profiles

        class _Result:
            def __init__(self, profiles: list[models.Profile]) -> None:
                self._profiles = profiles

            def scalars(self) -> _ScalarResult:
                return _ScalarResult(self._profiles)

        return _Result(self._profiles)


class FakeRequest:
    def __init__(self) -> None:
        self.headers: dict[str, str] = {}
        self.client = SimpleNamespace(host="127.0.0.1")


@pytest.mark.anyio
async def test_update_profile_changes_status(monkeypatch):
    now = datetime.now(UTC)
    profile = models.Profile(
        id=uuid.uuid4(),
        name="ステータステスト",
        area="梅田",
        price_min=9000,
        price_max=16000,
        bust_tag="C",
        service_type="store",
        contact_json={"store_name": "ステータステスト"},
        status="draft",
        created_at=now,
        updated_at=now,
    )
    session = FakeSession(profile)

    async def _noop_reindex(db, prof):  # type: ignore
        return None

    monkeypatch.setattr(dashboard_shops, "_reindex_profile", _noop_reindex)

    payload = dashboard_shops.DashboardShopProfileUpdatePayload(
        updated_at=now,
        status="published",
    )

    response = await dashboard_shops.update_dashboard_shop_profile(
        FakeRequest(),
        profile.id,
        payload,
        db=session,
        user=SimpleNamespace(id=uuid.uuid4()),
    )

    assert profile.status == "published"
    assert response.status == "published"
    assert session.committed is True
    assert session.refreshed is True
    assert any(log.action == "update" for log in session.logs)


@pytest.mark.anyio
async def test_list_dashboard_shops_returns_profiles():
    now = datetime.now(UTC)
    profile_a = models.Profile(
        id=uuid.uuid4(),
        name="店舗A",
        area="梅田",
        price_min=9000,
        price_max=16000,
        bust_tag="C",
        service_type="store",
        contact_json={"store_name": "店舗A"},
        status="published",
        created_at=now,
        updated_at=now,
    )
    profile_b = models.Profile(
        id=uuid.uuid4(),
        name="店舗B",
        area="難波",
        price_min=8000,
        price_max=14000,
        bust_tag="D",
        service_type="store",
        contact_json={"store_name": "店舗B"},
        status="draft",
        created_at=now,
        updated_at=now,
    )
    session = FakeListSession([profile_a, profile_b])

    response = await dashboard_shops.list_dashboard_shops(
        limit=5,
        db=session,
        user=SimpleNamespace(id=uuid.uuid4()),
    )

    assert len(response.shops) == 2
    assert response.shops[0].id == profile_a.id
    assert response.shops[1].id == profile_b.id
