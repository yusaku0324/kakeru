"""Tests for dashboard shifts API."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import get_session
from app.deps import require_dashboard_user
from app import models


class DummyUser:
    """Minimal user stub for dashboard auth."""

    def __init__(self):
        self.id = uuid4()
        self.email = "shop@example.com"
        self.role = "dashboard"


class DummyProfile:
    """Minimal profile stub."""

    def __init__(self, profile_id=None):
        self.id = profile_id or uuid4()
        self.name = "Test Shop"


class DummyTherapist:
    """Minimal therapist stub."""

    def __init__(self, therapist_id=None, profile_id=None, name="Test Therapist"):
        self.id = therapist_id or uuid4()
        self.profile_id = profile_id
        self.name = name


class DummyShift:
    """Minimal shift stub."""

    def __init__(
        self,
        therapist_id,
        shop_id,
        shift_date=None,
        start_at=None,
        end_at=None,
        availability_status="available",
        notes=None,
    ):
        now = datetime.now(timezone.utc)
        self.id = uuid4()
        self.therapist_id = therapist_id
        self.shop_id = shop_id
        self.date = shift_date or date.today()
        self.start_at = start_at or (now + timedelta(hours=1))
        self.end_at = end_at or (now + timedelta(hours=9))
        self.break_slots = []
        self.availability_status = availability_status
        self.notes = notes
        self.created_at = now
        self.updated_at = now


class DummyShopManager:
    """Minimal shop manager stub."""

    def __init__(self, user_id, shop_id, role="owner"):
        self.id = uuid4()
        self.user_id = user_id
        self.shop_id = shop_id
        self.role = role


class DummySession:
    """Session stub that returns configured values."""

    def __init__(self, profile=None, therapists=None, shifts=None, shop_managers=None):
        self.profile = profile
        self.therapists = therapists or []
        self.shifts = shifts or []
        self.shop_managers = shop_managers or []
        self._committed = False
        self._added = []
        self._deleted = []

    async def get(self, model_class, pk):
        if model_class == models.Profile:
            return self.profile
        return None

    async def execute(self, stmt):
        class Result:
            def __init__(self, items):
                self._items = items

            def scalars(self):
                return self

            def scalar_one_or_none(self):
                return self._items[0] if self._items else None

            def all(self):
                return self._items

        # Very rough heuristic based on model type
        stmt_str = str(stmt)
        # Check for shop_managers query first
        if "shop_managers" in stmt_str.lower():
            return Result(self.shop_managers)
        # For reservation check, return empty (no reservations)
        # Must be before therapist check because guest_reservations contains "therapist"
        if "guest_reservations" in stmt_str.lower():
            return Result([])
        # For overlap check, return None (no overlap) to allow tests to pass
        if "therapist_shift" in stmt_str.lower() and "!=" in stmt_str:
            # This is likely the overlap check with exclude_id
            return Result([])
        if "therapist_shift" in stmt_str.lower():
            return Result(self.shifts)
        if "therapist" in stmt_str.lower():
            return Result(self.therapists)
        return Result([])

    def add(self, obj):
        self._added.append(obj)
        if isinstance(obj, models.TherapistShift):
            obj.id = uuid4()
            obj.created_at = datetime.now(timezone.utc)
            obj.updated_at = datetime.now(timezone.utc)
            self.shifts.append(obj)

    async def delete(self, obj):
        self._deleted.append(obj)
        if obj in self.shifts:
            self.shifts.remove(obj)

    async def commit(self):
        self._committed = True

    async def refresh(self, obj):
        pass


client = TestClient(app)


def setup_function():
    """Reset dependency overrides before each test."""
    app.dependency_overrides.clear()


def teardown_function():
    """Clean up dependency overrides after each test."""
    app.dependency_overrides.clear()


def test_list_shifts_empty():
    """List shifts returns empty list when no shifts exist."""
    user = DummyUser()
    profile = DummyProfile()
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)
    session = DummySession(profile=profile, shop_managers=[shop_manager])

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/dashboard/shops/{profile.id}/shifts")
    assert res.status_code == 200
    assert res.json() == []


def test_list_shifts_with_data():
    """List shifts returns existing shifts."""
    user = DummyUser()
    profile = DummyProfile()
    therapist = DummyTherapist(profile_id=profile.id)
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)

    today = date.today()
    start = datetime.combine(today, datetime.min.time()) + timedelta(hours=10)
    end = datetime.combine(today, datetime.min.time()) + timedelta(hours=18)

    shift = DummyShift(
        therapist_id=therapist.id,
        shop_id=profile.id,
        shift_date=today,
        start_at=start,
        end_at=end,
        notes="テストシフト",
    )
    session = DummySession(
        profile=profile,
        therapists=[therapist],
        shifts=[shift],
        shop_managers=[shop_manager],
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/dashboard/shops/{profile.id}/shifts")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["notes"] == "テストシフト"


def test_create_shift_success():
    """Create a new shift."""
    user = DummyUser()
    profile = DummyProfile()
    therapist = DummyTherapist(profile_id=profile.id)
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)
    session = DummySession(
        profile=profile, therapists=[therapist], shifts=[], shop_managers=[shop_manager]
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    today = date.today()
    start = datetime.combine(today, datetime.min.time()) + timedelta(hours=10)
    end = datetime.combine(today, datetime.min.time()) + timedelta(hours=18)

    payload = {
        "therapist_id": str(therapist.id),
        "date": today.isoformat(),
        "start_at": start.isoformat(),
        "end_at": end.isoformat(),
        "availability_status": "available",
        "notes": "新しいシフト",
    }

    res = client.post(f"/api/dashboard/shops/{profile.id}/shifts", json=payload)
    assert res.status_code == 201
    body = res.json()
    assert body["therapist_id"] == str(therapist.id)
    assert body["notes"] == "新しいシフト"
    assert session._committed


def test_create_shift_invalid_time_range():
    """Reject shift with end_at before start_at."""
    user = DummyUser()
    profile = DummyProfile()
    therapist = DummyTherapist(profile_id=profile.id)
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)
    session = DummySession(
        profile=profile, therapists=[therapist], shifts=[], shop_managers=[shop_manager]
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    today = date.today()
    start = datetime.combine(today, datetime.min.time()) + timedelta(hours=18)
    end = datetime.combine(today, datetime.min.time()) + timedelta(hours=10)

    payload = {
        "therapist_id": str(therapist.id),
        "date": today.isoformat(),
        "start_at": start.isoformat(),
        "end_at": end.isoformat(),
    }

    res = client.post(f"/api/dashboard/shops/{profile.id}/shifts", json=payload)
    assert res.status_code == 422


def test_get_shift_not_found():
    """Return 404 for non-existent shift."""
    user = DummyUser()
    profile = DummyProfile()
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)
    session = DummySession(profile=profile, shifts=[], shop_managers=[shop_manager])

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/dashboard/shops/{profile.id}/shifts/{uuid4()}")
    assert res.status_code == 404


def test_update_shift_success():
    """Update an existing shift."""
    user = DummyUser()
    profile = DummyProfile()
    therapist = DummyTherapist(profile_id=profile.id)
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)

    today = date.today()
    start = datetime.combine(today, datetime.min.time()) + timedelta(hours=10)
    end = datetime.combine(today, datetime.min.time()) + timedelta(hours=18)

    shift = DummyShift(
        therapist_id=therapist.id,
        shop_id=profile.id,
        shift_date=today,
        start_at=start,
        end_at=end,
    )
    session = DummySession(
        profile=profile,
        therapists=[therapist],
        shifts=[shift],
        shop_managers=[shop_manager],
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    payload = {
        "notes": "更新されたノート",
        "availability_status": "booked",
    }

    res = client.patch(
        f"/api/dashboard/shops/{profile.id}/shifts/{shift.id}", json=payload
    )
    assert res.status_code == 200
    body = res.json()
    assert body["notes"] == "更新されたノート"
    assert body["availability_status"] == "booked"


def test_delete_shift_success():
    """Delete a shift."""
    user = DummyUser()
    profile = DummyProfile()
    therapist = DummyTherapist(profile_id=profile.id)
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)

    shift = DummyShift(
        therapist_id=therapist.id,
        shop_id=profile.id,
    )
    session = DummySession(
        profile=profile,
        therapists=[therapist],
        shifts=[shift],
        shop_managers=[shop_manager],
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.delete(f"/api/dashboard/shops/{profile.id}/shifts/{shift.id}")
    assert res.status_code == 204
    assert session._committed


def test_shop_not_found():
    """Return 403 when user is not a manager of the shop."""
    user = DummyUser()
    session = DummySession(profile=None, shop_managers=[])  # No shop manager record

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/dashboard/shops/{uuid4()}/shifts")
    assert (
        res.status_code == 403
    )  # Changed from 404 to 403 since verify_shop_manager fails first


def test_create_shift_break_slots_outside_range_rejected():
    """Reject shift creation with break slots outside shift range."""
    user = DummyUser()
    profile = DummyProfile()
    therapist = DummyTherapist(profile_id=profile.id)
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)
    session = DummySession(
        profile=profile, therapists=[therapist], shifts=[], shop_managers=[shop_manager]
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    today = date.today()
    start = datetime.combine(today, datetime.min.time()) + timedelta(hours=10)
    end = datetime.combine(today, datetime.min.time()) + timedelta(hours=18)
    # Break that starts BEFORE shift start (invalid)
    break_start = datetime.combine(today, datetime.min.time()) + timedelta(hours=9)
    break_end = datetime.combine(today, datetime.min.time()) + timedelta(hours=11)

    payload = {
        "therapist_id": str(therapist.id),
        "date": today.isoformat(),
        "start_at": start.isoformat(),
        "end_at": end.isoformat(),
        "break_slots": [
            {"start_at": break_start.isoformat(), "end_at": break_end.isoformat()}
        ],
    }

    res = client.post(f"/api/dashboard/shops/{profile.id}/shifts", json=payload)
    # Should be rejected due to break outside shift range
    assert res.status_code == 422


def test_create_shift_break_slots_within_range_accepted():
    """Accept shift creation with break slots within shift range."""
    user = DummyUser()
    profile = DummyProfile()
    therapist = DummyTherapist(profile_id=profile.id)
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)
    session = DummySession(
        profile=profile, therapists=[therapist], shifts=[], shop_managers=[shop_manager]
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    today = date.today()
    start = datetime.combine(today, datetime.min.time()) + timedelta(hours=10)
    end = datetime.combine(today, datetime.min.time()) + timedelta(hours=18)
    # Break that is within shift range (valid)
    break_start = datetime.combine(today, datetime.min.time()) + timedelta(hours=12)
    break_end = datetime.combine(today, datetime.min.time()) + timedelta(hours=13)

    payload = {
        "therapist_id": str(therapist.id),
        "date": today.isoformat(),
        "start_at": start.isoformat(),
        "end_at": end.isoformat(),
        "break_slots": [
            {"start_at": break_start.isoformat(), "end_at": break_end.isoformat()}
        ],
    }

    res = client.post(f"/api/dashboard/shops/{profile.id}/shifts", json=payload)
    assert res.status_code == 201
    body = res.json()
    assert len(body["break_slots"]) == 1


def test_update_shift_break_slots_outside_range_rejected():
    """Reject shift update with break slots outside shift range."""
    user = DummyUser()
    profile = DummyProfile()
    therapist = DummyTherapist(profile_id=profile.id)
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)

    today = date.today()
    start = datetime.combine(today, datetime.min.time()) + timedelta(hours=10)
    end = datetime.combine(today, datetime.min.time()) + timedelta(hours=18)

    shift = DummyShift(
        therapist_id=therapist.id,
        shop_id=profile.id,
        shift_date=today,
        start_at=start,
        end_at=end,
    )
    session = DummySession(
        profile=profile,
        therapists=[therapist],
        shifts=[shift],
        shop_managers=[shop_manager],
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    # Break that ends AFTER shift end (invalid)
    break_start = datetime.combine(today, datetime.min.time()) + timedelta(hours=17)
    break_end = datetime.combine(today, datetime.min.time()) + timedelta(hours=19)

    payload = {
        "break_slots": [
            {"start_at": break_start.isoformat(), "end_at": break_end.isoformat()}
        ],
    }

    res = client.patch(
        f"/api/dashboard/shops/{profile.id}/shifts/{shift.id}", json=payload
    )
    # Should be rejected due to break outside shift range
    assert res.status_code == 400
    assert "break slot" in res.json()["detail"].lower()


def test_list_shifts_with_date_filter():
    """Filter shifts by date range."""
    user = DummyUser()
    profile = DummyProfile()
    therapist = DummyTherapist(profile_id=profile.id)
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)

    today = date.today()
    tomorrow = today + timedelta(days=1)

    shift1 = DummyShift(
        therapist_id=therapist.id,
        shop_id=profile.id,
        shift_date=today,
    )
    shift2 = DummyShift(
        therapist_id=therapist.id,
        shop_id=profile.id,
        shift_date=tomorrow,
    )
    session = DummySession(
        profile=profile,
        therapists=[therapist],
        shifts=[shift1, shift2],
        shop_managers=[shop_manager],
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(
        f"/api/dashboard/shops/{profile.id}/shifts",
        params={"date_from": today.isoformat(), "date_to": today.isoformat()},
    )
    assert res.status_code == 200
