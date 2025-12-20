from __future__ import annotations

import logging
from datetime import datetime, date
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...deps import require_admin, audit_admin
from ...models import TherapistShift, TherapistShiftStatus, GuestReservation
from ...services.availability_sync import sync_availability_for_date

ACTIVE_RESERVATION_STATUSES = {"pending", "confirmed", "reserved"}

logger = logging.getLogger(__name__)

router = APIRouter()


class BreakSlot(BaseModel):
    start_at: datetime
    end_at: datetime

    @field_validator("end_at")
    @classmethod
    def validate_range(cls, v: datetime, info):
        start = info.data.get("start_at")
        if start and v <= start:
            raise ValueError("break end_at must be after start_at")
        return v


class TherapistShiftPayload(BaseModel):
    therapist_id: UUID
    shop_id: UUID
    date: date
    start_at: datetime
    end_at: datetime
    break_slots: list[BreakSlot] = Field(default_factory=list)
    availability_status: str = Field(default="available")
    notes: str | None = None

    @field_validator("end_at")
    @classmethod
    def validate_time_range(cls, v: datetime, info):
        start = info.data.get("start_at")
        if start and v <= start:
            raise ValueError("end_at must be after start_at")
        return v


def _serialize(shift: TherapistShift) -> dict[str, Any]:
    return {
        "id": str(shift.id),
        "therapist_id": str(shift.therapist_id),
        "shop_id": str(shift.shop_id),
        "date": shift.date.isoformat(),
        "start_at": shift.start_at.isoformat(),
        "end_at": shift.end_at.isoformat(),
        "break_slots": shift.break_slots or [],
        "availability_status": shift.availability_status.value
        if hasattr(shift.availability_status, "value")
        else shift.availability_status,
        "notes": shift.notes,
        "created_at": shift.created_at.isoformat() if shift.created_at else None,
        "updated_at": shift.updated_at.isoformat() if shift.updated_at else None,
    }


async def _get_shift(db: AsyncSession, shift_id: UUID) -> TherapistShift | None:
    res = await db.execute(select(TherapistShift).where(TherapistShift.id == shift_id))
    return res.scalar_one_or_none()


async def _has_reservations_in_shift(
    db: AsyncSession,
    therapist_id: UUID,
    start_at: datetime,
    end_at: datetime,
    *,
    lock: bool = False,
) -> bool:
    """シフト時間帯にアクティブな予約があるかチェック。

    lock=True で FOR UPDATE ロックを取得し、レースコンディションを防ぐ。
    """
    stmt = select(GuestReservation).where(
        GuestReservation.therapist_id == therapist_id,
        GuestReservation.status.in_(ACTIVE_RESERVATION_STATUSES),
        GuestReservation.start_at < end_at,
        GuestReservation.end_at > start_at,
    )
    if lock:
        stmt = stmt.with_for_update()
    res = await db.execute(stmt)
    return res.scalar_one_or_none() is not None


