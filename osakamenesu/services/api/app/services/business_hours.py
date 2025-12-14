from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from ..utils.datetime import JST, ensure_jst_datetime

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class BookingRules:
    base_buffer_minutes: int = 0
    max_extension_minutes: int = 0
    extension_step_minutes: int = 15


@dataclass(frozen=True)
class BusinessHoursSegment:
    open: time
    close: time


@dataclass(frozen=True)
class BusinessHoursConfig:
    tz: ZoneInfo
    weekly: dict[int, list[BusinessHoursSegment]]
    overrides: dict[date, list[BusinessHoursSegment]]


def _coerce_int(value: Any, *, default: int) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except Exception:
        return default


def load_booking_rules_from_profile(profile: Any | None) -> BookingRules:
    if profile is None:
        return BookingRules()
    contact_json = getattr(profile, "contact_json", None)
    if not isinstance(contact_json, dict):
        return BookingRules()

    raw = contact_json.get("booking_rules")
    if raw is None:
        return BookingRules()
    if not isinstance(raw, dict):
        logger.warning("booking_rules_invalid_type: %s", type(raw).__name__)
        return BookingRules()

    base_buffer = _coerce_int(raw.get("base_buffer_minutes"), default=0)
    max_ext = _coerce_int(raw.get("max_extension_minutes"), default=0)
    step = _coerce_int(raw.get("extension_step_minutes"), default=15)

    if base_buffer < 0 or max_ext < 0:
        logger.warning("booking_rules_invalid_negative: %s", raw)
        return BookingRules()
    if step <= 0:
        logger.warning("booking_rules_invalid_step: %s", raw)
        return BookingRules()

    return BookingRules(
        base_buffer_minutes=base_buffer,
        max_extension_minutes=max_ext,
        extension_step_minutes=step,
    )


def _parse_hhmm(value: Any) -> time | None:
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw:
        return None
    try:
        hour_str, minute_str = raw.split(":", 1)
        hour = int(hour_str)
        minute = int(minute_str)
        if hour < 0 or hour > 23 or minute < 0 or minute > 59:
            return None
        return time(hour=hour, minute=minute)
    except Exception:
        return None


def load_business_hours_from_profile(profile: Any | None) -> BusinessHoursConfig | None:
    if profile is None:
        return None
    contact_json = getattr(profile, "contact_json", None)
    if not isinstance(contact_json, dict):
        return None
    raw = contact_json.get("booking_hours")
    if raw is None:
        return None
    if not isinstance(raw, dict):
        logger.warning("booking_hours_invalid_type: %s", type(raw).__name__)
        return None

    tz_name = raw.get("tz") or "Asia/Tokyo"
    tz: ZoneInfo
    try:
        tz = ZoneInfo(str(tz_name))
    except Exception:
        logger.warning("booking_hours_invalid_tz: %s", tz_name)
        return None

    weekly: dict[int, list[BusinessHoursSegment]] = {}
    weekly_raw = raw.get("weekly")
    if isinstance(weekly_raw, list):
        for entry in weekly_raw:
            if not isinstance(entry, dict):
                logger.warning("booking_hours_weekly_invalid_entry: %s", entry)
                return None
            weekday = entry.get("weekday")
            if not isinstance(weekday, int) or weekday < 0 or weekday > 6:
                logger.warning("booking_hours_weekly_invalid_weekday: %s", weekday)
                return None
            segments_raw = entry.get("segments") or []
            if not isinstance(segments_raw, list):
                logger.warning(
                    "booking_hours_weekly_invalid_segments: %s", segments_raw
                )
                return None
            segments: list[BusinessHoursSegment] = []
            for seg in segments_raw:
                if not isinstance(seg, dict):
                    logger.warning("booking_hours_weekly_invalid_segment: %s", seg)
                    return None
                if seg.get("is_closed") is True:
                    continue
                open_t = _parse_hhmm(seg.get("open"))
                close_t = _parse_hhmm(seg.get("close"))
                if open_t is None or close_t is None:
                    logger.warning("booking_hours_weekly_invalid_times: %s", seg)
                    return None
                segments.append(BusinessHoursSegment(open=open_t, close=close_t))
            weekly[weekday] = segments

    overrides: dict[date, list[BusinessHoursSegment]] = {}
    overrides_raw = raw.get("overrides")
    if isinstance(overrides_raw, list):
        for entry in overrides_raw:
            if not isinstance(entry, dict):
                logger.warning("booking_hours_override_invalid_entry: %s", entry)
                return None
            date_raw = entry.get("date")
            if not isinstance(date_raw, str):
                logger.warning("booking_hours_override_invalid_date: %s", date_raw)
                return None
            try:
                day = date.fromisoformat(date_raw)
            except ValueError:
                logger.warning("booking_hours_override_invalid_date: %s", date_raw)
                return None
            if entry.get("is_closed") is True:
                overrides[day] = []
                continue
            open_t = _parse_hhmm(entry.get("open"))
            close_t = _parse_hhmm(entry.get("close"))
            if open_t is None or close_t is None:
                logger.warning("booking_hours_override_invalid_times: %s", entry)
                return None
            overrides[day] = [BusinessHoursSegment(open=open_t, close=close_t)]

    if not weekly and not overrides:
        logger.warning("booking_hours_empty_config: %s", raw)
        return None

    return BusinessHoursConfig(tz=tz, weekly=weekly, overrides=overrides)


def _iter_open_intervals(
    cfg: BusinessHoursConfig,
    target_date: date,
) -> list[tuple[datetime, datetime]]:
    segments = cfg.overrides.get(target_date)
    if segments is None:
        segments = cfg.weekly.get(target_date.weekday(), [])

    intervals: list[tuple[datetime, datetime]] = []
    for seg in segments:
        start_dt = datetime.combine(target_date, seg.open).replace(tzinfo=cfg.tz)
        end_dt = datetime.combine(target_date, seg.close).replace(tzinfo=cfg.tz)
        if end_dt <= start_dt:
            end_dt = end_dt + timedelta(days=1)
        intervals.append((start_dt, end_dt))
    return intervals


def is_within_business_hours(
    cfg: BusinessHoursConfig,
    start_at: datetime,
    end_at: datetime,
) -> bool:
    if start_at.tzinfo is None or end_at.tzinfo is None:
        # The caller contract says inputs are timezone-aware.
        start_at = ensure_jst_datetime(start_at)
        end_at = ensure_jst_datetime(end_at)

    if end_at <= start_at:
        return False

    start_local = start_at.astimezone(cfg.tz)
    end_local = end_at.astimezone(cfg.tz)

    start_date = start_local.date()
    candidates = {start_date, start_date - timedelta(days=1)}
    for day in candidates:
        for open_dt, close_dt in _iter_open_intervals(cfg, day):
            if start_local >= open_dt and end_local <= close_dt:
                return True
    return False


__all__ = [
    "BookingRules",
    "BusinessHoursConfig",
    "load_booking_rules_from_profile",
    "load_business_hours_from_profile",
    "is_within_business_hours",
]
