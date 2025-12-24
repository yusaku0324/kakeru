from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
import pytest_asyncio

from app.domains.site import guest_reservations as domain
from app.domains.site.guest_reservations import create_guest_reservation


def _ts(hour: int, minute: int = 0) -> datetime:
    return datetime(2025, 1, 1, hour, minute, 0, tzinfo=timezone.utc)


class StubSession:
    def __init__(self):
        self.items = []

    async def execute(self, stmt):
        return None

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


class MockProfile:
    """Mock profile for testing."""

    room_count = 1


@pytest.mark.asyncio
async def test_is_available_ok(monkeypatch, stub_session):
    async def _avail(db, therapist_id, start_at, end_at, lock=False):
        return True, {"rejected_reasons": []}

    async def _fetch_profile(db, shop_id):
        return MockProfile()

    monkeypatch.setattr(domain, "is_available", _avail)
    monkeypatch.setattr(domain, "_try_fetch_profile", _fetch_profile)
    payload = {
        "shop_id": str(uuid4()),
        "therapist_id": str(uuid4()),
        "start_at": _ts(11),
        "end_at": _ts(12),
    }
    res, debug = await create_guest_reservation(stub_session, payload, now=_ts(10))
    assert res is not None
    assert debug == {}


@pytest.mark.asyncio
async def test_is_available_no_shift(monkeypatch, stub_session):
    async def _avail(db, therapist_id, start_at, end_at, lock=False):
        return False, {"rejected_reasons": ["no_shift"]}

    async def _fetch_profile(db, shop_id):
        return MockProfile()

    monkeypatch.setattr(domain, "is_available", _avail)
    monkeypatch.setattr(domain, "_try_fetch_profile", _fetch_profile)
    payload = {
        "shop_id": str(uuid4()),
        "therapist_id": str(uuid4()),
        "start_at": _ts(2),
        "end_at": _ts(3),
    }
    res, debug = await create_guest_reservation(stub_session, payload, now=_ts(1))
    assert res is None
    assert debug["rejected_reasons"] == ["no_shift"]


@pytest.mark.asyncio
async def test_is_available_on_break(monkeypatch, stub_session):
    async def _avail(db, therapist_id, start_at, end_at, lock=False):
        return False, {"rejected_reasons": ["on_break"]}

    async def _fetch_profile(db, shop_id):
        return MockProfile()

    monkeypatch.setattr(domain, "is_available", _avail)
    monkeypatch.setattr(domain, "_try_fetch_profile", _fetch_profile)
    payload = {
        "shop_id": str(uuid4()),
        "therapist_id": str(uuid4()),
        "start_at": _ts(13, 30),
        "end_at": _ts(14),
    }
    res, debug = await create_guest_reservation(stub_session, payload, now=_ts(10))
    assert res is None
    assert debug["rejected_reasons"] == ["on_break"]


@pytest.mark.asyncio
async def test_is_available_overlap(monkeypatch, stub_session):
    async def _avail(db, therapist_id, start_at, end_at, lock=False):
        return False, {"rejected_reasons": ["overlap_existing_reservation"]}

    async def _fetch_profile(db, shop_id):
        return MockProfile()

    monkeypatch.setattr(domain, "is_available", _avail)
    monkeypatch.setattr(domain, "_try_fetch_profile", _fetch_profile)
    payload = {
        "shop_id": str(uuid4()),
        "therapist_id": str(uuid4()),
        "start_at": _ts(15, 30),
        "end_at": _ts(16, 30),
    }
    res, debug = await create_guest_reservation(stub_session, payload, now=_ts(12))
    assert res is None
    assert debug["rejected_reasons"] == ["overlap_existing_reservation"]


@pytest.mark.asyncio
async def test_is_available_internal_error(monkeypatch, stub_session):
    async def _avail(db, therapist_id, start_at, end_at, lock=False):
        raise RuntimeError("boom")

    async def _fetch_profile(db, shop_id):
        return MockProfile()

    # simulate fail-soft: wrap to return internal_error
    monkeypatch.setattr(domain, "is_available", _avail)
    monkeypatch.setattr(domain, "_try_fetch_profile", _fetch_profile)
    payload = {
        "shop_id": str(uuid4()),
        "therapist_id": str(uuid4()),
        "start_at": _ts(11),
        "end_at": _ts(12),
    }
    res, debug = await create_guest_reservation(stub_session, payload, now=_ts(10))
    # create_guest_reservation swallows errors from is_available and returns rejected reasons
    assert res is None or debug.get("rejected_reasons")
