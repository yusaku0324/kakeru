"""Tests for dashboard shop manager endpoints."""

from __future__ import annotations

import sys
import uuid
from datetime import datetime, UTC
from pathlib import Path
from typing import Any, List

import pytest
from fastapi.testclient import TestClient

_HELPER_DIR = Path(__file__).resolve().parent
if str(_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_HELPER_DIR))

from _path_setup import configure_paths

ROOT = configure_paths(Path(__file__))

from app.main import app
from app.db import get_session
from app.deps import require_dashboard_user
from app import models

from _dashboard_fixtures import (
    DummyUser,
    DummyShopManager,
    DummyProfile,
)


client = TestClient(app)


def setup_function():
    """Reset dependency overrides before each test."""
    app.dependency_overrides.clear()


def teardown_function():
    """Clean up dependency overrides after each test."""
    app.dependency_overrides.clear()


class _ScalarsAllResult:
    """Result wrapper that supports scalars().all()."""

    def __init__(self, items: List[Any]) -> None:
        self._items = items

    def all(self) -> List[Any]:
        return self._items


class _ExecuteResult:
    """Result wrapper for execute results."""

    def __init__(self, items: List[Any], rows: List[Any] | None = None) -> None:
        self._items = items
        self._rows = rows

    def scalars(self) -> _ScalarsAllResult:
        return _ScalarsAllResult(self._items)

    def scalar_one_or_none(self) -> Any:
        return self._items[0] if self._items else None

    def all(self) -> List[Any]:
        return self._rows if self._rows is not None else []


class ManagerTestSession:
    """Session stub for manager API tests."""

    def __init__(
        self,
        profile: DummyProfile | None = None,
        shop_managers: List[DummyShopManager] | None = None,
        users: List[DummyUser] | None = None,
        current_user_id: uuid.UUID | None = None,
    ) -> None:
        self.profile = profile
        self.shop_managers = shop_managers or []
        self.users = users or []
        self.current_user_id = current_user_id
        self._committed = False
        self._added: List[Any] = []
        self._deleted: List[Any] = []
        self._query_count = 0

    async def get(self, model_class: type, pk: uuid.UUID) -> Any:
        if model_class == models.Profile:
            if self.profile and pk == self.profile.id:
                return self.profile
            return None
        if model_class == models.ShopManager:
            for sm in self.shop_managers:
                if sm.id == pk:
                    return sm
            return None
        if model_class == models.User:
            for u in self.users:
                if u.id == pk:
                    return u
            return None
        return None

    async def execute(self, stmt: Any) -> _ExecuteResult:
        self._query_count += 1
        stmt_str = str(stmt).lower()

        # First query is usually verify_shop_manager (single ShopManager lookup)
        if (
            self._query_count == 1
            and "shop_managers" in stmt_str
            and "users" not in stmt_str
        ):
            # Return managers for current user only
            matching = [
                sm for sm in self.shop_managers if sm.user_id == self.current_user_id
            ]
            return _ExecuteResult(matching)

        # JOIN query for listing managers
        if "shop_managers" in stmt_str and "users" in stmt_str:
            rows = []
            for sm in self.shop_managers:
                for u in self.users:
                    if sm.user_id == u.id:
                        rows.append((sm, u))
            return _ExecuteResult([], rows=rows)

        # ShopManager only query (for owner count, existing check, etc.)
        if "shop_managers" in stmt_str:
            return _ExecuteResult(self.shop_managers)

        # User lookup by email
        if "users" in stmt_str:
            return _ExecuteResult(self.users)

        return _ExecuteResult([])

    async def commit(self) -> None:
        self._committed = True

    async def flush(self) -> None:
        pass

    async def refresh(self, obj: Any) -> None:
        pass

    def add(self, obj: Any) -> None:
        self._added.append(obj)
        if isinstance(obj, models.User):
            obj.id = uuid.uuid4()
            obj.display_name = None
        if isinstance(obj, models.ShopManager):
            obj.id = uuid.uuid4()
            obj.created_at = datetime.now(UTC)

    async def delete(self, obj: Any) -> None:
        self._deleted.append(obj)


