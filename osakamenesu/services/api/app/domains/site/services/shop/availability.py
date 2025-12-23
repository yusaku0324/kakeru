from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.utils.datetime import ensure_jst_datetime, now_jst, parse_jst_isoformat
from app.schemas import (
    AvailabilityCalendar,
    AvailabilityDay,
    AvailabilitySlot,
    NextAvailableSlot,
)
from app.models import Therapist, TherapistShift


def convert_slots(slots_json: Any) -> List[AvailabilitySlot]:
    slots: List[AvailabilitySlot] = []
    slot_items: Iterable[Any]
    if isinstance(slots_json, dict):
        slot_items = slots_json.get("slots") or slots_json.values()
    elif isinstance(slots_json, list):
        slot_items = slots_json
    else:
        slot_items = []
    for item in slot_items:
        if not isinstance(item, dict):
            continue
        start = item.get("start_at") or item.get("start")
        end = item.get("end_at") or item.get("end")
        status = item.get("status") or "open"
        if not (start and end):
            continue
        try:
            if isinstance(start, str):
                start_dt = parse_jst_isoformat(start)
            elif isinstance(start, datetime):
                start_dt = ensure_jst_datetime(start)
            else:
                continue
            if isinstance(end, str):
                end_dt = parse_jst_isoformat(end)
            elif isinstance(end, datetime):
                end_dt = ensure_jst_datetime(end)
            else:
                continue
        except Exception:
            continue
        staff_uuid = None
        staff_raw = item.get("staff_id")
        if staff_raw is not None:
            try:
                staff_uuid = UUID(str(staff_raw))
            except Exception:
                staff_uuid = None
        # Final Decision: Map DB status to API status
        # available -> open, busy/blocked -> blocked
        # tentative is UI-only, never in API response
        normalized_status: str
        if status in {"open", "available", "ok"}:
            normalized_status = "open"
        elif status in {"blocked", "busy", "unavailable"}:
            normalized_status = "blocked"
        else:
            normalized_status = "open"  # Default to open
        slots.append(
            AvailabilitySlot(
                start_at=start_dt,
                end_at=end_dt,
                status=normalized_status,  # type: ignore[arg-type]
                staff_id=staff_uuid,
                menu_id=item.get("menu_id"),
            )
        )
    return slots


def slots_have_open(slots_json: Any) -> bool:
    if not slots_json:
        return False
    for slot in convert_slots(slots_json):
        if slot.status == "open" or slot.status is None:
            return True
    return False


async def fetch_availability(
    db: AsyncSession,
    shop_id: UUID,
    start_date: date | None = None,
    end_date: date | None = None,
    booking_deadline_minutes: int = 60,
) -> AvailabilityCalendar | None:
    now = now_jst()
    today = now.date()

    # Always filter to today or later (never include past dates)
    effective_start = start_date if start_date and start_date >= today else today

    stmt = (
        select(models.Availability)
        .where(models.Availability.profile_id == shop_id)
        .where(models.Availability.date >= effective_start)
        .order_by(models.Availability.date.asc())
    )
    if end_date:
        stmt = stmt.where(models.Availability.date <= end_date)

    result = await db.execute(stmt)
    records = list(result.scalars().all())
    if not records:
        return None

    # Calculate booking deadline threshold
    deadline_threshold = now + timedelta(minutes=booking_deadline_minutes)

    days: List[AvailabilityDay] = []
    for record in records:
        slots = convert_slots(record.slots_json)

        # Filter out slots past the booking deadline
        # Only apply to "open" slots - keep "blocked" slots for display
        filtered_slots = [
            slot
            for slot in slots
            if slot.status != "open" or slot.start_at >= deadline_threshold
        ]

        # Only include days that have at least one slot
        if filtered_slots:
            days.append(
                AvailabilityDay(
                    date=record.date,
                    is_today=record.date == today,
                    slots=filtered_slots,
                )
            )

    if not days:
        return None

    return AvailabilityCalendar(
        shop_id=shop_id,
        generated_at=now,
        days=days,
    )


def _build_next_slot_candidate(
    slot: AvailabilitySlot,
    *,
    now_jst_value: datetime,
) -> Tuple[datetime, NextAvailableSlot] | None:
    # Final Decision: Only "open" slots are available
    # tentative is UI-only state, blocked is unavailable
    status = slot.status or "open"
    if status != "open":
        return None
    start = slot.start_at
    if not isinstance(start, datetime):
        return None
    comparable = ensure_jst_datetime(start)
    if comparable < now_jst_value:
        return None
    payload = NextAvailableSlot(
        start_at=comparable,
        status="ok",
    )
    return comparable, payload


