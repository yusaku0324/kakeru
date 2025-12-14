from __future__ import annotations

from datetime import date, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.availability_sync import JST, sync_availability_for_date


class _Scalars:
    def __init__(self, items: list[object]):
        self._items = items

    def all(self) -> list[object]:
        return self._items


class _Result:
    def __init__(
        self,
        *,
        scalars_items: list[object] | None = None,
        scalar_one_or_none: object | None = None,
    ):
        self._scalars_items = scalars_items or []
        self._scalar_one_or_none = scalar_one_or_none

    def scalars(self) -> _Scalars:
        return _Scalars(self._scalars_items)

    def scalar_one_or_none(self) -> object | None:
        return self._scalar_one_or_none


class _StubAsyncSession:
    def __init__(self, results: list[_Result]):
        self._results = results
        self.added: list[object] = []

    async def execute(self, _stmt):  # type: ignore[no-untyped-def]
        return self._results.pop(0)

    def add(self, obj: object) -> None:
        self.added.append(obj)


@pytest.mark.asyncio
async def test_sync_availability_generates_only_full_slots_and_sets_staff_id():
    shop_id = uuid4()
    therapist_id = uuid4()
    target_day = date(2025, 1, 1)
    shift_start = datetime(2025, 1, 1, 10, 0, tzinfo=JST)
    shift_end = datetime(2025, 1, 1, 11, 30, tzinfo=JST)

    shift = SimpleNamespace(
        shop_id=shop_id,
        date=target_day,
        availability_status="available",
        therapist_id=therapist_id,
        start_at=shift_start,
        end_at=shift_end,
    )
    profile = SimpleNamespace(default_slot_duration_minutes=60)
    therapist = SimpleNamespace(id=therapist_id, name="T")

    db = _StubAsyncSession(
        [
            _Result(scalars_items=[shift]),  # TherapistShift select
            _Result(),  # Availability delete
            _Result(scalar_one_or_none=profile),  # Profile select
            _Result(scalars_items=[therapist]),  # Therapist select
        ]
    )

    await sync_availability_for_date(db, shop_id, target_day)

    assert len(db.added) == 1
    availability = db.added[0]
    slots = availability.slots_json["slots"]
    assert len(slots) == 1
    assert slots[0]["staff_id"] == str(therapist_id)

    slot_end = datetime.fromisoformat(slots[0]["end_at"])
    assert slot_end <= shift_end
