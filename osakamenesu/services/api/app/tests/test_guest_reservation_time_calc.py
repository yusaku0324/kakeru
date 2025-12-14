from __future__ import annotations

from datetime import datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.domains.site.guest_reservations import compute_booking_times


def test_compute_booking_times_resolves_course_duration_and_buffer() -> None:
    tz = ZoneInfo("Asia/Tokyo")
    shop_id = uuid4()
    course_id = uuid4()
    profile = SimpleNamespace(
        id=shop_id,
        contact_json={
            "menus": [
                {
                    "id": str(course_id),
                    "name": "Basic",
                    "price": 10000,
                    "duration_minutes": 60,
                }
            ],
            "booking_rules": {
                "base_buffer_minutes": 20,
                "max_extension_minutes": 120,
                "extension_step_minutes": 15,
            },
        },
    )

    start_at = datetime(2025, 1, 7, 10, 0, tzinfo=tz)
    (
        service_duration_minutes,
        planned_extension_minutes,
        buffer_minutes,
        service_end_at,
        occupied_end_at,
        err,
    ) = compute_booking_times(
        profile=profile,
        start_at=start_at,
        course_id=course_id,
        base_duration_minutes=None,
        planned_extension_minutes=15,
    )

    assert err is None
    assert service_duration_minutes == 75
    assert planned_extension_minutes == 15
    assert buffer_minutes == 20
    assert service_end_at == start_at + timedelta(minutes=75)
    assert occupied_end_at == start_at + timedelta(minutes=95)


def test_compute_booking_times_rejects_invalid_extension_step() -> None:
    tz = ZoneInfo("Asia/Tokyo")
    profile = SimpleNamespace(
        id=uuid4(),
        contact_json={
            "booking_rules": {
                "base_buffer_minutes": 0,
                "max_extension_minutes": 120,
                "extension_step_minutes": 15,
            }
        },
    )
    start_at = datetime(2025, 1, 7, 10, 0, tzinfo=tz)
    *_vals, err = compute_booking_times(
        profile=profile,
        start_at=start_at,
        course_id=None,
        base_duration_minutes=30,
        planned_extension_minutes=20,  # not multiple of 15
    )
    assert err == "invalid_extension"
