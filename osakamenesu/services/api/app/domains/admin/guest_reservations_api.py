from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...deps import require_admin, audit_admin
from ...models import GuestReservation, Profile, Therapist
from ..site.guest_reservations import update_guest_reservation_status

router = APIRouter()


class AdminGuestReservation(BaseModel):
    id: UUID
    shop_id: UUID
    shop_name: str | None = None
    therapist_id: UUID | None = None
    therapist_name: str | None = None
    start_at: datetime
    end_at: datetime
    status: str
    duration_minutes: int | None = None
    course_id: UUID | None = None
    price: float | None = None
    payment_method: str | None = None
    contact_info: dict[str, Any] | None = None
    notes: str | None = None
    base_staff_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class AdminGuestReservationListResponse(BaseModel):
    items: list[AdminGuestReservation]
    summary: dict[str, int]


class AdminGuestReservationStatusPayload(BaseModel):
    status: str
    reason: str | None = None


def _status_value(reservation: GuestReservation) -> str:
    status_value = reservation.status
    if hasattr(status_value, "value"):
        status_value = status_value.value
    return str(status_value)


def _serialize_admin_reservation(
    reservation: GuestReservation,
    therapist_names: dict[UUID, str] | None = None,
    shop_names: dict[UUID, str] | None = None,
) -> AdminGuestReservation:
    therapist_names = therapist_names or {}
    shop_names = shop_names or {}
    return AdminGuestReservation(
        id=reservation.id,
        shop_id=reservation.shop_id,
        shop_name=shop_names.get(reservation.shop_id),
        therapist_id=reservation.therapist_id,
        therapist_name=therapist_names.get(reservation.therapist_id)
        if reservation.therapist_id
        else None,
        start_at=reservation.start_at,
        end_at=reservation.end_at,
        status=_status_value(reservation),
        duration_minutes=reservation.duration_minutes,
        course_id=reservation.course_id,
        price=reservation.price,
        payment_method=reservation.payment_method,
        contact_info=reservation.contact_info,
        notes=reservation.notes,
        base_staff_id=reservation.base_staff_id,
        created_at=reservation.created_at,
        updated_at=reservation.updated_at,
    )


@router.get(
    "/api/admin/guest_reservations",
    response_model=AdminGuestReservationListResponse,
)
async def list_guest_reservations(
    shop_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    stmt = select(GuestReservation).order_by(desc(GuestReservation.start_at))
    if shop_id:
        stmt = stmt.where(GuestReservation.shop_id == shop_id)
    if date_from:
        stmt = stmt.where(GuestReservation.start_at >= date_from)
    if date_to:
        stmt = stmt.where(GuestReservation.start_at <= date_to)
    res = await db.execute(stmt)
    reservations = res.scalars().all()

    therapist_ids = list({r.therapist_id for r in reservations if r.therapist_id})
    therapist_names: dict[UUID, str] = {}
    if therapist_ids:
        th_res = await db.execute(
            select(Therapist).where(Therapist.id.in_(therapist_ids))
        )
        therapist_names = {t.id: t.name for t in th_res.scalars().all()}

    shop_ids = list({r.shop_id for r in reservations})
    shop_names: dict[UUID, str] = {}
    if shop_ids:
        shop_res = await db.execute(select(Profile).where(Profile.id.in_(shop_ids)))
        shop_names = {s.id: s.name for s in shop_res.scalars().all()}

    summary: dict[str, int] = {}
    for r in reservations:
        status_value = _status_value(r)
        summary[status_value] = summary.get(status_value, 0) + 1

    items = [
        _serialize_admin_reservation(r, therapist_names, shop_names)
        for r in reservations
    ]
    return AdminGuestReservationListResponse(items=items, summary=summary)


@router.get(
    "/api/admin/guest_reservations/{reservation_id}",
    response_model=AdminGuestReservation,
)
async def get_guest_reservation_detail(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    res = await db.execute(
        select(GuestReservation).where(GuestReservation.id == reservation_id)
    )
    reservation = res.scalar_one_or_none()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="reservation_not_found"
        )

    therapist_names: dict[UUID, str] = {}
    if reservation.therapist_id:
        th_res = await db.execute(
            select(Therapist).where(Therapist.id == reservation.therapist_id)
        )
        therapist = th_res.scalar_one_or_none()
        if therapist:
            therapist_names[therapist.id] = therapist.name

    shop_names: dict[UUID, str] = {}
    if reservation.shop_id:
        shop_res = await db.execute(
            select(Profile).where(Profile.id == reservation.shop_id)
        )
        shop = shop_res.scalar_one_or_none()
        if shop:
            shop_names[shop.id] = shop.name

    return _serialize_admin_reservation(reservation, therapist_names, shop_names)


@router.post(
    "/api/admin/guest_reservations/{reservation_id}/status",
)
async def update_guest_reservation_status_api(
    reservation_id: UUID,
    payload: AdminGuestReservationStatusPayload,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    reservation, error = await update_guest_reservation_status(
        db, reservation_id, payload.status, reason=payload.reason
    )
    if not reservation and error == "not_found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="reservation_not_found"
        )
    if error == "invalid_status":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_status"
        )
    if error == "invalid_transition":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_status_transition"
        )

    return {"ok": True, "status": _status_value(reservation)}
