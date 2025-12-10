from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models
from ....db import get_session
from ....deps import require_dashboard_user, verify_shop_manager
from ....services.availability_sync import sync_availability_for_date

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard-shifts"])


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


class ShiftCreatePayload(BaseModel):
    therapist_id: UUID
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


class ShiftUpdatePayload(BaseModel):
    start_at: datetime | None = None
    end_at: datetime | None = None
    break_slots: list[BreakSlot] | None = None
    availability_status: str | None = None
    notes: str | None = None


class ShiftItem(BaseModel):
    id: UUID
    therapist_id: UUID
    shop_id: UUID
    date: date
    start_at: datetime
    end_at: datetime
    break_slots: list[dict[str, Any]]
    availability_status: str
    notes: str | None
    created_at: datetime | None
    updated_at: datetime | None


def _serialize(shift: models.TherapistShift) -> ShiftItem:
    return ShiftItem(
        id=shift.id,
        therapist_id=shift.therapist_id,
        shop_id=shift.shop_id,
        date=shift.date,
        start_at=shift.start_at,
        end_at=shift.end_at,
        break_slots=shift.break_slots or [],
        availability_status=(
            shift.availability_status.value
            if hasattr(shift.availability_status, "value")
            else shift.availability_status
        ),
        notes=shift.notes,
        created_at=shift.created_at,
        updated_at=shift.updated_at,
    )


async def _get_shop(db: AsyncSession, profile_id: UUID) -> models.Profile:
    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop_not_found")
    return profile


async def _get_shift(
    db: AsyncSession, profile_id: UUID, shift_id: UUID
) -> models.TherapistShift:
    stmt = select(models.TherapistShift).where(
        models.TherapistShift.id == shift_id,
        models.TherapistShift.shop_id == profile_id,
    )
    res = await db.execute(stmt)
    shift = res.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="shift_not_found")
    return shift


async def _has_overlap(
    db: AsyncSession,
    therapist_id: UUID,
    start_at: datetime,
    end_at: datetime,
    exclude_id: UUID | None = None,
) -> bool:
    stmt = select(models.TherapistShift).where(
        models.TherapistShift.therapist_id == therapist_id,
        models.TherapistShift.start_at < end_at,
        models.TherapistShift.end_at > start_at,
    )
    if exclude_id:
        stmt = stmt.where(models.TherapistShift.id != exclude_id)
    res = await db.execute(stmt)
    return res.scalar_one_or_none() is not None


async def _verify_therapist_belongs_to_shop(
    db: AsyncSession, profile_id: UUID, therapist_id: UUID
) -> models.Therapist:
    stmt = select(models.Therapist).where(
        models.Therapist.id == therapist_id,
        models.Therapist.profile_id == profile_id,
    )
    res = await db.execute(stmt)
    therapist = res.scalar_one_or_none()
    if not therapist:
        raise HTTPException(status_code=404, detail="therapist_not_found")
    return therapist


# 同期処理は app.services.availability_sync からインポート


@router.get(
    "/shops/{profile_id}/shifts",
    response_model=list[ShiftItem],
)
async def list_shifts(
    profile_id: UUID,
    therapist_id: UUID | None = None,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> list[ShiftItem]:
    # 店舗所属確認
    await verify_shop_manager(db, user.id, profile_id)
    await _get_shop(db, profile_id)

    stmt = select(models.TherapistShift).where(
        models.TherapistShift.shop_id == profile_id
    )
    if therapist_id:
        stmt = stmt.where(models.TherapistShift.therapist_id == therapist_id)
    if date_from:
        stmt = stmt.where(models.TherapistShift.date >= date_from)
    if date_to:
        stmt = stmt.where(models.TherapistShift.date <= date_to)

    stmt = stmt.order_by(models.TherapistShift.date, models.TherapistShift.start_at)
    res = await db.execute(stmt)
    items = res.scalars().all()
    return [_serialize(s) for s in items]


@router.post(
    "/shops/{profile_id}/shifts",
    response_model=ShiftItem,
    status_code=status.HTTP_201_CREATED,
)
async def create_shift(
    profile_id: UUID,
    payload: ShiftCreatePayload,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> ShiftItem:
    # 店舗所属確認
    await verify_shop_manager(db, user.id, profile_id)
    await _get_shop(db, profile_id)
    await _verify_therapist_belongs_to_shop(db, profile_id, payload.therapist_id)

    if payload.start_at >= payload.end_at:
        raise HTTPException(status_code=400, detail="invalid_time_range")

    if await _has_overlap(db, payload.therapist_id, payload.start_at, payload.end_at):
        raise HTTPException(status_code=409, detail="shift_overlaps_existing")

    shift = models.TherapistShift(
        therapist_id=payload.therapist_id,
        shop_id=profile_id,
        date=payload.date,
        start_at=payload.start_at,
        end_at=payload.end_at,
        break_slots=[bs.model_dump() for bs in payload.break_slots],
        availability_status=payload.availability_status or "available",
        notes=payload.notes,
    )
    db.add(shift)
    await db.commit()
    await db.refresh(shift)

    # Availabilityテーブルを同期
    await sync_availability_for_date(db, profile_id, payload.date)
    await db.commit()

    return _serialize(shift)


@router.get(
    "/shops/{profile_id}/shifts/{shift_id}",
    response_model=ShiftItem,
)
async def get_shift(
    profile_id: UUID,
    shift_id: UUID,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> ShiftItem:
    # 店舗所属確認
    await verify_shop_manager(db, user.id, profile_id)
    shift = await _get_shift(db, profile_id, shift_id)
    return _serialize(shift)


@router.patch(
    "/shops/{profile_id}/shifts/{shift_id}",
    response_model=ShiftItem,
)
async def update_shift(
    profile_id: UUID,
    shift_id: UUID,
    payload: ShiftUpdatePayload,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> ShiftItem:
    # 店舗所属確認
    await verify_shop_manager(db, user.id, profile_id)
    shift = await _get_shift(db, profile_id, shift_id)

    new_start = payload.start_at if payload.start_at else shift.start_at
    new_end = payload.end_at if payload.end_at else shift.end_at

    if new_start >= new_end:
        raise HTTPException(status_code=400, detail="invalid_time_range")

    if await _has_overlap(
        db, shift.therapist_id, new_start, new_end, exclude_id=shift_id
    ):
        raise HTTPException(status_code=409, detail="shift_overlaps_existing")

    if payload.start_at is not None:
        shift.start_at = payload.start_at
    if payload.end_at is not None:
        shift.end_at = payload.end_at
    if payload.break_slots is not None:
        shift.break_slots = [bs.model_dump() for bs in payload.break_slots]
    if payload.availability_status is not None:
        shift.availability_status = payload.availability_status
    if payload.notes is not None:
        shift.notes = payload.notes

    db.add(shift)
    await db.commit()
    await db.refresh(shift)

    # Availabilityテーブルを同期
    await sync_availability_for_date(db, profile_id, shift.date)
    await db.commit()

    return _serialize(shift)


@router.delete(
    "/shops/{profile_id}/shifts/{shift_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_shift(
    profile_id: UUID,
    shift_id: UUID,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
):
    # 店舗所属確認
    await verify_shop_manager(db, user.id, profile_id)
    shift = await _get_shift(db, profile_id, shift_id)
    shift_date = shift.date
    shop_id = shift.shop_id
    await db.delete(shift)
    await db.commit()

    # Availabilityテーブルを同期（シフト削除後）
    await sync_availability_for_date(db, shop_id, shift_date)
    await db.commit()
