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
from app.utils.cache import availability_cache

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
    # Clear availability cache before each test to avoid cross-test pollution
    # Use synchronous approach (clear internal dict directly) for Python 3.10+ compatibility
    availability_cache._cache.clear()


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
    day = date(2030, 1, 1)  # Use future date to avoid past slot filtering
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
    assert slots[0]["start_at"].startswith("2030-01-01T10:00")


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
    day = date(2030, 1, 3)
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
    # Clear cache to simulate what happens when a reservation is cancelled
    availability_cache._cache.clear()

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
    assert slots[0]["start_at"].startswith("2030-01-03T10:00")


def test_shift_with_different_time_returns_correct_slots(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Test that TherapistShift with 14:00-18:00 returns those exact times (not 10:00).
    This verifies that shift data is correctly reflected in the API response.
    """
    day = date(2030, 1, 5)
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
    assert slots[0]["start_at"].startswith("2030-01-05T14:00")
    assert slots[0]["end_at"].startswith("2030-01-05T18:00")


def test_multiple_shifts_same_day(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Test that when a therapist has multiple shifts on the same day,
    availability is correctly calculated for each shift.
    """
    day = date(2030, 1, 6)
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
    assert slots[0]["start_at"].startswith("2030-01-06T09:00")
    assert slots[0]["end_at"].startswith("2030-01-06T12:00")
    # Afternoon slot
    assert slots[1]["start_at"].startswith("2030-01-06T14:00")
    assert slots[1]["end_at"].startswith("2030-01-06T18:00")


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
    day = date(2030, 1, 10)
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
    # Final Decision: API returns "open" | "blocked" only (tentative is UI-only)
    assert "status" in slots[0]
    assert slots[0]["status"] in ("open", "blocked")


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
    day = date(2030, 1, 21)  # Use future date to avoid past slot filtering
    shift = _shift(day, 10, 14)
    resv = _reservation(day, 10, 12, status="confirmed")

    async def fake_resolve_therapist_id(db, therapist_id_or_name):
        return THERAPIST_ID

    async def fake_list_daily_slots(db, therapist_id, target_date):
        # Return slots after reservation subtraction - the 10-12 slot is blocked
        # Only 12-14 is available
        slot_start = datetime.combine(day, datetime.min.time(), tzinfo=JST) + timedelta(
            hours=12
        )
        slot_end = datetime.combine(day, datetime.min.time(), tzinfo=JST) + timedelta(
            hours=14
        )
        return [(slot_start, slot_end)]

    monkeypatch.setattr(domain, "_resolve_therapist_id", fake_resolve_therapist_id)
    monkeypatch.setattr(domain, "_list_daily_slots", fake_list_daily_slots)

    # Query for slot at 10:00 JST (which is now reserved and not in available slots)
    start_at = datetime(2030, 1, 21, 10, 0, 0, tzinfo=JST)
    res = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/verify_slot",
        params={"start_at": start_at.isoformat()},
    )
    assert res.status_code == 409
    body = res.json()["detail"]
    assert body["detail"] == "slot_unavailable"
    assert body["status"] == "blocked"
    assert "conflicted_at" in body


# =============================================================================
# Final Decision Tests
# =============================================================================