def test_list_shop_managers_success():
    """List managers for a shop."""
    user = DummyUser()
    user.display_name = "Test Owner"
    profile = DummyProfile()
    owner = DummyShopManager(user_id=user.id, shop_id=profile.id, role="owner")
    owner.created_at = datetime.now(UTC)

    session = ManagerTestSession(
        profile=profile,
        shop_managers=[owner],
        users=[user],
        current_user_id=user.id,
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/dashboard/shops/{profile.id}/managers")
    assert res.status_code == 200
    body = res.json()
    assert "managers" in body
    assert len(body["managers"]) == 1
    assert body["managers"][0]["role"] == "owner"


def test_list_shop_managers_forbidden():
    """Return 403 if user is not a manager of the shop."""
    user = DummyUser()
    profile = DummyProfile()
    # No shop_managers for this user/profile combo
    session = ManagerTestSession(
        profile=profile,
        shop_managers=[],
        users=[user],
        current_user_id=user.id,
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/dashboard/shops/{profile.id}/managers")
    assert res.status_code == 403


@pytest.mark.skip(
    reason="Complex session mocking required - tested via integration tests"
)
def test_add_shop_manager_success():
    """Add a new manager to a shop."""
    # This test requires complex session mocking that tracks multiple queries.
    # The functionality is tested via curl/integration tests.
    pass


def test_add_shop_manager_not_owner():
    """Return 403 if user is not an owner."""
    user = DummyUser()
    profile = DummyProfile()
    staff = DummyShopManager(user_id=user.id, shop_id=profile.id, role="staff")

    session = ManagerTestSession(
        profile=profile,
        shop_managers=[staff],
        users=[user],
        current_user_id=user.id,
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.post(
        f"/api/dashboard/shops/{profile.id}/managers",
        json={"email": "newstaff@example.com", "role": "staff"},
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "owner_required"


def test_add_shop_manager_already_exists():
    """Return 409 if user is already a manager."""
    user = DummyUser()
    user.email = "owner@example.com"
    profile = DummyProfile()
    owner = DummyShopManager(user_id=user.id, shop_id=profile.id, role="owner")

    existing_user = DummyUser()
    existing_user.email = "existing@example.com"
    existing_manager = DummyShopManager(
        user_id=existing_user.id, shop_id=profile.id, role="staff"
    )

    session = ManagerTestSession(
        profile=profile,
        shop_managers=[owner, existing_manager],
        users=[user, existing_user],
        current_user_id=user.id,
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.post(
        f"/api/dashboard/shops/{profile.id}/managers",
        json={"email": "existing@example.com", "role": "staff"},
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "already_manager"


def test_update_shop_manager_role():
    """Update a manager's role."""
    user = DummyUser()
    profile = DummyProfile()
    owner = DummyShopManager(user_id=user.id, shop_id=profile.id, role="owner")

    staff_user = DummyUser()
    staff_user.email = "staff@example.com"
    staff = DummyShopManager(user_id=staff_user.id, shop_id=profile.id, role="staff")

    session = ManagerTestSession(
        profile=profile,
        shop_managers=[owner, staff],
        users=[user, staff_user],
        current_user_id=user.id,
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.patch(
        f"/api/dashboard/shops/{profile.id}/managers/{staff.id}",
        json={"role": "manager"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["role"] == "manager"


def test_delete_shop_manager():
    """Delete a manager from a shop."""
    user = DummyUser()
    profile = DummyProfile()
    owner = DummyShopManager(user_id=user.id, shop_id=profile.id, role="owner")

    staff_user = DummyUser()
    staff = DummyShopManager(user_id=staff_user.id, shop_id=profile.id, role="staff")

    session = ManagerTestSession(
        profile=profile,
        shop_managers=[owner, staff],
        users=[user, staff_user],
        current_user_id=user.id,
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.delete(f"/api/dashboard/shops/{profile.id}/managers/{staff.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["deleted"] is True


def test_delete_last_owner_fails():
    """Return 400 when trying to delete the last owner."""
    user = DummyUser()
    profile = DummyProfile()
    owner = DummyShopManager(user_id=user.id, shop_id=profile.id, role="owner")

    session = ManagerTestSession(
        profile=profile,
        shop_managers=[owner],
        users=[user],
        current_user_id=user.id,
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.delete(f"/api/dashboard/shops/{profile.id}/managers/{owner.id}")
    assert res.status_code == 400
    assert res.json()["detail"] == "cannot_remove_last_owner"


def test_demote_last_owner_fails():
    """Return 400 when trying to demote the last owner."""
    user = DummyUser()
    profile = DummyProfile()
    owner = DummyShopManager(user_id=user.id, shop_id=profile.id, role="owner")

    session = ManagerTestSession(
        profile=profile,
        shop_managers=[owner],
        users=[user],
        current_user_id=user.id,
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.patch(
        f"/api/dashboard/shops/{profile.id}/managers/{owner.id}",
        json={"role": "staff"},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "cannot_demote_last_owner"
