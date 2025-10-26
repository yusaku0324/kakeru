from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..db import get_session
from ..schemas import (
    Reservation as ReservationSchema,
    ReservationCreateRequest,
    ReservationStatusEvent,
    ReservationUpdateRequest,
)
from ..deps import require_admin, audit_admin, get_optional_user
from ..notifications import ReservationNotification, schedule_reservation_notification


router = APIRouter(prefix="/api/v1/reservations", tags=["reservations"])

_DEFAULT_NOTIFICATION_STATUSES = ("pending", "confirmed")


def _reservation_to_schema(reservation: models.Reservation) -> ReservationSchema:
    history = [
        ReservationStatusEvent(
            status=event.status,  # type: ignore[arg-type]
            changed_at=event.changed_at,
            changed_by=event.changed_by,
            note=event.note,
        )
        for event in sorted(reservation.status_events, key=lambda e: e.changed_at)
    ]

    customer = {
        "name": reservation.customer_name,
        "phone": reservation.customer_phone,
        "email": reservation.customer_email,
        "line_id": reservation.customer_line_id,
        "remark": reservation.customer_remark,
        "id": None,
    }

    return ReservationSchema(
        id=reservation.id,
        status=reservation.status,  # type: ignore[arg-type]
        shop_id=reservation.shop_id,
        staff_id=reservation.staff_id,
        menu_id=reservation.menu_id,
        channel=reservation.channel,
        desired_start=reservation.desired_start,
        desired_end=reservation.desired_end,
        notes=reservation.notes,
        customer=customer,  # type: ignore[arg-type]
        status_history=history,
        marketing_opt_in=reservation.marketing_opt_in,
        created_at=reservation.created_at,
        updated_at=reservation.updated_at,
    )


async def _ensure_shop(db: AsyncSession, shop_id: UUID) -> models.Profile:
    shop = await db.get(models.Profile, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="shop not found")
    return shop


async def _check_overlap(
    db: AsyncSession,
    shop_id: UUID,
    desired_start: datetime,
    desired_end: datetime,
    exclude_reservation_id: Optional[UUID] = None,
) -> bool:
    stmt = select(models.Reservation).where(
        models.Reservation.shop_id == shop_id,
        models.Reservation.status.in_(["pending", "confirmed"]),
        models.Reservation.desired_start < desired_end,
        models.Reservation.desired_end > desired_start,
    )
    if exclude_reservation_id:
        stmt = stmt.where(models.Reservation.id != exclude_reservation_id)
    res = await db.execute(stmt.limit(1))
    return res.scalar_one_or_none() is not None


