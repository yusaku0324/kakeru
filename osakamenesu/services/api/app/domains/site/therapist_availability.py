from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Iterable
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import GuestReservation, TherapistShift
from ...db import get_session

logger = logging.getLogger(__name__)


def _overlaps(
    a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime
) -> bool:
    """半開区間 [a_start, a_end) と [b_start, b_end) の重なり判定。"""
    return a_start < b_end and b_start < a_end


async def is_available(
    db: AsyncSession,
    therapist_id: UUID,
    start_at: datetime,
    end_at: datetime,
) -> tuple[bool, dict[str, Any]]:
    """シフトと既存予約を見て予約可否を判定する (fail-soft)。"""
    if not start_at or not end_at or start_at >= end_at:
        return False, {"rejected_reasons": ["invalid_time_range"]}

    try:
        # 1) シフト存在（availability_status=available で内包しているか）
        shift_stmt = select(TherapistShift).where(
            TherapistShift.therapist_id == therapist_id,
            TherapistShift.availability_status == "available",
            TherapistShift.start_at <= start_at,
            TherapistShift.end_at >= end_at,
        )
        shift_res = await db.execute(shift_stmt)
        shift = shift_res.scalar_one_or_none()
        if not shift:
            return False, {"rejected_reasons": ["no_shift"]}

        # 2) 休憩との重なり
        for br in shift.break_slots or []:
            br_start = br.get("start_at")
            br_end = br.get("end_at")
            if not br_start or not br_end:
                continue
            try:
                br_start_dt = (
                    br_start
                    if isinstance(br_start, datetime)
                    else datetime.fromisoformat(br_start)
                )
                br_end_dt = (
                    br_end
                    if isinstance(br_end, datetime)
                    else datetime.fromisoformat(br_end)
                )
            except Exception:
                continue
            if _overlaps(start_at, end_at, br_start_dt, br_end_dt):
                return False, {"rejected_reasons": ["on_break"]}

        # 3) 既存予約との重なり (pending/confirmed)
        res_stmt = select(GuestReservation).where(
            GuestReservation.therapist_id == therapist_id,
            GuestReservation.status.in_(("pending", "confirmed")),
            and_(
                GuestReservation.start_at < end_at, GuestReservation.end_at > start_at
            ),
        )
        res_res = await db.execute(res_stmt)
        if res_res.scalar_one_or_none():
            return False, {"rejected_reasons": ["overlap_existing_reservation"]}

        return True, {"rejected_reasons": []}
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("is_available_failed: %s", exc)
        return False, {"rejected_reasons": ["internal_error"]}


# ---- Availability listing for guests ----

router = APIRouter(
    prefix="/api/guest/therapists",
    tags=["guest-therapist-availability"],
)

ACTIVE_RESERVATION_STATUSES = ("pending", "confirmed")


class AvailabilitySummaryItem(BaseModel):
    date: date
    has_available: bool


class AvailabilitySummaryResponse(BaseModel):
    therapist_id: UUID
    items: list[AvailabilitySummaryItem]


class AvailabilitySlot(BaseModel):
    start_at: datetime = Field(..., description="ISO datetime of the available start")
    end_at: datetime = Field(..., description="ISO datetime of the available end")


class AvailabilitySlotsResponse(BaseModel):
    therapist_id: UUID
    date: date
    slots: list[AvailabilitySlot]


def _parse_breaks(break_slots: Iterable[dict[str, Any]] | None) -> list[tuple[datetime, datetime]]:
    parsed: list[tuple[datetime, datetime]] = []
    for br in break_slots or []:
        start_raw = br.get("start_at")
        end_raw = br.get("end_at")
        if not start_raw or not end_raw:
            continue
        try:
            start_dt = start_raw if isinstance(start_raw, datetime) else datetime.fromisoformat(start_raw)
            end_dt = end_raw if isinstance(end_raw, datetime) else datetime.fromisoformat(end_raw)
        except Exception:
            continue
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


