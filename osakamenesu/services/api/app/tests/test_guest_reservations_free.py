import os
from datetime import datetime, timezone
from uuid import uuid4

import pytest
import pytest_asyncio

from app.domains.site import guest_reservations as domain
from app.domains.site.guest_reservations import assign_for_free


def _ts(hour: int, minute: int = 0) -> datetime:
    return datetime(2025, 1, 1, hour, minute, 0, tzinfo=timezone.utc)


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def fetchall(self):
        return self._rows


class FakeSession:
    def __init__(self, rows):
        self.rows = rows
        self.last_stmt = None

    async def execute(self, stmt):
        self.last_stmt = stmt
        return FakeResult(self.rows)


@pytest_asyncio.fixture
async def sample_rows():
    return [
        (uuid4(), 1, _ts(0)),
        (uuid4(), 2, _ts(0)),
    ]


@pytest.mark.asyncio
async def test_assign_for_free_prefers_base_staff(monkeypatch, sample_rows):
    # 2 candidates, base_staff_id matches second => score 0.9 vs 0.5
    base_id = sample_rows[1][0]

    async def _avail(db, therapist_id, start_at, end_at):
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(domain, "is_available", _avail)
    session = FakeSession(sample_rows)

    chosen, debug = await assign_for_free(
        session,
        shop_id=uuid4(),
        start_at=_ts(11),
        end_at=_ts(12),
        base_staff_id=base_id,
    )

    assert chosen == base_id
    assert debug.get("rejected_reasons") == []


@pytest.mark.asyncio
async def test_assign_for_free_no_available(monkeypatch, sample_rows):
    async def _avail(db, therapist_id, start_at, end_at):
        return False, {"rejected_reasons": ["overlap_existing_reservation"]}

    monkeypatch.setattr(domain, "is_available", _avail)
    session = FakeSession(sample_rows)

    chosen, debug = await assign_for_free(
        session,
        shop_id=uuid4(),
        start_at=_ts(10),
        end_at=_ts(11),
    )

    assert chosen is None
    assert "no_available_therapist" in debug.get("rejected_reasons", [])
