import os
import sys
import uuid
from datetime import datetime, UTC
from pathlib import Path

_HELPER_DIR = Path(__file__).resolve().parent
if str(_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_HELPER_DIR))

from _path_setup import configure_paths
from types import SimpleNamespace

import pytest

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

# Import fixtures first (this sets up dummy settings)
from _dashboard_fixtures import (
    DummyShopManager,
    FakeRequest,
    FakeSession,
    FakeListSession,
    setup_dummy_settings,
)

# Ensure settings are set up before importing dashboard modules
setup_dummy_settings()

import importlib
from app import models  # noqa: E402

dashboard_shops = importlib.import_module("app.domains.dashboard.shops.router")  # noqa: E402


@pytest.mark.anyio
async def test_update_profile_changes_status(monkeypatch):
    now = datetime.now(UTC)
    user_id = uuid.uuid4()
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
    shop_manager = DummyShopManager(user_id=user_id, shop_id=profile.id)
    session = FakeSession(profile, shop_managers=[shop_manager])

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
        user=SimpleNamespace(id=user_id),
    )

    assert profile.status == "published"
    assert response.status == "published"
    assert session.committed is True
    assert session.refreshed is True
    assert any(
        isinstance(log, models.AdminChangeLog) and log.action == "update"
        for log in session.added
    )


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
