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
        slots.append(
            AvailabilitySlot(
                start_at=start_dt,
                end_at=end_dt,
                status=status if status in {"open", "tentative", "blocked"} else "open",
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
) -> AvailabilityCalendar | None:
    stmt = (
        select(models.Availability)
        .where(models.Availability.profile_id == shop_id)
        .order_by(models.Availability.date.asc())
    )
    if start_date:
        stmt = stmt.where(models.Availability.date >= start_date)
    if end_date:
        stmt = stmt.where(models.Availability.date <= end_date)

    result = await db.execute(stmt)
    records = list(result.scalars().all())
    if not records:
        return None

    days: List[AvailabilityDay] = []
    today = now_jst().date()
    for record in records:
        slots = convert_slots(record.slots_json)
        days.append(
            AvailabilityDay(
                date=record.date,
                is_today=record.date == today,
                slots=slots,
            )
        )
    return AvailabilityCalendar(
        shop_id=shop_id,
        generated_at=now_jst(),
        days=days,
    )


def _build_next_slot_candidate(
    slot: AvailabilitySlot,
    *,
    now_jst_value: datetime,
) -> Tuple[datetime, NextAvailableSlot] | None:
    status = slot.status or "open"
    if status not in {"open", "tentative"}:
        return None
    start = slot.start_at
    if not isinstance(start, datetime):
        return None
    comparable = ensure_jst_datetime(start)
    if comparable < now_jst_value:
        return None
    payload = NextAvailableSlot(
        start_at=comparable,
        status="ok" if status == "open" else "maybe",
    )
    return comparable, payload


async def fetch_next_available_slots(
    db: AsyncSession,
    shop_ids: List[UUID],
    lookahead_days: int = 14,
) -> tuple[dict[UUID, NextAvailableSlot], dict[UUID, NextAvailableSlot]]:
    if not shop_ids:
        return {}, {}
    today = now_jst().date()
    end_date = today + timedelta(days=lookahead_days)
    stmt = (
        select(
            models.Availability.profile_id,
            models.Availability.slots_json,
            models.Availability.date,
        )
        .where(models.Availability.profile_id.in_(shop_ids))
        .where(models.Availability.date >= today)
        .where(models.Availability.date <= end_date)
        .order_by(models.Availability.profile_id.asc(), models.Availability.date.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    now_value = now_jst()
    shop_map: dict[UUID, tuple[datetime, NextAvailableSlot]] = {}
    staff_map: dict[UUID, tuple[datetime, NextAvailableSlot]] = {}
    for profile_id, slots_json, _slot_date in rows:
        slots = convert_slots(slots_json)
        for slot in slots:
            candidate = _build_next_slot_candidate(slot, now_jst_value=now_value)
            if not candidate:
                continue
            comparable, payload = candidate
            existing_shop = shop_map.get(profile_id)
            if existing_shop is None or comparable < existing_shop[0]:
                shop_map[profile_id] = (comparable, payload)
            if slot.staff_id:
                existing_staff = staff_map.get(slot.staff_id)
                if existing_staff is None or comparable < existing_staff[0]:
                    staff_map[slot.staff_id] = (comparable, payload)
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

    # 結果マップを構築
    result: dict[UUID, dict[str, NextAvailableSlot]] = {}

    for shift in shifts:
        therapist = therapist_map.get(shift.therapist_id)
        if not therapist:
            continue

        shop_id = therapist.profile_id
        if not shop_id:
            continue

        # シフト開始時刻が現在より未来かチェック
        shift_start = shift.start_at
        if not isinstance(shift_start, datetime):
            continue

        comparable = ensure_jst_datetime(shift_start)
        if comparable < now_value:
            continue

        # 店舗別・セラピスト名別にマップを構築
        if shop_id not in result:
            result[shop_id] = {}

        therapist_name = therapist.name
        if not therapist_name:
            continue

        # 同じセラピストの中で最も早いスロットのみを保持
        if therapist_name in result[shop_id]:
            existing = result[shop_id][therapist_name]
            if existing.start_at <= comparable:
                continue

        result[shop_id][therapist_name] = NextAvailableSlot(
            start_at=comparable,
            status="ok",
        )

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
