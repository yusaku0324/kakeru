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

    monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
    monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

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

    monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
    monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

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


def test_multiple_shifts_same_day(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Test that when a therapist has multiple shifts on the same day,
    availability is correctly calculated for each shift.
    """
    day = date(2025, 1, 6)
    # Morning shift: 9:00-12:00
    morning_shift = _shift(day, 9, 12)
    # Afternoon shift: 14:00-18:00
    afternoon_shift = _shift(day, 14, 18)

    async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
        return [morning_shift, afternoon_shift]

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
    # Should have 2 available slots (morning and afternoon)
    assert len(slots) == 2
    # Morning slot
    assert slots[0]["start_at"].startswith("2025-01-06T09:00")
    assert slots[0]["end_at"].startswith("2025-01-06T12:00")
    # Afternoon slot
    assert slots[1]["start_at"].startswith("2025-01-06T14:00")
    assert slots[1]["end_at"].startswith("2025-01-06T18:00")


def test_no_shifts_returns_empty_slots(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Test that when TherapistShift has no data, the API returns empty slots.

    SoT Compliance: TherapistShift + GuestReservation is the source of truth.
    When there are no shifts, there are no available slots - regardless of
    what may be in Availability.slots_json (which is for admin use only).
    """
    day = date(2025, 1, 4)

    # No TherapistShift data
    async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
        return []

    async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
        return []

    monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
    monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

    res = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
        params={"date": str(day)},
    )
    assert res.status_code == 200
    assert res.json()["slots"] == []


def test_availability_slots_includes_status_field(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Test that AvailabilitySlotsResponse includes status field for each slot.

    Phase 1 requirement: API response must include status field.
    """
    day = date(2025, 1, 10)
    shift = _shift(day, 10, 14)

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

    # Verify status field exists and has valid value
    assert "status" in slots[0]
    assert slots[0]["status"] in ("open", "tentative", "blocked")


def test_determine_slot_status_past_returns_blocked() -> None:
    """
    Test that determine_slot_status returns 'blocked' for past slots.
    """
    from app.domains.site.therapist_availability import determine_slot_status

    # Create a slot that ended in the past
    now = datetime(2025, 1, 15, 12, 0, 0, tzinfo=JST)
    slot_start = datetime(2025, 1, 15, 9, 0, 0, tzinfo=JST)
    slot_end = datetime(
        2025, 1, 15, 11, 0, 0, tzinfo=JST
    )  # Ended at 11:00, now is 12:00

    status = determine_slot_status(slot_start, slot_end, now)
    assert status == "blocked"


def test_determine_slot_status_future_returns_open() -> None:
    """
    Test that determine_slot_status returns 'open' for future slots.
    """
    from app.domains.site.therapist_availability import determine_slot_status

    # Create a slot in the future
    now = datetime(2025, 1, 15, 10, 0, 0, tzinfo=JST)
    slot_start = datetime(2025, 1, 15, 14, 0, 0, tzinfo=JST)
    slot_end = datetime(2025, 1, 15, 16, 0, 0, tzinfo=JST)

    status = determine_slot_status(slot_start, slot_end, now)
    assert status == "open"


def test_verify_slot_returns_available(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Test that verify_slot API returns 200 for available slot.
    """
    # Use a future date to ensure slot is not blocked
    day = date(2030, 1, 20)
    shift = _shift(day, 10, 14)

    async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
        return [shift]

    async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
        return []

    monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
    monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

    # Query for slot at 10:00 JST
    start_at = datetime(2030, 1, 20, 10, 0, 0, tzinfo=JST)
    res = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/verify_slot",
        params={"start_at": start_at.isoformat()},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["is_available"] is True
    assert body["status"] == "open"
    assert "verified_at" in body


def test_verify_slot_returns_409_when_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Test that verify_slot API returns 409 when slot is no longer available.
    """
    day = date(2025, 1, 21)
    shift = _shift(day, 10, 14)
    resv = _reservation(day, 10, 12, status="confirmed")

    async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
        return [shift]

    async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
        return [resv]  # Slot is blocked by reservation

    monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
    monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

    # Query for slot at 10:00 JST (which is now reserved)
    start_at = datetime(2025, 1, 21, 10, 0, 0, tzinfo=JST)
    res = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/verify_slot",
        params={"start_at": start_at.isoformat()},
    )
    assert res.status_code == 409
    body = res.json()["detail"]
    assert body["detail"] == "slot_unavailable"
    assert body["status"] == "blocked"
    assert "conflicted_at" in body