async def fetch_next_available_slots(
    db: AsyncSession,
    shop_ids: List[UUID],
    lookahead_days: int = 14,
) -> tuple[dict[UUID, NextAvailableSlot], dict[UUID, NextAvailableSlot]]:
    """Fetch next available slots for shops using SoT (TherapistShift + GuestReservation).

    SoT Compliance: Does NOT use slots_json. Calculates from TherapistShift directly.

    Returns:
        tuple[shop_map, staff_map] where:
        - shop_map: {shop_id: NextAvailableSlot} - earliest slot per shop
        - staff_map: {therapist_id: NextAvailableSlot} - earliest slot per therapist
    """
    if not shop_ids:
        return {}, {}

    today = now_jst().date()
    end_date = today + timedelta(days=lookahead_days)
    now_value = now_jst()

    # 1) Get therapists for these shops
    therapist_stmt = (
        select(Therapist)
        .where(Therapist.profile_id.in_(shop_ids))
        .where(Therapist.status == "published")
    )
    therapist_res = await db.execute(therapist_stmt)
    therapists = list(therapist_res.scalars().all())

    if not therapists:
        return {}, {}

    therapist_ids = [t.id for t in therapists]
    therapist_to_shop: dict[UUID, UUID] = {
        t.id: t.profile_id for t in therapists if t.profile_id
    }

    # 2) Get shifts for these therapists (SoT)
    shift_stmt = (
        select(TherapistShift)
        .where(TherapistShift.therapist_id.in_(therapist_ids))
        .where(TherapistShift.availability_status == "available")
        .where(TherapistShift.date >= today)
        .where(TherapistShift.date <= end_date)
        .order_by(TherapistShift.start_at.asc())
    )
    shift_res = await db.execute(shift_stmt)
    shifts = list(shift_res.scalars().all())

    # 3) Get active reservations for these therapists
    from app.domains.site import therapist_availability as sot

    range_start = datetime.combine(today, datetime.min.time()).replace(
        tzinfo=now_value.tzinfo
    )
    range_end = datetime.combine(end_date, datetime.min.time()).replace(
        tzinfo=now_value.tzinfo
    ) + timedelta(days=1)

    reservations_stmt = (
        select(models.GuestReservation)
        .where(models.GuestReservation.therapist_id.in_(therapist_ids))
        .where(models.GuestReservation.status.in_(sot.ACTIVE_RESERVATION_STATUSES))
        .where(models.GuestReservation.start_at < range_end)
        .where(models.GuestReservation.end_at > range_start)
    )
    reservations = list((await db.execute(reservations_stmt)).scalars().all())
    reservations = sot._filter_active_reservations(reservations, now_value)

    # Group reservations by therapist
    reservations_by_therapist: dict[UUID, list[models.GuestReservation]] = {}
    for r in reservations:
        if r.therapist_id not in reservations_by_therapist:
            reservations_by_therapist[r.therapist_id] = []
        reservations_by_therapist[r.therapist_id].append(r)

    # 4) Get buffer_minutes per therapist
    buffer_stmt = (
        select(Therapist.id, models.Profile.buffer_minutes)
        .join(models.Profile, models.Profile.id == Therapist.profile_id)
        .where(Therapist.id.in_(therapist_ids))
    )
    buffer_rows = (await db.execute(buffer_stmt)).all()
    buffer_by_therapist: dict[UUID, int] = {
        tid: int(buf or 0) for tid, buf in buffer_rows
    }

    # 5) Calculate next available slot for each therapist using SoT logic
    shop_map: dict[UUID, tuple[datetime, NextAvailableSlot]] = {}
    staff_map: dict[UUID, tuple[datetime, NextAvailableSlot]] = {}

    # Group shifts by therapist and date
    shifts_by_therapist: dict[UUID, dict[date, list[TherapistShift]]] = {}
    for shift in shifts:
        if shift.therapist_id not in shifts_by_therapist:
            shifts_by_therapist[shift.therapist_id] = {}
        if shift.date not in shifts_by_therapist[shift.therapist_id]:
            shifts_by_therapist[shift.therapist_id][shift.date] = []
        shifts_by_therapist[shift.therapist_id][shift.date].append(shift)

    for therapist_id in therapist_ids:
        shop_id = therapist_to_shop.get(therapist_id)
        if not shop_id:
            continue

        buffer_minutes = buffer_by_therapist.get(therapist_id, 0)
        therapist_shifts = shifts_by_therapist.get(therapist_id, {})
        therapist_reservations = reservations_by_therapist.get(therapist_id, [])

        # Iterate through dates to find first available slot
        current = today
        found_slot = False
        while current <= end_date and not found_slot:
            day_shifts = therapist_shifts.get(current, [])
            if not day_shifts:
                current += timedelta(days=1)
                continue

            # Filter reservations for this day
            day_start = datetime.combine(current, datetime.min.time()).replace(
                tzinfo=now_value.tzinfo
            )
            day_end = day_start + timedelta(days=1)
            day_reservations = [
                r
                for r in therapist_reservations
                if r.start_at < day_end and r.end_at > day_start
            ]

            # Calculate available intervals using SoT logic
            open_intervals = sot._calculate_available_slots(
                day_shifts, day_reservations, buffer_minutes
            )
            filtered_intervals = sot._filter_slots_by_date(open_intervals, current)

            if filtered_intervals:
                slot_start, slot_end = filtered_intervals[0]
                # Skip slots in the past
                if slot_start > now_value:
                    next_slot = NextAvailableSlot(
                        start_at=slot_start,
                        end_at=slot_end,
                        status="ok",
                    )

                    # Update staff map (per therapist)
                    existing_staff = staff_map.get(therapist_id)
                    if existing_staff is None or slot_start < existing_staff[0]:
                        staff_map[therapist_id] = (slot_start, next_slot)

                    # Update shop map (earliest across all therapists)
                    existing_shop = shop_map.get(shop_id)
                    if existing_shop is None or slot_start < existing_shop[0]:
                        shop_map[shop_id] = (slot_start, next_slot)

                    found_slot = True

            current += timedelta(days=1)

    return (
        {shop_id: data[1] for shop_id, data in shop_map.items()},
        {staff_id: data[1] for staff_id, data in staff_map.items()},
    )