def _normalize_intervals(intervals: list[tuple[datetime, datetime]]) -> list[tuple[datetime, datetime]]:
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


async def _fetch_shifts(
    db: AsyncSession,
    therapist_id: UUID,
    date_from: date,
    date_to: date,
) -> list[TherapistShift]:
    stmt = select(TherapistShift).where(
        TherapistShift.therapist_id == therapist_id,
        TherapistShift.availability_status == "available",
        TherapistShift.date >= date_from,
        TherapistShift.date <= date_to,
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def _fetch_reservations(
    db: AsyncSession,
    therapist_id: UUID,
    start_at: datetime,
    end_at: datetime,
) -> list[GuestReservation]:
    stmt = select(GuestReservation).where(
        GuestReservation.therapist_id == therapist_id,
        GuestReservation.status.in_(ACTIVE_RESERVATION_STATUSES),
        and_(GuestReservation.start_at < end_at, GuestReservation.end_at > start_at),
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


def _day_window(target_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(target_date, time.min).replace(tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return start, end


def _calculate_available_slots(
    shifts: list[TherapistShift],
    reservations: list[GuestReservation],
) -> list[tuple[datetime, datetime]]:
    intervals: list[tuple[datetime, datetime]] = []
    for shift in shifts:
        if shift.availability_status != "available":
            continue
        base_intervals = [(shift.start_at, shift.end_at)]
        breaks = _parse_breaks(shift.break_slots)
        base_minus_breaks = _subtract_intervals(base_intervals, breaks)
        intervals.extend(base_minus_breaks)

    if not intervals:
        return []

    subtracts = [(r.start_at, r.end_at) for r in reservations]
    open_intervals = _subtract_intervals(intervals, subtracts)
    return _normalize_intervals(open_intervals)


async def list_daily_slots(
    db: AsyncSession,
    therapist_id: UUID,
    target_date: date,
) -> list[tuple[datetime, datetime]]:
    day_start, day_end = _day_window(target_date)
    shifts = await _fetch_shifts(db, therapist_id, target_date, target_date)
    reservations = await _fetch_reservations(db, therapist_id, day_start, day_end)
    slots = _calculate_available_slots(shifts, reservations)
    return [
        (
            max(slot_start, day_start),
            min(slot_end, day_end),
        )
        for slot_start, slot_end in slots
        if slot_end > day_start and slot_start < day_end
    ]


async def list_availability_summary(
    db: AsyncSession,
    therapist_id: UUID,
    date_from: date,
    date_to: date,
) -> AvailabilitySummaryResponse:
    items: list[AvailabilitySummaryItem] = []
    current = date_from
    while current <= date_to:
        slots = await list_daily_slots(db, therapist_id, current)
        items.append(AvailabilitySummaryItem(date=current, has_available=bool(slots)))
        current += timedelta(days=1)
    return AvailabilitySummaryResponse(therapist_id=therapist_id, items=items)


@router.get(
    "/{therapist_id}/availability_summary",
    response_model=AvailabilitySummaryResponse,
    status_code=status.HTTP_200_OK,
)
async def get_availability_summary_api(
    therapist_id: UUID,
    date_from: date = Query(..., description="inclusive YYYY-MM-DD"),
    date_to: date = Query(..., description="inclusive YYYY-MM-DD"),
    db: AsyncSession = Depends(get_session),
):
    if date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_date_range"
        )
    summary = await list_availability_summary(db, therapist_id, date_from, date_to)
    return summary


@router.get(
    "/{therapist_id}/availability_slots",
    response_model=AvailabilitySlotsResponse,
    status_code=status.HTTP_200_OK,
)
async def get_availability_slots_api(
    therapist_id: UUID,
    date: date = Query(..., description="target YYYY-MM-DD"),
    db: AsyncSession = Depends(get_session),
):
    slots = await list_daily_slots(db, therapist_id, date)
    return AvailabilitySlotsResponse(
        therapist_id=therapist_id,
        date=date,
        slots=[
            AvailabilitySlot(start_at=start, end_at=end) for start, end in slots
        ],
    )
