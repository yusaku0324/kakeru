from __future__ import annotations

from datetime import datetime, date
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...models import GuestReservation, Therapist, Profile
from ...deps import require_admin, audit_admin


router = APIRouter(
    prefix="/api/admin/guest_reservations",
    tags=["admin-guest-reservations"],
    dependencies=[Depends(require_admin), Depends(audit_admin)],
)


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        # interpret as date boundary (start of day)
        d = date.fromisoformat(value)
        return datetime.combine(d, datetime.min.time())
    except ValueError:
        return None


def _end_of_day(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        d = date.fromisoformat(value)
        return datetime.combine(d, datetime.max.time())
    except ValueError:
        return None


@router.get("")
async def list_guest_reservations(
    shop_id: UUID = Query(..., description="対象店舗ID"),
    date_from: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    date_to: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_session),
):
    start_dt = _parse_date(date_from)
    end_dt = _end_of_day(date_to)

    stmt = (
        select(
            GuestReservation.id,
            GuestReservation.shop_id,
            GuestReservation.therapist_id,
            GuestReservation.start_at,
            GuestReservation.end_at,
            GuestReservation.status,
            GuestReservation.notes,
            GuestReservation.contact_info,
            GuestReservation.created_at,
            GuestReservation.updated_at,
            Therapist.name.label("therapist_name"),
            Profile.name.label("shop_name"),
        )
        .join(Therapist, Therapist.id == GuestReservation.therapist_id, isouter=True)
        .join(Profile, Profile.id == GuestReservation.shop_id, isouter=True)
        .where(GuestReservation.shop_id == shop_id)
        .order_by(GuestReservation.start_at.asc())
    )

    if start_dt:
        stmt = stmt.where(GuestReservation.start_at >= start_dt)
    if end_dt:
        stmt = stmt.where(GuestReservation.end_at <= end_dt)

    res = await db.execute(stmt)
    rows = res.all()
    items: list[dict[str, Any]] = []
    for row in rows:
        items.append(
            {
                "id": str(row.id),
                "shop_id": str(row.shop_id),
                "shop_name": row.shop_name or "",
                "therapist_id": str(row.therapist_id) if row.therapist_id else None,
                "therapist_name": row.therapist_name or "",
                "start_at": row.start_at.isoformat() if row.start_at else None,
                "end_at": row.end_at.isoformat() if row.end_at else None,
                "status": row.status,
                "notes": row.notes,
                "contact_info": row.contact_info,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
        )

    return {"items": items, "total": len(items)}
