from __future__ import annotations

import logging
import uuid
from datetime import date as Date
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session

router = APIRouter(prefix="/api/guest/reservations", tags=["guest-reservations"])
logger = logging.getLogger(__name__)


class Slot(BaseModel):
    start_at: str
    end_at: str


class ReservationRequest(BaseModel):
    guest_id: str | None = None
    guest_token: str | None = None
    profile_id: str | None = None
    therapist_id: str | None = None
    date: Date
    slot: Slot
    menu_id: str | None = None
    price: float | None = None
    payment_method: str | None = None
    contact_info: Dict[str, Any] | None = None
    notes: str | None = None


class ReservationCancelRequest(BaseModel):
    reservation_id: str
    reason: str | None = None
    actor: str = Field(..., pattern="^(guest|staff|admin)$")


class Reservation(BaseModel):
    id: str
    guest_id: str | None = None
    guest_token: str | None = None
    profile_id: str | None = None
    therapist_id: str | None = None
    status: str
    slot: Slot
    price: float | None = None
    menu_id: str | None = None
    contact_info: Dict[str, Any] | None = None
    notes: str | None = None
    created_at: str
    updated_at: str


# In-memory store for v1 acceptance; to be replaced with DB/migrations later.
_RES_STORE: dict[str, Reservation] = {}


def _find_conflict(payload: ReservationRequest) -> bool:
    for res in _RES_STORE.values():
        if res.therapist_id == payload.therapist_id and res.status != "cancelled":
            if (
                res.slot.start_at == payload.slot.start_at
                and res.slot.end_at == payload.slot.end_at
            ):
                return True
    return False


@router.post("/", response_model=Reservation, status_code=status.HTTP_201_CREATED)
async def create_guest_reservation(
    payload: ReservationRequest, db: AsyncSession = Depends(get_session)
) -> Reservation:
    # Duplicate slot check (simple)
    if _find_conflict(payload):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="duplicate_slot",
        )

    res_id = str(uuid.uuid4())
    status_value = "confirmed"
    now_iso = Date.today().isoformat()
    res = Reservation(
        id=res_id,
        guest_id=payload.guest_id,
        guest_token=payload.guest_token,
        profile_id=payload.profile_id,
        therapist_id=payload.therapist_id,
        status=status_value,
        slot=payload.slot,
        price=payload.price,
        menu_id=payload.menu_id,
        contact_info=payload.contact_info,
        notes=payload.notes,
        created_at=now_iso,
        updated_at=now_iso,
    )
    _RES_STORE[res_id] = res
    return res


@router.post("/{reservation_id}/cancel")
async def cancel_guest_reservation(
    reservation_id: str,
    payload: ReservationCancelRequest,
    db: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    res = _RES_STORE.get(reservation_id)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="reservation_not_found"
        )
    if res.status != "cancelled":
        res.status = "cancelled"
        _RES_STORE[reservation_id] = res
    return {"ok": True, "status": res.status}


@router.get("/{reservation_id}", response_model=Reservation)
async def get_guest_reservation(
    reservation_id: str, db: AsyncSession = Depends(get_session)
) -> Reservation:
    res = _RES_STORE.get(reservation_id)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="reservation_not_found"
        )
    return res
