import os

# DATABASE_URL を asyncpg に固定してから app.* を import する
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://app:app@localhost:5432/osaka_menesu"
)

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.domains.site import therapist_availability as availability
from app.models import GuestReservation
from app.services.reservation_holds import expire_reserved_holds


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


class DummySession:
    def __init__(self, reservations):
        self._reservations = reservations

    async def execute(self, stmt):  # noqa: ARG002 - statement is not evaluated in this unit test
        return _ScalarsResult(self._reservations)


@pytest.mark.asyncio
async def test_expire_reserved_holds_defensive_null_reserved_until_unblocks():
    therapist_id = uuid4()
    now = datetime.now(timezone.utc)
    start_at = now + timedelta(days=1)
    end_at = start_at + timedelta(hours=1)

    # reserved_until が NULL の hold は created_at + 15分 でフォールバック判定される。
    # created_at が30分前の場合、has_overlapping_reservation では既に非アクティブ。
    # expire_reserved_holds はステータスを明示的に expired に更新する。
    hold = GuestReservation(
        id=uuid4(),
        shop_id=uuid4(),
        therapist_id=therapist_id,
        start_at=start_at,
        end_at=end_at,
        duration_minutes=60,
        planned_extension_minutes=0,
        buffer_minutes=0,
        status="reserved",
        reserved_until=None,
        created_at=now - timedelta(minutes=30),
        updated_at=now - timedelta(minutes=30),
    )
    session = DummySession([hold])

    # created_at から30分経過しているので、既にフォールバックTTL(15分)を超えている。
    # therapist_availability は created_at + 15分 で非アクティブと判定するため、
    # has_overlapping_reservation は False を返す。
    assert (
        await availability.has_overlapping_reservation(
            session,
            therapist_id,
            start_at,
            end_at,
        )
        is False
    )

    # expire_reserved_holds は reserved_until=NULL かつ created_at + TTL を超えた
    # 予約のステータスを明示的に expired に更新する。
    expired = await expire_reserved_holds(session, now=now, ttl_minutes=15)
    assert expired == 1
    assert hold.status == "expired"


@pytest.mark.asyncio
async def test_expire_reserved_holds_expires_only_past_reserved_until():
    now = datetime.now(timezone.utc)
    start_at = now + timedelta(days=1)
    end_at = start_at + timedelta(hours=1)

    expired_hold = GuestReservation(
        id=uuid4(),
        shop_id=uuid4(),
        therapist_id=uuid4(),
        start_at=start_at,
        end_at=end_at,
        duration_minutes=60,
        planned_extension_minutes=0,
        buffer_minutes=0,
        status="reserved",
        reserved_until=now - timedelta(minutes=1),
        created_at=now - timedelta(minutes=30),
        updated_at=now - timedelta(minutes=30),
    )
    active_hold = GuestReservation(
        id=uuid4(),
        shop_id=uuid4(),
        therapist_id=uuid4(),
        start_at=start_at,
        end_at=end_at,
        duration_minutes=60,
        planned_extension_minutes=0,
        buffer_minutes=0,
        status="reserved",
        reserved_until=now + timedelta(minutes=10),
        created_at=now - timedelta(minutes=1),
        updated_at=now - timedelta(minutes=1),
    )

    session = DummySession([expired_hold, active_hold])
    expired = await expire_reserved_holds(session, now=now, ttl_minutes=15)
    assert expired == 1
    assert expired_hold.status == "expired"
    assert active_hold.status == "reserved"
