"""Pure helper functions for availability calculations (no database access)."""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta
from typing import Any, Iterable

from ....models import GuestReservation
from ....utils.datetime import JST
from .constants import DEFAULT_HOLD_TTL_MINUTES
from .schemas import AvailabilitySlotStatus

logger = logging.getLogger(__name__)


def _reservation_status_value(reservation: GuestReservation) -> str:
    value = reservation.status
    if hasattr(value, "value"):
        value = value.value
    return str(value)


def _is_active_reservation(reservation: GuestReservation, now: datetime) -> bool:
    """Check if reservation is active based on status and reserved_until.

    Final Decision (reserved_until Validity):
    - status in {"pending", "confirmed"} → active (reserved_until ignored)
    - status == "reserved" → check reserved_until:
        - None → fallback to created_at + DEFAULT_HOLD_TTL_MINUTES
        - > now → active
        - <= now → expired (inactive)
    - other statuses → inactive
    """
    status_value = _reservation_status_value(reservation)
    if status_value in {"pending", "confirmed"}:
        return True
    if status_value != "reserved":
        return False
    reserved_until = getattr(reservation, "reserved_until", None)
    if reserved_until is None:
        # Fallback: reserved_until が NULL の場合、created_at + TTL で判定
        # これにより無限ロックを防ぐ
        created_at = getattr(reservation, "created_at", None)
        if created_at is None:
            # created_at もない場合は安全のため無効とみなす
            logger.warning(
                "reserved_until and created_at are both None for reservation_id=%s, treating as expired",
                getattr(reservation, "id", "unknown"),
            )
            return False
        # created_at から TTL が経過していたら期限切れ
        fallback_until = created_at + timedelta(minutes=DEFAULT_HOLD_TTL_MINUTES)
        if fallback_until <= now:
            logger.debug(
                "reserved_until is None, created_at fallback expired for reservation_id=%s",
                getattr(reservation, "id", "unknown"),
            )
            return False
        logger.debug(
            "reserved_until is None, using created_at fallback for reservation_id=%s",
            getattr(reservation, "id", "unknown"),
        )
        return True
    return reserved_until > now


def _filter_active_reservations(
    reservations: Iterable[GuestReservation], now: datetime
) -> list[GuestReservation]:
    return [r for r in reservations if _is_active_reservation(r, now)]


def _overlaps(
    a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime
) -> bool:
    """半開区間 [a_start, a_end) と [b_start, b_end) の重なり判定。"""
    return a_start < b_end and b_start < a_end


def determine_slot_status(
    slot_start: datetime,
    slot_end: datetime,
    now: datetime | None = None,
) -> AvailabilitySlotStatus:
    """
    スロットのステータスを決定する。

    Rules:
    - 過去のスロット（end_at <= now）→ blocked
    - それ以外 → open

    Note: tentative ステータスは将来的に予約中（未確定）の場合に使用予定
    """
    if now is None:
        now = datetime.now(JST)

    # Ensure timezone-aware comparison
    slot_end_aware = slot_end if slot_end.tzinfo else slot_end.replace(tzinfo=JST)
    now_aware = now if now.tzinfo else now.replace(tzinfo=JST)

    # 過去のスロットは blocked
    if slot_end_aware <= now_aware:
        return "blocked"

    return "open"


def _ensure_aware(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware. Naive datetimes are treated as JST."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=JST)
    return dt


def _parse_breaks(
    break_slots: Iterable[dict[str, Any]] | None,
    shift_date: date | None = None,
) -> list[tuple[datetime, datetime]]:
    """Parse break slots and ensure all datetimes are timezone-aware (JST if naive).

    Final Decision: break_slots format priority:
    1. ISO 8601 format (start_at/end_at with +09:00) - canonical
    2. Legacy HH:MM format (start_time/end_time) - fallback, requires shift_date
    """
    parsed: list[tuple[datetime, datetime]] = []
    for br in break_slots or []:
        start_dt: datetime | None = None
        end_dt: datetime | None = None

        # Priority 1: ISO 8601 format (start_at/end_at)
        start_raw = br.get("start_at")
        end_raw = br.get("end_at")
        if start_raw and end_raw:
            try:
                start_dt = (
                    start_raw
                    if isinstance(start_raw, datetime)
                    else datetime.fromisoformat(start_raw)
                )
                end_dt = (
                    end_raw
                    if isinstance(end_raw, datetime)
                    else datetime.fromisoformat(end_raw)
                )
            except Exception:
                start_dt = None
                end_dt = None

        # Priority 2: Legacy HH:MM format (start_time/end_time)
        if start_dt is None or end_dt is None:
            start_time_raw = br.get("start_time")
            end_time_raw = br.get("end_time")
            if start_time_raw and end_time_raw and shift_date:
                try:
                    # Parse HH:MM format
                    start_time = time.fromisoformat(start_time_raw)
                    end_time = time.fromisoformat(end_time_raw)
                    # Combine with shift_date and JST timezone
                    start_dt = datetime.combine(shift_date, start_time).replace(
                        tzinfo=JST
                    )
                    end_dt = datetime.combine(shift_date, end_time).replace(tzinfo=JST)
                except Exception:
                    continue

        if start_dt is None or end_dt is None:
            continue

        # Ensure timezone-aware (naive datetimes are treated as JST)
        start_dt = _ensure_aware(start_dt)
        end_dt = _ensure_aware(end_dt)

        if start_dt >= end_dt:
            continue
        parsed.append((start_dt, end_dt))
    return parsed


def _subtract_intervals(
    base: list[tuple[datetime, datetime]],
    subtracts: list[tuple[datetime, datetime]],
) -> list[tuple[datetime, datetime]]:
    """Return base intervals minus all subtract intervals (half-open)."""
    if not subtracts:
        return base[:]

    subtracts_sorted = sorted(subtracts, key=lambda x: x[0])
    remaining: list[tuple[datetime, datetime]] = []
    for start, end in base:
        cursor = start
        for sub_start, sub_end in subtracts_sorted:
            if sub_end <= cursor or sub_start >= end:
                continue
            if sub_start > cursor:
                remaining.append((cursor, min(sub_start, end)))
            cursor = max(cursor, sub_end)
            if cursor >= end:
                break
        if cursor < end:
            remaining.append((cursor, end))
    return remaining


def _normalize_intervals(
    intervals: list[tuple[datetime, datetime]],
) -> list[tuple[datetime, datetime]]:
    if not intervals:
        return []
    intervals.sort(key=lambda x: x[0])
    merged: list[tuple[datetime, datetime]] = []
    cur_start, cur_end = intervals[0]
    for start, end in intervals[1:]:
        if start <= cur_end:
            cur_end = max(cur_end, end)
        else:
            merged.append((cur_start, cur_end))
            cur_start, cur_end = start, end
    merged.append((cur_start, cur_end))
    return merged


def _day_window(target_date: date) -> tuple[datetime, datetime]:
    """Return the JST day window [00:00 JST, 24:00 JST) for the target date."""
    start = datetime.combine(target_date, time.min).replace(tzinfo=JST)
    end = start + timedelta(days=1)
    return start, end


def _filter_slots_by_date(
    slots: list[tuple[datetime, datetime]],
    target_date: date,
) -> list[tuple[datetime, datetime]]:
    """指定日に重なるスロットをフィルタリングする。"""
    day_start, day_end = _day_window(target_date)
    return [
        (max(slot_start, day_start), min(slot_end, day_end))
        for slot_start, slot_end in slots
        if slot_end > day_start and slot_start < day_end
    ]
