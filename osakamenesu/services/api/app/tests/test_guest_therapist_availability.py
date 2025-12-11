from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from app.utils.datetime import JST
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.domains.site import therapist_availability as domain
from app.db import get_session

THERAPIST_ID = uuid4()


class DummyResult:
    """Mock result that returns None for scalar_one_or_none()."""

    def scalar_one_or_none(self):
        return None


class DummySession:
    """Mock session with execute method that returns dummy result."""

    async def execute(self, stmt):
        return DummyResult()


def setup_function() -> None:
    app.dependency_overrides[get_session] = lambda: DummySession()


def teardown_function() -> None:
    app.dependency_overrides.pop(get_session, None)


def _shift(day: date, start_hour: int, end_hour: int) -> SimpleNamespace:
    """Create a shift in JST timezone (matching production behavior)."""
    start = datetime.combine(day, datetime.min.time(), tzinfo=JST) + timedelta(
        hours=start_hour
    )
    end = datetime.combine(day, datetime.min.time(), tzinfo=JST) + timedelta(
        hours=end_hour
    )
    return SimpleNamespace(
        therapist_id=THERAPIST_ID,
        date=day,
        start_at=start,
        end_at=end,
        break_slots=[],
        availability_status="available",
    )


def _reservation(
    day: date, start_hour: int, end_hour: int, status: str = "confirmed"
) -> SimpleNamespace:
    """Create a reservation in JST timezone (matching production behavior)."""
    start = datetime.combine(day, datetime.min.time(), tzinfo=JST) + timedelta(
        hours=start_hour
    )
    end = datetime.combine(day, datetime.min.time(), tzinfo=JST) + timedelta(
        hours=end_hour
    )
    return SimpleNamespace(start_at=start, end_at=end, status=status)


client = TestClient(app)


def test_availability_summary_with_open_slots(monkeypatch: pytest.MonkeyPatch) -> None:
    day = date(2025, 1, 1)
    shift = _shift(day, 10, 12)

    # domain module uses 4 args: (db, therapist_id, date_from, date_to)
    async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
        assert therapist_id == THERAPIST_ID
        assert date_from == day
        assert date_to == day
        return [shift]

    async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
        return []

    async def fake_fetch_availability_slots_batch(
        db, profile_id, therapist_id, date_from, date_to
    ):
        return {}

    monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
    monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)
    monkeypatch.setattr(
        domain, "_fetch_availability_slots_batch", fake_fetch_availability_slots_batch
    )

    res = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/availability_summary",
        params={"date_from": str(day), "date_to": str(day)},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["items"][0]["has_available"] is True

    detail = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
        params={"date": str(day)},
    )
    assert detail.status_code == 200
    slots = detail.json()["slots"]
    assert len(slots) == 1
    assert slots[0]["start_at"].startswith("2025-01-01T10:00")


def test_availability_summary_full_day_booked(monkeypatch: pytest.MonkeyPatch) -> None:
    day = date(2025, 1, 2)
    shift = _shift(day, 10, 12)
    resv = _reservation(day, 10, 12, status="confirmed")

    # domain module uses 4 args
    async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
        return [shift]

    async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
        return [resv]

    async def fake_fetch_availability_slots_batch(
        db, profile_id, therapist_id, date_from, date_to
    ):
        return {}

    monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
    monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)
    monkeypatch.setattr(
        domain, "_fetch_availability_slots_batch", fake_fetch_availability_slots_batch
    )

    res = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/availability_summary",
        params={"date_from": str(day), "date_to": str(day)},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["items"][0]["has_available"] is False

    detail = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
        params={"date": str(day)},
    )
    assert detail.status_code == 200
    assert detail.json()["slots"] == []


def test_slots_reopen_after_cancel(monkeypatch: pytest.MonkeyPatch) -> None:
    day = date(2025, 1, 3)
    shift = _shift(day, 10, 12)

    # domain module uses 4 args
    async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
        return [shift]

    monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)

    # First: pending reservation blocks the slot.
    async def pending_reservations(db, therapist_id, start_at, end_at):
        return [_reservation(day, 10, 12, status="pending")]

    monkeypatch.setattr(domain, "_fetch_reservations", pending_reservations)
    blocked = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
        params={"date": str(day)},
    )
    assert blocked.status_code == 200
    assert blocked.json()["slots"] == []

    # Then: after cancel (reservations list empty), slot reappears.
    async def no_reservations(db, therapist_id, start_at, end_at):
        return []

    monkeypatch.setattr(domain, "_fetch_reservations", no_reservations)
    reopened = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
        params={"date": str(day)},
    )
    assert reopened.status_code == 200
    slots = reopened.json()["slots"]
    assert len(slots) == 1
    assert slots[0]["start_at"].startswith("2025-01-03T10:00")


def test_shift_with_different_time_returns_correct_slots(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Test that TherapistShift with 14:00-18:00 returns those exact times (not 10:00).
    This verifies that shift data is correctly reflected in the API response.
    """
    day = date(2025, 1, 5)
    # Create a shift with 14:00-18:00 (different from the usual 10:00)
    shift = _shift(day, 14, 18)

    async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
        return [shift]

    async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
        return []

    monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
    monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

    res = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
        params={"date": str(day)},
    )
    assert res.status_code == 200
    slots = res.json()["slots"]
    assert len(slots) == 1
    # Verify the shift time (14:00-18:00) is returned, not a default value
    assert slots[0]["start_at"].startswith("2025-01-05T14:00")
    assert slots[0]["end_at"].startswith("2025-01-05T18:00")


def test_availability_fallback_to_availability_table(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Test that when TherapistShift has no data, the API falls back to Availability table.
    This tests the profile_id fallback path (when therapist_id is actually a profile_id).
    """
    day = date(2025, 1, 4)
    profile_id = THERAPIST_ID  # In this case, therapist_id IS the profile_id

    # No TherapistShift data
    async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
        return []

    async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
        return []

    # Mock _fetch_availability_slots to return fallback data with different time (13:00-17:00 JST)
    fallback_start = datetime.combine(day, datetime.min.time(), tzinfo=JST) + timedelta(
        hours=13
    )
    fallback_end = datetime.combine(day, datetime.min.time(), tzinfo=JST) + timedelta(
        hours=17
    )

    async def fake_fetch_availability_slots(db, pid, therapist_id, target_date):
        # Only return data when profile_id matches
        if pid == profile_id:
            return [(fallback_start, fallback_end)]
        return []

    monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
    monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)
    monkeypatch.setattr(
        domain, "_fetch_availability_slots", fake_fetch_availability_slots
    )

    res = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
        params={"date": str(day)},
    )
    assert res.status_code == 200
    slots = res.json()["slots"]
    assert len(slots) == 1
    # Verify the fallback time (13:00) is returned, not the default (10:00)
    assert slots[0]["start_at"].startswith("2025-01-04T13:00")
    assert slots[0]["end_at"].startswith("2025-01-04T17:00")
