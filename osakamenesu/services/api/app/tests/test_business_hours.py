from __future__ import annotations

from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo

from app.services.business_hours import (
    BusinessHoursConfig,
    BusinessHoursSegment,
    is_within_business_hours,
)


def test_business_hours_overnight_ok() -> None:
    tz = ZoneInfo("Asia/Tokyo")
    # Monday (0) 18:00-02:00 covers Tuesday 01:00.
    cfg = BusinessHoursConfig(
        tz=tz,
        weekly={0: [BusinessHoursSegment(open=time(18, 0), close=time(2, 0))]},
        overrides={},
    )

    start_at = datetime(2025, 1, 7, 1, 0, tzinfo=tz)  # Tue
    end_at = start_at + timedelta(minutes=60)
    assert is_within_business_hours(cfg, start_at, end_at) is True


def test_business_hours_close_exceed_ng() -> None:
    tz = ZoneInfo("Asia/Tokyo")
    cfg = BusinessHoursConfig(
        tz=tz,
        weekly={0: [BusinessHoursSegment(open=time(18, 0), close=time(2, 0))]},
        overrides={},
    )

    start_at = datetime(2025, 1, 7, 1, 30, tzinfo=tz)  # Tue
    # duration 30 + extension 15 + buffer 20 => 65 minutes => 02:35 (exceeds 02:00)
    end_at = start_at + timedelta(minutes=65)
    assert is_within_business_hours(cfg, start_at, end_at) is False