async def _resolve_notification_channels(
    db: AsyncSession,
    shop_id: UUID,
    status: str,
) -> dict[str, Any]:
    setting = await db.get(models.DashboardNotificationSetting, shop_id)
    if not setting:
        return {"emails": [], "slack": None, "line": None}

    if setting.trigger_status is None:
        trigger_status = list(_DEFAULT_NOTIFICATION_STATUSES)
    else:
        trigger_status = list(setting.trigger_status)

    if status not in trigger_status:
        return {"emails": [], "slack": None, "line": None}

    channels = setting.channels or {}

    email_conf = channels.get("email") or {}
    emails = email_conf.get("recipients", []) if email_conf.get("enabled") else []
    if not isinstance(emails, list):
        emails = []

    slack_conf = channels.get("slack") or {}
    slack_url = slack_conf.get("webhook_url") if slack_conf.get("enabled") else None
    if isinstance(slack_url, str):
        slack_url = slack_url.strip() or None
    else:
        slack_url = None

    line_conf = channels.get("line") or {}
    line_token = line_conf.get("token") if line_conf.get("enabled") else None
    if isinstance(line_token, str):
        line_token = line_token.strip() or None
    else:
        line_token = None

    return {"emails": emails, "slack": slack_url, "line": line_token}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_reservation(
    payload: ReservationCreateRequest,
    db: AsyncSession = Depends(get_session),
    user: Optional[models.User] = Depends(get_optional_user),
):
    if payload.desired_end <= payload.desired_start:
        raise HTTPException(status_code=400, detail="desired_end must be after desired_start")

    shop = await _ensure_shop(db, payload.shop_id)

    has_overlap = await _check_overlap(db, payload.shop_id, payload.desired_start, payload.desired_end)
    if has_overlap:
        raise HTTPException(status_code=409, detail="conflicting reservation slot")

    reservation = models.Reservation(
        shop_id=payload.shop_id,
        staff_id=payload.staff_id,
        menu_id=payload.menu_id,
        channel=payload.channel,
        desired_start=payload.desired_start,
        desired_end=payload.desired_end,
        notes=payload.notes,
        marketing_opt_in=bool(payload.marketing_opt_in),
        customer_name=payload.customer.name,
        customer_phone=payload.customer.phone,
        customer_email=payload.customer.email,
        customer_line_id=payload.customer.line_id,
        customer_remark=payload.customer.remark,
    )
    if user:
        reservation.user_id = user.id
    if not reservation.status:
        reservation.status = 'pending'
    initial_status = reservation.status
    status_event = models.ReservationStatusEvent(
        status=initial_status,
        changed_at=datetime.now(timezone.utc),
        changed_by="system",
        note=None,
    )
    reservation.status_events.append(status_event)

    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)
    await db.refresh(reservation, attribute_names=["status_events"])

    channels_config = await _resolve_notification_channels(db, reservation.shop_id, reservation.status)

    contact = getattr(shop, "contact_json", None) or {}
    shop_phone = contact.get("phone") or contact.get("tel")
    if isinstance(shop_phone, (int, float)):
        shop_phone = str(shop_phone)
    if isinstance(shop_phone, str):
        shop_phone = shop_phone.strip() or None
    else:
        shop_phone = None

    shop_line_contact = contact.get("line") or contact.get("line_url") or contact.get("line_id")
    if isinstance(shop_line_contact, str):
        shop_line_contact = shop_line_contact.strip() or None
    else:
        shop_line_contact = None

    schedule_reservation_notification(
        ReservationNotification(
            reservation_id=str(reservation.id),
            shop_id=str(reservation.shop_id),
            shop_name=getattr(shop, "name", None) or str(reservation.shop_id),
            customer_name=reservation.customer_name,
            customer_phone=reservation.customer_phone,
            desired_start=reservation.desired_start.isoformat(),
            desired_end=reservation.desired_end.isoformat(),
            status=reservation.status,
            channel=reservation.channel or "web",
            notes=reservation.notes,
            customer_email=reservation.customer_email,
            shop_phone=shop_phone,
            shop_line_contact=shop_line_contact,
            email_recipients=[addr for addr in channels_config.get("emails", []) if isinstance(addr, str)],
            slack_webhook_url=channels_config.get("slack"),
            line_notify_token=channels_config.get("line"),
        )
    )

    return _reservation_to_schema(reservation).model_dump()


@router.get("/{reservation_id}")
async def get_reservation(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_session),
    _admin: None = Depends(require_admin),
    __audit: None = Depends(audit_admin),
):
    reservation = await db.get(models.Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="reservation not found")
    await db.refresh(reservation, attribute_names=["status_events"])
    return _reservation_to_schema(reservation).model_dump()


@router.patch("/{reservation_id}")
async def update_reservation(
    reservation_id: UUID,
    payload: ReservationUpdateRequest,
    db: AsyncSession = Depends(get_session),
    _admin: None = Depends(require_admin),
    __audit: None = Depends(audit_admin),
):
    if payload.status is None and payload.staff_id is None and payload.notes is None:
        raise HTTPException(status_code=400, detail="no updates provided")

    reservation = await db.get(models.Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="reservation not found")

    status_changed = False
    note: Optional[str] = None

    if payload.staff_id is not None:
        reservation.staff_id = payload.staff_id
    if payload.notes is not None:
        reservation.notes = payload.notes
        note = payload.notes
    if payload.status is not None and payload.status != reservation.status:
        if payload.status not in {"pending", "confirmed", "declined", "cancelled", "expired"}:
            raise HTTPException(status_code=400, detail="invalid status")
        reservation.status = payload.status
        status_changed = True

    if payload.response_message:
        note = (note or "") + (f"\n{payload.response_message}" if note else payload.response_message)

    if status_changed or note:
        event = models.ReservationStatusEvent(
            reservation_id=reservation.id,
            status=reservation.status,
            changed_at=datetime.now(timezone.utc),
            changed_by="admin",
            note=note,
        )
        db.add(event)

    await db.commit()
    await db.refresh(reservation)
    await db.refresh(reservation, attribute_names=["status_events"])

    return _reservation_to_schema(reservation).model_dump()