def test_api_contract_status_no_tentative(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Final Decision: API response must NOT include 'tentative' status.
    tentative is UI-only state.
    """
    day = date(2030, 1, 10)
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

    # Verify no slot has 'tentative' status
    for slot in slots:
        assert slot["status"] != "tentative", "API must not return tentative status"
        assert slot["status"] in ("open", "blocked")


def test_break_slots_iso_format() -> None:
    """
    Final Decision: break_slots with ISO 8601 format (start_at/end_at).
    """
    from app.domains.site.therapist_availability import _parse_breaks

    shift_date = date(2025, 1, 15)
    break_slots = [
        {
            "start_at": "2025-01-15T12:00:00+09:00",
            "end_at": "2025-01-15T12:30:00+09:00",
        }
    ]

    result = _parse_breaks(break_slots, shift_date)
    assert len(result) == 1
    start, end = result[0]
    assert start.hour == 12
    assert start.minute == 0
    assert end.hour == 12
    assert end.minute == 30


def test_break_slots_legacy_hhmm_format() -> None:
    """
    Final Decision: break_slots with legacy HH:MM format (start_time/end_time).
    Should fallback when ISO format is not available.
    """
    from app.domains.site.therapist_availability import _parse_breaks

    shift_date = date(2025, 1, 15)
    break_slots = [
        {
            "start_time": "12:00",
            "end_time": "13:00",
            "description": "昼休憩",
        }
    ]

    result = _parse_breaks(break_slots, shift_date)
    assert len(result) == 1
    start, end = result[0]
    assert start.hour == 12
    assert start.minute == 0
    assert end.hour == 13
    assert end.minute == 0


def test_break_slots_iso_priority_over_legacy() -> None:
    """
    Final Decision: ISO format takes priority over legacy HH:MM format.
    """
    from app.domains.site.therapist_availability import _parse_breaks

    shift_date = date(2025, 1, 15)
    # Both formats provided - ISO should win
    break_slots = [
        {
            "start_at": "2025-01-15T14:00:00+09:00",
            "end_at": "2025-01-15T14:30:00+09:00",
            "start_time": "12:00",  # Should be ignored
            "end_time": "13:00",  # Should be ignored
        }
    ]

    result = _parse_breaks(break_slots, shift_date)
    assert len(result) == 1
    start, end = result[0]
    # Should use ISO format (14:00-14:30), not legacy (12:00-13:00)
    assert start.hour == 14
    assert start.minute == 0
    assert end.hour == 14
    assert end.minute == 30


def test_status_mapping_available_to_open() -> None:
    """
    Final Decision: DB status 'available' should map to API status 'open'.
    """
    from app.domains.site.services.shop.availability import convert_slots

    slots_json = [
        {
            "start_at": "2025-01-15T10:00:00+09:00",
            "end_at": "2025-01-15T11:00:00+09:00",
            "status": "available",  # DB status
        }
    ]

    result = convert_slots(slots_json)
    assert len(result) == 1
    assert result[0].status == "open"  # API status


def test_status_mapping_busy_to_blocked() -> None:
    """
    Final Decision: DB status 'busy' should map to API status 'blocked'.
    """
    from app.domains.site.services.shop.availability import convert_slots

    slots_json = [
        {
            "start_at": "2025-01-15T10:00:00+09:00",
            "end_at": "2025-01-15T11:00:00+09:00",
            "status": "busy",  # DB status
        }
    ]

    result = convert_slots(slots_json)
    assert len(result) == 1
    assert result[0].status == "blocked"  # API status


def _overnight_shift(
    start_day: date, start_hour: int, end_hour: int
) -> SimpleNamespace:
    """Create an overnight shift (e.g., 19:00-07:00 next day) in JST timezone."""
    start = datetime.combine(start_day, datetime.min.time(), tzinfo=JST) + timedelta(
        hours=start_hour
    )
    # end_hour > 24 means next day (e.g., 31 = 07:00 next day)
    end = datetime.combine(start_day, datetime.min.time(), tzinfo=JST) + timedelta(
        hours=end_hour
    )
    return SimpleNamespace(
        therapist_id=THERAPIST_ID,
        date=start_day,  # date column is the start date
        start_at=start,
        end_at=end,
        break_slots=[],
        availability_status="available",
    )


def test_overnight_shift_shows_on_next_day(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Test that overnight shifts (e.g., 19:00-07:00 next day) appear correctly
    on both the start day and the next day's availability.

    Scenario:
    - Shift on Jan 15: 19:00 JST - 07:00 JST (Jan 16)
    - Query for Jan 16 should show 00:00-07:00 JST as available
    """
    day_15 = date(2030, 1, 15)
    day_16 = date(2030, 1, 16)

    # Overnight shift: starts Jan 15 19:00, ends Jan 16 07:00 (31 hours from midnight)
    overnight_shift = _overnight_shift(day_15, 19, 31)  # 31 = 24 + 7

    async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
        # Simulate the fixed query that includes overnight shifts
        shifts = []
        # If querying for Jan 16, include Jan 15's overnight shift
        if date_from <= day_16 <= date_to or date_from == day_16:
            if overnight_shift.end_at.date() >= date_from:
                shifts.append(overnight_shift)
        # If querying for Jan 15, include the shift
        if date_from <= day_15 <= date_to:
            shifts.append(overnight_shift)
        return shifts

    async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
        return []

    monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
    monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

    # Query for Jan 16 - should show 00:00-07:00 from overnight shift
    res = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
        params={"date": str(day_16)},
    )
    assert res.status_code == 200
    slots = res.json()["slots"]

    # Should have at least one slot for the morning portion
    assert len(slots) >= 1

    # First slot should start at 00:00 JST (15:00 UTC previous day)
    first_slot = slots[0]
    start_dt = datetime.fromisoformat(first_slot["start_at"].replace("Z", "+00:00"))
    start_jst = start_dt.astimezone(JST)
    assert start_jst.hour == 0
    assert start_jst.day == 16

    # Should end at 07:00 JST
    end_dt = datetime.fromisoformat(first_slot["end_at"].replace("Z", "+00:00"))
    end_jst = end_dt.astimezone(JST)
    assert end_jst.hour == 7
    assert end_jst.day == 16


