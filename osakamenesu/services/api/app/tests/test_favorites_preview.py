from types import SimpleNamespace
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pytest

try:
    from app.domains.site.shops import _overlay_reservations
except ImportError:  # pragma: no cover - helper removed in production code
    _overlay_reservations = None

from app.schemas import AvailabilityDay, AvailabilitySlot


def _slot(start: str, end: str, status: str = "open"):
    return AvailabilitySlot(start_at=datetime.fromisoformat(start), end_at=datetime.fromisoformat(end), status=status)


def _dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


@pytest.mark.skipif(_overlay_reservations is None, reason="overlay helper unavailable")
def test_overlay_reservations_updates_statuses():
    days = [
        AvailabilityDay(
            date="2025-11-06",
            is_today=True,
            slots=[
                _slot("2025-11-06T12:00:00+09:00", "2025-11-06T12:30:00+09:00"),
                _slot("2025-11-06T14:00:00+09:00", "2025-11-06T14:30:00+09:00"),
            ],
        )
    ]
    reservations = [
            SimpleNamespace(
                status="pending",
                desired_start=_dt("2025-11-06T12:00:00+09:00"),
                desired_end=_dt("2025-11-06T12:30:00+09:00"),
                staff_id=None,
                preferred_slots=[],
            )
        ]

    _overlay_reservations(days, reservations)

    assert days[0].slots[0].status == "tentative"
    assert days[0].slots[1].status == "open"


@pytest.mark.skipif(_overlay_reservations is None, reason="overlay helper unavailable")
def test_overlay_reservations_respects_staff():
    days = [
        AvailabilityDay(
            date="2025-11-06",
            is_today=True,
            slots=[
                _slot("2025-11-06T12:00:00+09:00", "2025-11-06T12:30:00+09:00"),
                _slot("2025-11-06T14:00:00+09:00", "2025-11-06T14:30:00+09:00"),
            ],
        )
    ]
    reservations = [
            SimpleNamespace(
                status="confirmed",
                desired_start=_dt("2025-11-06T14:00:00+09:00"),
                desired_end=_dt("2025-11-06T14:30:00+09:00"),
                staff_id="staff-1",
                preferred_slots=[],
            )
        ]

    days[0].slots[1].staff_id = "staff-2"
    _overlay_reservations(days, reservations)

    assert days[0].slots[1].status == "open"


@pytest.mark.skipif(_overlay_reservations is None, reason="overlay helper unavailable")
def test_overlay_reservations_applies_preferred_slots():
    days = [
        AvailabilityDay(
            date="2025-11-07",
            is_today=False,
            slots=[
                _slot("2025-11-07T18:00:00+09:00", "2025-11-07T18:30:00+09:00"),
            ],
        )
    ]
    reservations = [
            SimpleNamespace(
                status="pending",
                desired_start=_dt("2025-11-07T21:00:00+09:00"),
                desired_end=_dt("2025-11-07T22:00:00+09:00"),
                staff_id=None,
                preferred_slots=[
                    SimpleNamespace(
                        desired_start=_dt("2025-11-07T18:00:00+09:00"),
                        desired_end=_dt("2025-11-07T18:30:00+09:00"),
                        status="blocked",
                    )
                ],
            )
    ]

    _overlay_reservations(days, reservations)

    assert days[0].slots[0].status == "blocked"
