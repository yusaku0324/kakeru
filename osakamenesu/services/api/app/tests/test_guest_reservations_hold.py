import os

# DATABASE_URL を asyncpg に固定してから app.* を import する
os.environ["DATABASE_URL"] = "postgresql+asyncpg://app:app@localhost:5432/osaka_menesu"

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.domains.site import guest_reservations as domain
from app.domains.site.guest_reservations import create_guest_reservation_hold
from app.domains.site import therapist_availability as availability
from app.models import GuestReservation


def _ts(hour: int, minute: int = 0) -> datetime:
    return datetime(2025, 1, 1, hour, minute, 0, tzinfo=timezone.utc)


class _ScalarResult:
    def __init__(self, scalar_value=None):
        self._scalar_value = scalar_value

    def scalar_one_or_none(self):
        return self._scalar_value


class _Scalars:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class _ScalarsResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return _Scalars(self._items)


class StubSession:
    def __init__(self):
        self.items: list[GuestReservation] = []
        self.by_idempotency_key: dict[str, GuestReservation] = {}

    async def execute(self, stmt):
        entity = stmt.column_descriptions[0]["entity"]
        if entity is GuestReservation:
            try:
                criteria = list(getattr(stmt, "_where_criteria", []))
            except Exception:
                criteria = []
            for crit in criteria:
                left = getattr(crit, "left", None)
                if getattr(left, "name", None) != "idempotency_key":
                    continue
                right = getattr(crit, "right", None)
                key = getattr(right, "value", None)
                if key is None:
                    continue
                return _ScalarResult(self.by_idempotency_key.get(str(key)))
        return _ScalarResult(None)

    def add(self, obj):
        if isinstance(obj, GuestReservation):
            self.items.append(obj)
            if obj.idempotency_key:
                self.by_idempotency_key[str(obj.idempotency_key)] = obj

    async def commit(self):
        return None

    async def refresh(self, obj):
        return None

    async def rollback(self):
        return None


@pytest.mark.asyncio
async def test_hold_idempotency_returns_same_reservation(
    monkeypatch: pytest.MonkeyPatch,
):
    async def _avail(db, therapist_id, start_at, end_at, lock=False):
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(domain, "is_available", _avail)

    session = StubSession()
    now = _ts(12)
    payload = {
        "shop_id": uuid4(),
        "therapist_id": uuid4(),
        "start_at": _ts(14),
        "duration_minutes": 60,
        "planned_extension_minutes": 0,
    }

    res1, debug1, err1 = await create_guest_reservation_hold(
        session, payload, idempotency_key="k1", now=now
    )
    assert err1 is None
    assert debug1 == {}
    assert res1 is not None
    assert str(res1.status) == "reserved"
    assert res1.reserved_until == now + timedelta(minutes=domain.HOLD_TTL_MINUTES)
    assert len(session.items) == 1

    res2, debug2, err2 = await create_guest_reservation_hold(
        session, payload, idempotency_key="k1", now=now
    )
    assert err2 is None
    assert debug2 == {}
    assert res2 is res1
    assert len(session.items) == 1


@pytest.mark.asyncio
async def test_hold_idempotency_conflict(monkeypatch: pytest.MonkeyPatch):
    async def _avail(db, therapist_id, start_at, end_at, lock=False):
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(domain, "is_available", _avail)

    session = StubSession()
    now = _ts(12)
    payload = {
        "shop_id": uuid4(),
        "therapist_id": uuid4(),
        "start_at": _ts(14),
        "duration_minutes": 60,
        "planned_extension_minutes": 0,
    }
    res1, debug1, err1 = await create_guest_reservation_hold(
        session, payload, idempotency_key="k2", now=now
    )
    assert err1 is None
    assert debug1 == {}
    assert res1 is not None

    conflict_payload = dict(payload)
    conflict_payload["duration_minutes"] = 90
    res2, debug2, err2 = await create_guest_reservation_hold(
        session, conflict_payload, idempotency_key="k2", now=now
    )
    assert res2 is None
    assert err2 == "idempotency_key_conflict"
    assert "idempotency_key_conflict" in debug2.get("rejected_reasons", [])


@pytest.mark.asyncio
async def test_reserved_blocks_and_expired_does_not():
    therapist_id = uuid4()

    # NOTE: availability.has_overlapping_reservation fetches reservations via db.execute(),
    # so we provide a tiny session stub per case.
    class DummySession:
        def __init__(self, reservations):
            self._reservations = reservations

        async def execute(self, stmt):
            return _ScalarsResult(self._reservations)

    now = datetime.now(timezone.utc)
    start_at = now + timedelta(days=1)
    end_at = start_at + timedelta(hours=1)

    active_hold = GuestReservation(
        shop_id=uuid4(),
        therapist_id=therapist_id,
        start_at=start_at,
        end_at=end_at,
        duration_minutes=60,
        planned_extension_minutes=0,
        buffer_minutes=0,
        status="reserved",
        reserved_until=now + timedelta(minutes=10),
    )
    expired_hold = GuestReservation(
        shop_id=uuid4(),
        therapist_id=therapist_id,
        start_at=start_at,
        end_at=end_at,
        duration_minutes=60,
        planned_extension_minutes=0,
        buffer_minutes=0,
        status="reserved",
        reserved_until=now - timedelta(minutes=10),
    )

    assert (
        await availability.has_overlapping_reservation(
            DummySession([active_hold]),
            therapist_id,
            start_at,
            end_at,
        )
        is True
    )
    assert (
        await availability.has_overlapping_reservation(
            DummySession([expired_hold]),
            therapist_id,
            start_at,
            end_at,
        )
        is False
    )