async def get_next_available_slots(
    db: AsyncSession,
    shop_ids: Iterable[UUID],
    *,
    lookahead_days: int = 14,
) -> tuple[dict[UUID, NextAvailableSlot], dict[UUID, NextAvailableSlot]]:
    unique_ids = list(dict.fromkeys([shop_id for shop_id in shop_ids]))
    if not unique_ids:
        return {}, {}
    return await fetch_next_available_slots(
        db, unique_ids, lookahead_days=lookahead_days
    )


async def get_next_available_slot(
    db: AsyncSession,
    shop_id: UUID,
    *,
    lookahead_days: int = 14,
) -> NextAvailableSlot | None:
    shop_slots, _staff_slots = await get_next_available_slots(
        db,
        [shop_id],
        lookahead_days=lookahead_days,
    )
    return shop_slots.get(shop_id)


async def get_therapist_next_available_slots_by_shop(
    db: AsyncSession,
    shop_ids: List[UUID],
    *,
    lookahead_days: int = 14,
) -> dict[UUID, dict[str, NextAvailableSlot]]:
    """
    店舗IDのリストから、その店舗に所属するセラピストの次回空き時間を取得する。

    SoT Compliance: Uses TherapistShift + GuestReservation (not slots_json).

    Returns:
        dict[shop_id, dict[therapist_name, NextAvailableSlot]]

    セラピスト名をキーとするマップを返す。staff_previewでは名前でマッチングする。
    """
    if not shop_ids:
        return {}

    today = now_jst().date()
    end_date = today + timedelta(days=lookahead_days)
    now_value = now_jst()

    # 店舗に所属するセラピストを取得
    # therapist_status enum: draft, published, archived
    therapist_stmt = (
        select(Therapist)
        .where(Therapist.profile_id.in_(shop_ids))
        .where(Therapist.status.in_(["draft", "published"]))
    )
    therapist_res = await db.execute(therapist_stmt)
    therapists = list(therapist_res.scalars().all())

    if not therapists:
        return {}

    therapist_ids = [t.id for t in therapists]
    therapist_map: dict[UUID, Therapist] = {t.id: t for t in therapists}

    # セラピストのシフトを取得
    shift_stmt = (
        select(TherapistShift)
        .where(TherapistShift.therapist_id.in_(therapist_ids))
        .where(TherapistShift.availability_status == "available")
        .where(TherapistShift.date >= today)
        .where(TherapistShift.date <= end_date)
        .order_by(TherapistShift.start_at.asc())
    )
    shift_res = await db.execute(shift_stmt)
    shifts = list(shift_res.scalars().all())

    # Get active reservations for these therapists (SoT)
    from app.domains.site import therapist_availability as sot

    range_start = datetime.combine(today, datetime.min.time()).replace(
        tzinfo=now_value.tzinfo
    )
    range_end = datetime.combine(end_date, datetime.min.time()).replace(
        tzinfo=now_value.tzinfo
    ) + timedelta(days=1)

    reservations_stmt = (
        select(models.GuestReservation)
        .where(models.GuestReservation.therapist_id.in_(therapist_ids))
        .where(models.GuestReservation.status.in_(sot.ACTIVE_RESERVATION_STATUSES))
        .where(models.GuestReservation.start_at < range_end)
        .where(models.GuestReservation.end_at > range_start)
    )
    reservations = list((await db.execute(reservations_stmt)).scalars().all())
    reservations = sot._filter_active_reservations(reservations, now_value)

    # Group reservations by therapist
    reservations_by_therapist: dict[UUID, list[models.GuestReservation]] = {}
    for r in reservations:
        if r.therapist_id not in reservations_by_therapist:
            reservations_by_therapist[r.therapist_id] = []
        reservations_by_therapist[r.therapist_id].append(r)

    # Get buffer_minutes per therapist
    buffer_stmt = (
        select(Therapist.id, models.Profile.buffer_minutes)
        .join(models.Profile, models.Profile.id == Therapist.profile_id)
        .where(Therapist.id.in_(therapist_ids))
    )
    buffer_rows = (await db.execute(buffer_stmt)).all()
    buffer_by_therapist: dict[UUID, int] = {
        tid: int(buf or 0) for tid, buf in buffer_rows
    }

    # Group shifts by therapist and date
    shifts_by_therapist: dict[UUID, dict[date, list[TherapistShift]]] = {}
    for shift in shifts:
        if shift.therapist_id not in shifts_by_therapist:
            shifts_by_therapist[shift.therapist_id] = {}
        if shift.date not in shifts_by_therapist[shift.therapist_id]:
            shifts_by_therapist[shift.therapist_id][shift.date] = []
        shifts_by_therapist[shift.therapist_id][shift.date].append(shift)

    # 結果マップを構築
    result: dict[UUID, dict[str, NextAvailableSlot]] = {}

    for therapist_id, therapist in therapist_map.items():
        shop_id = therapist.profile_id
        if not shop_id:
            continue

        therapist_name = therapist.name
        if not therapist_name:
            continue

        buffer_minutes = buffer_by_therapist.get(therapist_id, 0)
        therapist_shifts = shifts_by_therapist.get(therapist_id, {})
        therapist_reservations = reservations_by_therapist.get(therapist_id, [])

        # Iterate through dates to find first available slot
        current = today
        while current <= end_date:
            day_shifts = therapist_shifts.get(current, [])
            if not day_shifts:
                current += timedelta(days=1)
                continue

            # Filter reservations for this day
            day_start = datetime.combine(current, datetime.min.time()).replace(
                tzinfo=now_value.tzinfo
            )
            day_end = day_start + timedelta(days=1)
            day_reservations = [
                r
                for r in therapist_reservations
                if r.start_at < day_end and r.end_at > day_start
            ]

            # Calculate available intervals using SoT logic
            open_intervals = sot._calculate_available_slots(
                day_shifts, day_reservations, buffer_minutes
            )
            filtered_intervals = sot._filter_slots_by_date(open_intervals, current)

            for slot_start, slot_end in filtered_intervals:
                # Skip slots in the past
                if slot_start <= now_value:
                    continue

                # 店舗別・セラピスト名別にマップを構築
                if shop_id not in result:
                    result[shop_id] = {}

                # 同じセラピストの中で最も早いスロットのみを保持
                if therapist_name not in result[shop_id]:
                    result[shop_id][therapist_name] = NextAvailableSlot(
                        start_at=slot_start,
                        end_at=slot_end,
                        status="ok",
                    )
                break  # Found first available slot for this therapist

            # If we found a slot for this therapist, move to next therapist
            if shop_id in result and therapist_name in result[shop_id]:
                break

            current += timedelta(days=1)

    return result


__all__ = [
    "convert_slots",
    "slots_have_open",
    "fetch_availability",
    "fetch_next_available_slots",
    "get_next_available_slots",
    "get_next_available_slot",
    "get_therapist_next_available_slots_by_shop",
]
