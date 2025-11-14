from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...schemas import ReservationAdminList, ReservationAdminUpdate
from .services import reservation_service

router = APIRouter()


@router.get("/api/admin/reservations", summary="List reservations", response_model=ReservationAdminList)
async def list_reservations(
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_session),
):
    return await reservation_service.list_reservations(
        db=db,
        status_filter=status,
        limit=limit,
        offset=offset,
    )


@router.patch("/api/admin/reservations/{reservation_id}", summary="Update reservation status")
async def update_reservation_admin(
    request: Request,
    reservation_id: str,
    payload: ReservationAdminUpdate,
    db: AsyncSession = Depends(get_session),
):
    return await reservation_service.update_reservation(
        request=request,
        db=db,
        reservation_id=UUID(reservation_id),
        payload=payload,
    )
