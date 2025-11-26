from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone, date
from uuid import uuid4

from app.domains.admin import shop_dashboard_api as api
from app.models import GuestReservation, TherapistShift


def _dt(hour: int) -> datetime:
    return datetime(2025, 1, 1, hour, 0, tzinfo=timezone.utc)


class DummySession:
    def __init__(self, reservations=None, shifts=None, therapists=None):
        self.reservations = reservations or []
        self.shifts = shifts or []
        self.therapists = therapists or []

    async def execute(self, stmt):
        # naive type inspection
        model = stmt.column_descriptions[0]["entity"]
        items = []
        if model is GuestReservation:
            items = self.reservations
        elif model is TherapistShift:
            items = self.shifts
        else:
            # therapist lookup
            items = self.therapists

        class R:
            def __init__(self, items):
                self.items = items

            def scalars(self):
                class S:
                    def __init__(self, items):
                        self._items = items

                    def all(self):
                        return self._items

                return S(self.items)

        return R(items)


def test_dashboard_counts_today_and_week():
    shop_id = uuid4()
    today = _dt(12)
    yesterday = today - timedelta(days=1)
    past_week = today - timedelta(days=8)

    res_today = GuestReservation(
        id=uuid4(),
        shop_id=shop_id,
        therapist_id=uuid4(),
        start_at=today,
        end_at=today + timedelta(hours=1),
        status="confirmed",
    )
    res_week = GuestReservation(
        id=uuid4(),
        shop_id=shop_id,
        therapist_id=uuid4(),
        start_at=yesterday,
        end_at=yesterday + timedelta(hours=1),
        status="confirmed",
    )
    res_old = GuestReservation(
        id=uuid4(),
        shop_id=shop_id,
        therapist_id=uuid4(),
        start_at=past_week,
        end_at=past_week + timedelta(hours=1),
        status="confirmed",
    )
    shift = TherapistShift(
        id=uuid4(),
        therapist_id=uuid4(),
        shop_id=shop_id,
        date=date(2025, 1, 1),
        start_at=_dt(9),
        end_at=_dt(18),
        break_slots=[],
        availability_status="available",
        notes=None,
    )
    session = DummySession(reservations=[res_today, res_week, res_old], shifts=[shift])
    body = asyncio.get_event_loop().run_until_complete(
        api._compute_dashboard(session, shop_id, _dt(0))
    )
    assert body["today_reservations"] == 1
    assert body["week_reservations"] == 2
    assert body["today_shifts"] == 1
    assert "recent_reservations" in body
