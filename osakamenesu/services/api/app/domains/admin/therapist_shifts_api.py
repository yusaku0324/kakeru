from __future__ import annotations

import logging
from datetime import datetime, date
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...models import TherapistShift, TherapistShiftStatus

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
    db: AsyncSession = Depends(get_session),
):
    stmt = select(TherapistShift)
    if therapist_id:
        stmt = stmt.where(TherapistShift.therapist_id == therapist_id)
    if date_filter:
        stmt = stmt.where(TherapistShift.date == date_filter)
    res = await db.execute(stmt.order_by(TherapistShift.start_at))
    items = res.scalars().all()
    return {"items": [_serialize(s) for s in items]}


@router.post("/api/admin/therapist_shifts", status_code=status.HTTP_201_CREATED)
async def create_shift(
    payload: TherapistShiftPayload,
    db: AsyncSession = Depends(get_session),
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
        break_slots=[bs.model_dump() for bs in payload.break_slots],
        availability_status=payload.availability_status or "available",
        notes=payload.notes,
    )
    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    return _serialize(shift)


@router.put("/api/admin/therapist_shifts/{shift_id}")
async def update_shift(
    shift_id: UUID,
    payload: TherapistShiftPayload,
    db: AsyncSession = Depends(get_session),
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

    shift.therapist_id = payload.therapist_id
    shift.shop_id = payload.shop_id
    shift.date = payload.date
    shift.start_at = payload.start_at
    shift.end_at = payload.end_at
    shift.break_slots = [bs.model_dump() for bs in payload.break_slots]
    shift.availability_status = payload.availability_status or "available"
    shift.notes = payload.notes

    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    return _serialize(shift)


@router.delete(
    "/api/admin/therapist_shifts/{shift_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_shift(
    shift_id: UUID,
    db: AsyncSession = Depends(get_session),
):
    shift = await _get_shift(db, shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="shift_not_found")
    await db.delete(shift)
    await db.commit()
    return {"ok": True}
