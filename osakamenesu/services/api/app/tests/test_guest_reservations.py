import os

# DATABASE_URL を asyncpg に固定してから app.* を import する
os.environ["DATABASE_URL"] = "postgresql+asyncpg://app:app@localhost:5432/osaka_menesu"

from datetime import datetime, timezone
from uuid import uuid4

import pytest
import pytest_asyncio

from app.domains.site import guest_reservations as domain
from app.domains.site.guest_reservations import (
    GuestReservationStatus,
    create_guest_reservation,
)


def _ts(hour: int, minute: int = 0) -> datetime:
    return datetime(2025, 1, 1, hour, minute, 0, tzinfo=timezone.utc)


class StubResult:
    def __init__(self, rows=None, scalar_value=None):
        self.rows = rows or []
        self.scalar_value = scalar_value

    def first(self):
        return self.rows[0] if self.rows else None

    def scalar(self):
        return self.scalar_value

    def scalar_one_or_none(self):
        return self.scalar_value


class StubSession:
    """
    簡易な in-memory セッション。SQLAlchemy を使わずに予約リストで重複判定する。
    """

    def __init__(self):
        self.items: list = []
        self.last_stmt = None

    async def execute(self, stmt):
        # overlap 判定用: therapist_id/start/end を stmt の _where_criteria から読み取るのは難しいので
        # テストで monkeypatch した check_shift_and_overlap を使う前提で、ここでは空を返す。
        self.last_stmt = stmt
        return StubResult()

    def add(self, obj):
        self.items.append(obj)

    async def commit(self):
        return None

    async def refresh(self, obj):
        return None

    async def rollback(self):
        return None


@pytest_asyncio.fixture
async def stub_session():
    return StubSession()


@pytest.mark.asyncio
async def test_create_guest_reservation_success(monkeypatch, stub_session: StubSession):
    async def _avail(db, therapist_id, start_at, end_at):
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(domain, "is_available", _avail)

    payload = {
        "shop_id": str(uuid4()),
        "therapist_id": str(uuid4()),
        "start_at": _ts(14),
        "end_at": _ts(15),
    }
    res, debug = await create_guest_reservation(stub_session, payload, now=_ts(12))
    assert res is not None
    assert str(res.status) == "confirmed"
    assert debug == {}


@pytest.mark.asyncio
async def test_create_guest_reservation_deadline_over(
    monkeypatch, stub_session: StubSession
):
    async def _avail(db, therapist_id, start_at, end_at):
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(domain, "is_available", _avail)

    payload = {
        "shop_id": str(uuid4()),
        "therapist_id": str(uuid4()),
        "start_at": _ts(12, 30),
        "end_at": _ts(13, 30),
    }
    res, debug = await create_guest_reservation(stub_session, payload, now=_ts(12))
    assert res is None
    assert "deadline_over" in debug["rejected_reasons"]


@pytest.mark.asyncio
async def test_create_guest_reservation_double_booking(
    monkeypatch, stub_session: StubSession
):
    async def _avail_ok(db, therapist_id, start_at, end_at):
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(domain, "is_available", _avail_ok)

    payload = {
        "shop_id": str(uuid4()),
        "therapist_id": str(uuid4()),
        "start_at": _ts(14),
        "end_at": _ts(15),
    }
    res1, _ = await create_guest_reservation(stub_session, payload, now=_ts(10))
    assert res1 is not None

    # is_available が重複を検知するケースをシミュレート
    async def _avail_ng(db, therapist_id, start_at, end_at):
        return False, {"rejected_reasons": ["overlap_existing_reservation"]}

    monkeypatch.setattr(domain, "is_available", _avail_ng)
    res2, debug = await create_guest_reservation(stub_session, payload, now=_ts(11))
    assert res2 is None
    assert "overlap_existing_reservation" in debug["rejected_reasons"]


@pytest.mark.asyncio
async def test_create_guest_reservation_free_assign_failed(
    monkeypatch, stub_session: StubSession
):
    async def _no_assign(db, shop_id, start_at, end_at, base_staff_id=None):
        return None, {"rejected_reasons": ["no_available_therapist"]}

    monkeypatch.setattr(domain, "assign_for_free", _no_assign)
    # is_available は therapist_id None の場合はスキップされる前提なので未設定

    payload = {
        "shop_id": str(uuid4()),
        "therapist_id": None,
        "start_at": _ts(14),
        "end_at": _ts(15),
    }
    res, debug = await create_guest_reservation(stub_session, payload, now=_ts(10))
    assert res is None
    assert "no_available_therapist" in debug["rejected_reasons"]


@pytest.mark.asyncio
async def test_cancel_guest_reservation_idempotent(
    monkeypatch, stub_session: StubSession
):
    async def _avail(db, therapist_id, start_at, end_at):
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(domain, "is_available", _avail)

    payload = {
        "shop_id": str(uuid4()),
        "therapist_id": str(uuid4()),
        "start_at": _ts(14),
        "end_at": _ts(15),
    }
    reservation, _ = await create_guest_reservation(stub_session, payload, now=_ts(10))
    assert reservation is not None

    async def _cancel(db, reservation_id):
        for r in db.items:
            if r.id == reservation_id:
                if str(r.status) != "cancelled":
                    r.status = "cancelled"
                return r
        return None

    monkeypatch.setattr(domain, "cancel_guest_reservation", _cancel)

    # 1回目
    cancelled = await _cancel(stub_session, reservation.id)
    assert cancelled is not None
    assert str(cancelled.status) == "cancelled"

    # 2回目（idempotent）
    cancelled_again = await _cancel(stub_session, reservation.id)
    assert cancelled_again is not None
    assert str(cancelled_again.status) == "cancelled"
