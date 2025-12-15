import os

# DATABASE_URL を asyncpg に固定してから app.* を import する
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://app:app@localhost:5432/osaka_menesu"
)

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.domains.site import guest_reservations as domain
from app.domains.site.guest_reservations import (
    _try_fetch_profile,
    assign_for_free,
    create_guest_reservation_hold,
)


class RollbackSpySession:
    def __init__(self):
        self.rollback_calls = 0

    async def execute(self, _stmt):
        raise RuntimeError("boom")

    async def rollback(self):
        self.rollback_calls += 1


@pytest.mark.asyncio
async def test_try_fetch_profile_rolls_back_on_execute_error():
    session = RollbackSpySession()
    res = await _try_fetch_profile(session, uuid4())
    assert res is None
    assert session.rollback_calls == 1


@pytest.mark.asyncio
async def test_assign_for_free_rolls_back_on_execute_error():
    session = RollbackSpySession()
    shop_id = uuid4()
    start_at = datetime(2025, 1, 1, 12, 0, tzinfo=timezone.utc)
    end_at = start_at + timedelta(minutes=60)

    therapist_id, debug = await assign_for_free(
        session, shop_id, start_at, end_at, base_staff_id=None
    )
    assert therapist_id is None
    assert debug.get("rejected_reasons") == ["internal_error"]
    assert session.rollback_calls == 1


@pytest.mark.asyncio
async def test_hold_rolls_back_on_idempotency_lookup_error(
    monkeypatch: pytest.MonkeyPatch,
):
    async def _avail(_db, _therapist_id, _start_at, _end_at, lock=False):
        return False, {"rejected_reasons": ["no_shift"]}

    monkeypatch.setattr(domain, "is_available", _avail)

    session = RollbackSpySession()
    now = datetime(2025, 1, 1, 12, 0, tzinfo=timezone.utc)
    start_at = now + timedelta(days=2)

    res, debug, err = await create_guest_reservation_hold(
        session,
        {
            "shop_id": "not-a-uuid",  # avoid profile DB lookup (focus on idempotency execute)
            "therapist_id": uuid4(),
            "start_at": start_at,
            "duration_minutes": 60,
            "planned_extension_minutes": 0,
        },
        idempotency_key="k-rollback",
        now=now,
    )
    assert err is None
    assert res is None
    assert "no_shift" in (debug.get("rejected_reasons") or [])
    assert session.rollback_calls == 1
