"""Guest reservations API router."""

import os
import sys
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ....db import get_session
from ....deps import get_optional_site_user
from ....models import GuestReservation, User
from ....rate_limiters import rate_limit_reservation

from .schemas import (
    GuestReservationPayload,
    GuestReservationHoldPayload,
    GuestReservationResponse,
    serialize_reservation,
    make_rejected_response,
)


router = APIRouter(prefix="/api/guest/reservations", tags=["guest-reservations"])

_IS_PRODUCTION = (
    os.getenv("FLY_APP_NAME") is not None or os.getenv("VERCEL") is not None
)


def _get_parent_module():
    """Get parent module for monkeypatching support."""
    return sys.modules.get("app.domains.site.guest_reservations")


def _safe_debug(debug: dict[str, Any] | None) -> dict[str, Any] | None:
    """Filter debug info for production."""
    if not _IS_PRODUCTION:
        return debug
    if debug:
        return {"rejected_reasons": debug.get("rejected_reasons", [])}
    return None


@router.post(
    "",
    response_model=GuestReservationResponse,
    status_code=status.HTTP_200_OK,
)
async def create_guest_reservation_api(
    payload: GuestReservationPayload,
    db: AsyncSession = Depends(get_session),
    user: Optional[User] = Depends(get_optional_site_user),
    _: None = Depends(rate_limit_reservation),
):
    parent = _get_parent_module()
    data = payload.model_dump()
    if user:
        data["user_id"] = user.id
    else:
        data["user_id"] = None
    reservation, debug = await parent.create_guest_reservation(db, data, now=None)
    if reservation:
        return serialize_reservation(reservation, debug=None)
    return make_rejected_response(
        payload, _safe_debug(debug), user.id if user else None
    )


@router.post(
    "/hold",
    response_model=GuestReservationResponse,
    status_code=status.HTTP_200_OK,
)
async def hold_guest_reservation_api(
    payload: GuestReservationHoldPayload,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_session),
    user: Optional[User] = Depends(get_optional_site_user),
    _: None = Depends(rate_limit_reservation),
):
    if len(idempotency_key) > 256:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="idempotency_key_too_long",
        )

    parent = _get_parent_module()
    data = payload.model_dump()
    if user:
        data["user_id"] = user.id
    else:
        data["user_id"] = None

    reservation, debug, error_code = await parent.create_guest_reservation_hold(
        db,
        data,
        idempotency_key=idempotency_key,
        now=None,
    )
    if error_code == "idempotency_key_conflict":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="idempotency_key_conflict",
        )
    if reservation:
        return serialize_reservation(reservation, debug=None)
    return make_rejected_response(
        payload, _safe_debug(debug), user.id if user else None
    )


@router.post(
    "/{reservation_id}/cancel",
    response_model=GuestReservationResponse,
    status_code=status.HTTP_200_OK,
)
async def cancel_guest_reservation_api(
    reservation_id: UUID,
    guest_token: Optional[str] = None,
    db: AsyncSession = Depends(get_session),
    user: Optional[User] = Depends(get_optional_site_user),
):
    res = await db.execute(
        select(GuestReservation).where(GuestReservation.id == reservation_id)
    )
    reservation = res.scalar_one_or_none()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="reservation_not_found"
        )

    is_owner = False
    if user and reservation.user_id == user.id:
        is_owner = True
    elif guest_token and reservation.guest_token == guest_token:
        is_owner = True

    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="not_authorized"
        )

    parent = _get_parent_module()
    cancelled = await parent.cancel_guest_reservation(db, reservation_id)
    if not cancelled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="reservation_not_found"
        )
    return serialize_reservation(cancelled, debug=None)


@router.get(
    "/{reservation_id}",
    response_model=GuestReservationResponse,
    status_code=status.HTTP_200_OK,
)
async def get_guest_reservation_api(
    reservation_id: UUID,
    guest_token: Optional[str] = None,
    db: AsyncSession = Depends(get_session),
    user: Optional[User] = Depends(get_optional_site_user),
):
    res = await db.execute(
        select(GuestReservation).where(GuestReservation.id == reservation_id)
    )
    reservation = res.scalar_one_or_none()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="reservation_not_found"
        )

    is_owner = False
    if user and reservation.user_id == user.id:
        is_owner = True
    elif guest_token and reservation.guest_token == guest_token:
        is_owner = True

    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="not_authorized"
        )

    return serialize_reservation(reservation, debug=None)


@router.get(
    "",
    response_model=list[GuestReservationResponse],
    status_code=status.HTTP_200_OK,
)
async def list_guest_reservations_api(
    guest_token: Optional[str] = None,
    db: AsyncSession = Depends(get_session),
    user: Optional[User] = Depends(get_optional_site_user),
):
    if user:
        res = await db.execute(
            select(GuestReservation)
            .where(GuestReservation.user_id == user.id)
            .order_by(desc(GuestReservation.start_at))
        )
    elif guest_token:
        res = await db.execute(
            select(GuestReservation)
            .where(GuestReservation.guest_token == guest_token)
            .order_by(desc(GuestReservation.start_at))
        )
    else:
        return []
    reservations = res.scalars().all()
    return [serialize_reservation(r, debug=None) for r in reservations]