def test_overnight_shift_summary_shows_both_days(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Test that availability_summary correctly shows overnight shifts on both days.

    Scenario:
    - Shift on Jan 15: 19:00 JST - 07:00 JST (Jan 16)
    - Query for Jan 15-16 should show both days as having availability
    """
    day_15 = date(2030, 1, 15)
    day_16 = date(2030, 1, 16)

    # Overnight shift: starts Jan 15 19:00, ends Jan 16 07:00
    overnight_shift = _overnight_shift(day_15, 19, 31)  # 31 = 24 + 7

    async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
        # Return the overnight shift for the range
        return [overnight_shift]

    async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
        return []

    monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
    monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

    # Query for Jan 15-16 summary
    res = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/availability_summary",
        params={"date_from": str(day_15), "date_to": str(day_16)},
    )
    assert res.status_code == 200
    items = res.json()["items"]

    # Both days should show as having availability
    assert len(items) == 2

    # Jan 15 should have availability (19:00-00:00)
    jan_15_item = next(item for item in items if item["date"] == str(day_15))
    assert jan_15_item["has_available"] is True

    # Jan 16 should also have availability (00:00-07:00 from overnight shift)
    jan_16_item = next(item for item in items if item["date"] == str(day_16))
    assert jan_16_item["has_available"] is True


def test_past_slots_are_filtered_out(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Test that completely past slots are not returned in the response.

    Uses a future date to ensure the slot is completely past relative to "now".
    """
    # Use a past date with a shift from 10:00-14:00
    day = date(2020, 1, 15)  # Past date
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

    # Should have no slots since the entire shift is in the past
    assert len(slots) == 0


def test_future_slots_are_not_filtered(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Test that future slots are returned without modification.
    """
    # Use a future date
    day = date(2030, 6, 15)
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

    # Should have one slot
    assert len(slots) == 1

    # Slot should start at 10:00 (unchanged)
    slot = slots[0]
    start_dt = datetime.fromisoformat(slot["start_at"].replace("Z", "+00:00"))
    start_jst = start_dt.astimezone(JST)
    assert start_jst.hour == 10

    # Slot should end at 14:00 (unchanged)
    end_dt = datetime.fromisoformat(slot["end_at"].replace("Z", "+00:00"))
    end_jst = end_dt.astimezone(JST)
    assert end_jst.hour == 14


def test_availability_summary_today_filters_past_slots(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Test that availability_summary for today's date filters out past slots.

    Scenario:
    - Query availability_summary for today
    - All slots are in the past (earlier today)
    - has_available should be False
    """
    from datetime import datetime as dt

    now = dt.now(JST)
    today = now.date()

    # Create a shift that ended earlier today
    past_hour = max(0, now.hour - 2)
    past_end_hour = max(1, now.hour - 1)
    if past_hour >= past_end_hour:
        # If we're at the beginning of the day, create a past shift anyway
        past_hour = 0
        past_end_hour = 1

    # Only run this test if we can create a past slot today
    if now.hour < 2:
        pytest.skip("Cannot create past slots early in the day")

    shift = _shift(today, past_hour, past_end_hour)

    async def fake_fetch_therapist_with_buffer(db, therapist_id):
        return None, 0, None

    async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
        if date_from <= today <= date_to:
            return [shift]
        return []

    async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
        return []

    monkeypatch.setattr(
        domain, "_fetch_therapist_with_buffer", fake_fetch_therapist_with_buffer
    )
    monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
    monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

    res = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/availability_summary",
        params={"date_from": str(today), "date_to": str(today)},
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    # Past slots should be filtered, so has_available should be False
    assert items[0]["has_available"] is False


def test_verify_slot_rejects_past_start_time(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Test that verify_slot returns 409 for start_at times in the past.
    """
    from datetime import datetime as dt

    now = dt.now(JST)
    # Create a start_at that is 1 hour in the past
    past_start = now - timedelta(hours=1)

    async def fake_resolve_therapist_id(db, therapist_id_or_name):
        return THERAPIST_ID

    monkeypatch.setattr(domain, "_resolve_therapist_id", fake_resolve_therapist_id)

    res = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/verify_slot",
        params={"start_at": past_start.isoformat()},
    )
    assert res.status_code == 409
    detail = res.json()["detail"]
    assert detail["detail"] == "slot_unavailable"
    assert detail["status"] == "past"


def test_verify_slot_accepts_future_start_time(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Test that verify_slot accepts start_at times in the future.
    """
    from datetime import datetime as dt

    # Use a future date to avoid issues
    future_day = date(2030, 6, 15)
    future_start = datetime.combine(
        future_day, datetime.min.time(), tzinfo=JST
    ) + timedelta(hours=10)
    future_end = future_start + timedelta(hours=2)

    shift = _shift(future_day, 10, 14)

    async def fake_resolve_therapist_id(db, therapist_id_or_name):
        return THERAPIST_ID

    async def fake_list_daily_slots(db, therapist_id, target_date):
        if target_date == future_day:
            return [(future_start, future_end)]
        return []

    monkeypatch.setattr(domain, "_resolve_therapist_id", fake_resolve_therapist_id)
    monkeypatch.setattr(domain, "_list_daily_slots", fake_list_daily_slots)

    res = client.get(
        f"/api/guest/therapists/{THERAPIST_ID}/verify_slot",
        params={"start_at": future_start.isoformat()},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_available"] is True
    assert data["status"] == "open"