async def _has_reservations_outside_range(
    db: AsyncSession,
    therapist_id: UUID,
    new_start: datetime,
    new_end: datetime,
    old_start: datetime,
    old_end: datetime,
) -> bool:
    """シフト時間短縮時に、新しい範囲外にはみ出す予約があるかチェック。"""
    from sqlalchemy import or_

    stmt = select(GuestReservation).where(
        GuestReservation.therapist_id == therapist_id,
        GuestReservation.status.in_(ACTIVE_RESERVATION_STATUSES),
        GuestReservation.start_at < old_end,
        GuestReservation.end_at > old_start,
        or_(
            GuestReservation.start_at < new_start,
            GuestReservation.end_at > new_end,
        ),
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none() is not None


async def _has_overlap(
    db: AsyncSession,
    therapist_id: UUID,
    start_at: datetime,
    end_at: datetime,
    exclude_id: UUID | None = None,
) -> bool:
    stmt = select(TherapistShift).where(
        TherapistShift.therapist_id == therapist_id,
        TherapistShift.start_at < end_at,
        TherapistShift.end_at > start_at,
    )
    if exclude_id:
        stmt = stmt.where(TherapistShift.id != exclude_id)
    res = await db.execute(stmt)
    return res.scalar_one_or_none() is not None


@router.get("/api/admin/therapist_shifts")
async def list_shifts(
    therapist_id: UUID | None = None,
    date_filter: date | None = Query(default=None, alias="date"),
    page: int = 1,
    limit: int = 50,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    # Build base query with filters
    base_stmt = select(TherapistShift)
    if therapist_id:
        base_stmt = base_stmt.where(TherapistShift.therapist_id == therapist_id)
    if date_filter:
        base_stmt = base_stmt.where(TherapistShift.date == date_filter)

    # Get total count for pagination
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    count_res = await db.execute(count_stmt)
    total = count_res.scalar() or 0

    # Apply pagination
    page = max(1, page)
    limit = min(max(1, limit), 100)  # Max 100 per page
    offset = (page - 1) * limit
    total_pages = (total + limit - 1) // limit if total > 0 else 1

    # Fetch paginated results
    stmt = base_stmt.order_by(TherapistShift.start_at).offset(offset).limit(limit)
    res = await db.execute(stmt)
    items = res.scalars().all()

    return {
        "items": [_serialize(s) for s in items],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
    }


@router.post("/api/admin/therapist_shifts", status_code=status.HTTP_201_CREATED)
async def create_shift(
    payload: TherapistShiftPayload,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    # time range check is handled by Pydantic; double-check in case payload bypass
    if payload.start_at >= payload.end_at:
        raise HTTPException(status_code=400, detail="invalid_time_range")

    if await _has_overlap(db, payload.therapist_id, payload.start_at, payload.end_at):
        raise HTTPException(status_code=409, detail="shift_overlaps_existing")

    shift = TherapistShift(
        therapist_id=payload.therapist_id,
        shop_id=payload.shop_id,
        date=payload.date,
        start_at=payload.start_at,
        end_at=payload.end_at,
        break_slots=[bs.model_dump(mode="json") for bs in payload.break_slots],
        availability_status=payload.availability_status or "available",
        notes=payload.notes,
    )
    db.add(shift)
    await db.commit()
    await db.refresh(shift)

    # Availabilityテーブルを同期
    try:
        await sync_availability_for_date(db, payload.shop_id, payload.date)
        await db.commit()
    except Exception as e:
        logger.warning("Failed to sync availability after shift create: %s", e)

    return _serialize(shift)


@router.put("/api/admin/therapist_shifts/{shift_id}")
async def update_shift(
    shift_id: UUID,
    payload: TherapistShiftPayload,
    force: bool = Query(default=False, description="予約がはみ出しても強制更新する"),
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    shift = await _get_shift(db, shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="shift_not_found")

    if payload.start_at >= payload.end_at:
        raise HTTPException(status_code=400, detail="invalid_time_range")

    if await _has_overlap(
        db, payload.therapist_id, payload.start_at, payload.end_at, exclude_id=shift_id
    ):
        raise HTTPException(status_code=409, detail="shift_overlaps_existing")

    # シフト時間を短縮する場合、既存予約がはみ出さないかチェック
    if not force and (
        payload.start_at > shift.start_at or payload.end_at < shift.end_at
    ):
        if await _has_reservations_outside_range(
            db,
            shift.therapist_id,
            payload.start_at,
            payload.end_at,
            shift.start_at,
            shift.end_at,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="shift_reduction_conflicts_reservations",
            )

    # 日付が変わる場合は両方の日付を同期
    old_date = shift.date
    old_shop_id = shift.shop_id
    dates_to_sync = {payload.date}
    if old_date != payload.date or old_shop_id != payload.shop_id:
        dates_to_sync.add(old_date)

    shift.therapist_id = payload.therapist_id
    shift.shop_id = payload.shop_id
    shift.date = payload.date
    shift.start_at = payload.start_at
    shift.end_at = payload.end_at
    shift.break_slots = [bs.model_dump(mode="json") for bs in payload.break_slots]
    shift.availability_status = payload.availability_status or "available"
    shift.notes = payload.notes

    db.add(shift)
    await db.commit()
    await db.refresh(shift)

    # Availabilityテーブルを同期
    try:
        for sync_date in dates_to_sync:
            await sync_availability_for_date(db, payload.shop_id, sync_date)
        # 店舗が変わった場合は旧店舗も同期
        if old_shop_id != payload.shop_id:
            await sync_availability_for_date(db, old_shop_id, old_date)
        await db.commit()
    except Exception as e:
        logger.warning("Failed to sync availability after shift update: %s", e)

    return _serialize(shift)


@router.delete(
    "/api/admin/therapist_shifts/{shift_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_shift(
    shift_id: UUID,
    force: bool = Query(default=False, description="予約があっても強制削除する"),
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    shift = await _get_shift(db, shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="shift_not_found")

    # 予約の存在チェック（lock=True でレースコンディションを防ぐ）
    if not force:
        has_reservations = await _has_reservations_in_shift(
            db, shift.therapist_id, shift.start_at, shift.end_at, lock=True
        )
        if has_reservations:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="shift_has_reservations",
            )

    shop_id = shift.shop_id
    shift_date = shift.date

    await db.delete(shift)
    await db.commit()

    # Availabilityテーブルを同期（シフト削除後）
    try:
        await sync_availability_for_date(db, shop_id, shift_date)
        await db.commit()
    except Exception as e:
        logger.warning("Failed to sync availability after shift delete: %s", e)

    return {"ok": True}
