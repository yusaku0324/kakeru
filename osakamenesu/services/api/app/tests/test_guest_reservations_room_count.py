import os

# DATABASE_URL を asyncpg に固定してから app.* を import する
os.environ["DATABASE_URL"] = "postgresql+asyncpg://app:app@localhost:5432/osaka_menesu"

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.domains.site import guest_reservations as domain
from app.domains.site.guest_reservations import (
    create_guest_reservation,
    create_guest_reservation_hold,
)
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


class CreateSession:
    def __init__(self, reservations):
        self._reservations = reservations
        self.items: list[GuestReservation] = []

    async def execute(self, stmt):
        entity = stmt.column_descriptions[0]["entity"]
        if entity is GuestReservation:
            return _ScalarsResult(self._reservations)
        return _ScalarResult(None)

    def add(self, obj):
        if isinstance(obj, GuestReservation):
            self.items.append(obj)

    async def commit(self):
        return None

    async def refresh(self, obj):
        return None

    async def rollback(self):
        return None


class HoldSession(CreateSession):
    async def execute(self, stmt):
        entity = stmt.column_descriptions[0]["entity"]
        if entity is GuestReservation:
            criteria = list(getattr(stmt, "_where_criteria", []))
            for crit in criteria:
                left = getattr(crit, "left", None)
                if getattr(left, "name", None) == "idempotency_key":
                    return _ScalarResult(None)
            return _ScalarsResult(self._reservations)
        return _ScalarResult(None)


@pytest.mark.asyncio
async def test_room_count_one_blocks_cross_therapist_overlap(
    monkeypatch: pytest.MonkeyPatch,
):
    shop_id = uuid4()
    therapist_a = uuid4()
    therapist_b = uuid4()
    now = _ts(10)
    start_at = now + timedelta(hours=4)
    end_at = start_at + timedelta(hours=1)

    profile = SimpleNamespace(contact_json={}, room_count=1)

    async def _fetch_profile(_db, _shop_id):
        return profile

    monkeypatch.setattr(domain, "_try_fetch_profile", _fetch_profile)

    async def _avail(_db, _therapist_id, _start_at, _end_at, lock=False):
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(domain, "is_available", _avail)

    existing = GuestReservation(
        shop_id=shop_id,
        therapist_id=therapist_a,
        start_at=start_at,
        end_at=end_at,
        duration_minutes=60,
        planned_extension_minutes=0,
        buffer_minutes=0,
        status="confirmed",
    )

    session = CreateSession([existing])
    reservation, debug = await create_guest_reservation(
        session,
        {
            "shop_id": shop_id,
            "therapist_id": therapist_b,
            "start_at": start_at,
            "duration_minutes": 60,
            "planned_extension_minutes": 0,
        },
        now=now,
    )
    assert reservation is None
    assert "room_full" in (debug.get("rejected_reasons") or [])


@pytest.mark.asyncio
async def test_room_count_two_allows_second_overlap(monkeypatch: pytest.MonkeyPatch):
    shop_id = uuid4()
    therapist_a = uuid4()
    therapist_b = uuid4()
    now = _ts(10)
    start_at = now + timedelta(hours=4)
    end_at = start_at + timedelta(hours=1)

    profile = SimpleNamespace(contact_json={}, room_count=2)

    async def _fetch_profile(_db, _shop_id):
        return profile

    monkeypatch.setattr(domain, "_try_fetch_profile", _fetch_profile)

    async def _avail(_db, _therapist_id, _start_at, _end_at, lock=False):
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(domain, "is_available", _avail)

    existing = GuestReservation(
        shop_id=shop_id,
        therapist_id=therapist_a,
        start_at=start_at,
        end_at=end_at,
        duration_minutes=60,
        planned_extension_minutes=0,
        buffer_minutes=0,
        status="confirmed",
    )

    session = CreateSession([existing])
    reservation, debug = await create_guest_reservation(
        session,
        {
            "shop_id": shop_id,
            "therapist_id": therapist_b,
            "start_at": start_at,
            "duration_minutes": 60,
            "planned_extension_minutes": 0,
        },
        now=now,
    )
    assert reservation is not None
    assert debug == {}


@pytest.mark.asyncio
async def test_reserved_hold_counts_toward_room_capacity(
    monkeypatch: pytest.MonkeyPatch,
):
    shop_id = uuid4()
    therapist_a = uuid4()
    therapist_b = uuid4()
    now = _ts(10)
    start_at = now + timedelta(hours=4)
    end_at = start_at + timedelta(hours=1)

    profile = SimpleNamespace(contact_json={}, room_count=1)

    async def _fetch_profile(_db, _shop_id):
        return profile

    monkeypatch.setattr(domain, "_try_fetch_profile", _fetch_profile)

    async def _avail(_db, _therapist_id, _start_at, _end_at, lock=False):
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(domain, "is_available", _avail)

    active_hold = GuestReservation(
        shop_id=shop_id,
        therapist_id=therapist_a,
        start_at=start_at,
        end_at=end_at,
        duration_minutes=60,
        planned_extension_minutes=0,
        buffer_minutes=0,
        status="reserved",
        reserved_until=now + timedelta(minutes=10),
    )

    session = HoldSession([active_hold])
    reservation, debug, err = await create_guest_reservation_hold(
        session,
        {
            "shop_id": shop_id,
            "therapist_id": therapist_b,
            "start_at": start_at,
            "duration_minutes": 60,
            "planned_extension_minutes": 0,
        },
        idempotency_key="k-room-full",
        now=now,
    )
    assert err is None
    assert reservation is None
    assert "room_full" in (debug.get("rejected_reasons") or [])


@pytest.mark.asyncio
async def test_expired_reserved_hold_does_not_count(monkeypatch: pytest.MonkeyPatch):
    shop_id = uuid4()
    therapist_a = uuid4()
    therapist_b = uuid4()
    now = _ts(10)
    start_at = now + timedelta(hours=4)
    end_at = start_at + timedelta(hours=1)

    profile = SimpleNamespace(contact_json={}, room_count=1)

    async def _fetch_profile(_db, _shop_id):
        return profile

    monkeypatch.setattr(domain, "_try_fetch_profile", _fetch_profile)

    async def _avail(_db, _therapist_id, _start_at, _end_at, lock=False):
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(domain, "is_available", _avail)

    expired_hold = GuestReservation(
        shop_id=shop_id,
        therapist_id=therapist_a,
        start_at=start_at,
        end_at=end_at,
        duration_minutes=60,
        planned_extension_minutes=0,
        buffer_minutes=0,
        status="reserved",
        reserved_until=now - timedelta(minutes=10),
    )

    session = HoldSession([expired_hold])
    reservation, debug, err = await create_guest_reservation_hold(
        session,
        {
            "shop_id": shop_id,
            "therapist_id": therapist_b,
            "start_at": start_at,
            "duration_minutes": 60,
            "planned_extension_minutes": 0,
        },
        idempotency_key="k-ok",
        now=now,
    )
    assert err is None
    assert reservation is not None
    assert debug == {}
