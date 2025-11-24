from __future__ import annotations

from datetime import datetime, timezone
from http import HTTPStatus
from typing import List
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models
from ....schemas import (
    ReservationAdminList,
    ReservationAdminSummary,
    ReservationAdminUpdate,
)
from .audit import AdminAuditContext, record_change
from .errors import AdminServiceError


class ReservationServiceError(AdminServiceError):
    """Domain-level exception for admin reservation operations."""


async def list_reservations(
    *,
    db: AsyncSession,
    status_filter: str | None,
    limit: int,
    offset: int,
) -> ReservationAdminList:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    stmt = select(models.Reservation).order_by(models.Reservation.created_at.desc())
    count_stmt = select(func.count()).select_from(models.Reservation)
    if status_filter:
        stmt = stmt.where(models.Reservation.status == status_filter)
        count_stmt = count_stmt.where(models.Reservation.status == status_filter)

    result = await db.execute(stmt.offset(offset).limit(limit))
    reservations = list(result.scalars().all())
    total = (await db.execute(count_stmt)).scalar_one()

    shop_ids = [reservation.shop_id for reservation in reservations]
    shop_names: dict[UUID, str] = {}
    if shop_ids:
        res = await db.execute(
            select(models.Profile.id, models.Profile.name).where(
                models.Profile.id.in_(shop_ids)
            )
        )
        shop_names = dict(res.all())

    items: List[ReservationAdminSummary] = [
        ReservationAdminSummary(
            id=reservation.id,
            shop_id=reservation.shop_id,
            shop_name=shop_names.get(reservation.shop_id, ""),
            status=reservation.status,  # type: ignore[arg-type]
            desired_start=reservation.desired_start,
            desired_end=reservation.desired_end,
            channel=reservation.channel,
            notes=reservation.notes,
            customer_name=reservation.customer_name,
            customer_phone=reservation.customer_phone,
            customer_email=reservation.customer_email,
            created_at=reservation.created_at,
            updated_at=reservation.updated_at,
        )
        for reservation in reservations
    ]

    return ReservationAdminList(total=total, items=items)


async def update_reservation(
    *,
    audit_context: AdminAuditContext | None,
    db: AsyncSession,
    reservation_id: UUID,
    payload: ReservationAdminUpdate,
) -> dict[str, str | None]:
    if payload.status is None and payload.notes is None:
        raise ReservationServiceError(
            HTTPStatus.BAD_REQUEST, detail="no updates provided"
        )

    reservation = await db.get(models.Reservation, reservation_id)
    if not reservation:
        raise ReservationServiceError(
            HTTPStatus.NOT_FOUND, detail="reservation not found"
        )

    before = {
        "status": reservation.status,
        "notes": reservation.notes,
        "desired_start": reservation.desired_start.isoformat(),
        "desired_end": reservation.desired_end.isoformat(),
    }

    status_changed = False
    if payload.status is not None and payload.status != reservation.status:
        if payload.status not in {
            "pending",
            "confirmed",
            "declined",
            "cancelled",
            "expired",
        }:
            raise ReservationServiceError(
                HTTPStatus.BAD_REQUEST, detail="invalid status"
            )
        reservation.status = payload.status
        status_changed = True

    if payload.notes is not None:
        reservation.notes = payload.notes

    if status_changed or payload.notes is not None:
        event = models.ReservationStatusEvent(
            reservation_id=reservation.id,
            status=reservation.status,
            changed_at=datetime.now(timezone.utc),
            changed_by="admin",
            note=payload.notes,
        )
        db.add(event)

    await db.commit()
    await db.refresh(reservation)

    after = {
        "status": reservation.status,
        "notes": reservation.notes,
        "desired_start": reservation.desired_start.isoformat(),
        "desired_end": reservation.desired_end.isoformat(),
    }
    await record_change(
        db,
        context=audit_context,
        target_type="reservation",
        target_id=reservation.id,
        action="update",
        before=before,
        after=after,
    )

    return {
        "id": str(reservation.id),
        "status": reservation.status,
        "notes": reservation.notes,
    }
