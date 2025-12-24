from __future__ import annotations

from datetime import datetime, timezone, timedelta
from uuid import uuid4

import pytest

from app.domains.site import guest_reservations as domain
from app.domains.site.guest_reservations import (
    cancel_guest_reservation,
    create_guest_reservation,
)
from app.models import GuestReservation


def _ts(hour: int, minute: int = 0) -> datetime:
    return datetime(2025, 1, 1, hour, minute, tzinfo=timezone.utc)


class MockProfile:
    """Mock profile for testing."""

    room_count = 1


class DummyResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class DummySession:
    def __init__(self):
        self.reservations: list[GuestReservation] = []

    async def execute(self, stmt):
        entity = stmt.column_descriptions[0]["entity"]
        if entity is GuestReservation:
            lookup_id = None
            try:
                crit = list(getattr(stmt, "_where_criteria", []))
                if crit:
                    right = getattr(crit[0], "right", None)
                    lookup_id = getattr(right, "value", None)
            except Exception:
                lookup_id = None
            if lookup_id:
                found = next(
                    (r for r in self.reservations if str(r.id) == str(lookup_id)), None
                )
                return DummyResult(found)
            return DummyResult(None)
        return DummyResult(None)

    def add(self, obj):
        if isinstance(obj, GuestReservation):
            # replace existing with same id or append
            self.reservations = [
                r for r in self.reservations if str(r.id) != str(obj.id)
            ] + [obj]

    async def commit(self):
        return None

    async def refresh(self, obj, attribute_names=None):
        return None


@pytest.mark.asyncio
async def test_create_cancel_and_recreate(monkeypatch: pytest.MonkeyPatch):
    session = DummySession()
    therapist_id = uuid4()
    shift_start = _ts(9)
    shift_end = _ts(18)

    def _overlaps(
        a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime
    ) -> bool:
        return a_start < b_end and b_start < a_end

    async def fake_is_available(db, tid, start_at, end_at, lock=False):
        if str(tid) != str(therapist_id):
            return False, {"rejected_reasons": ["no_shift"]}
        if not (shift_start <= start_at and end_at <= shift_end):
            return False, {"rejected_reasons": ["no_shift"]}
        for res in session.reservations:
            if str(res.therapist_id) != str(therapist_id):
                continue
            if str(res.status) in ("pending", "confirmed") and _overlaps(
                start_at, end_at, res.start_at, res.end_at
            ):
                return False, {"rejected_reasons": ["overlap_existing_reservation"]}
        return True, {"rejected_reasons": []}

    async def _fetch_profile(db, shop_id):
        return MockProfile()

    monkeypatch.setattr(domain, "is_available", fake_is_available)
    monkeypatch.setattr(domain, "_try_fetch_profile", _fetch_profile)

    payload = {
        "shop_id": uuid4(),
        "therapist_id": therapist_id,
        "start_at": _ts(10),
        "end_at": _ts(11),
    }

    res, debug = await create_guest_reservation(session, payload, now=_ts(8))
    assert res is not None
    assert str(res.status) == "confirmed"
    assert debug == {}
    assert len(session.reservations) == 1

    overlap_payload = {
        "shop_id": uuid4(),
        "therapist_id": therapist_id,
        "start_at": _ts(10, 30),
        "end_at": _ts(11, 30),
    }
    res2, debug2 = await create_guest_reservation(session, overlap_payload, now=_ts(8))
    assert res2 is None
    assert "overlap_existing_reservation" in debug2.get("rejected_reasons", [])

    cancelled = await cancel_guest_reservation(session, res.id, reason="user_cancelled")
    assert cancelled and str(cancelled.status) == "cancelled"

    res3, debug3 = await create_guest_reservation(session, overlap_payload, now=_ts(8))
    assert res3 is not None
    assert debug3 == {}
    assert str(res3.status) == "confirmed"
