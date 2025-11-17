from __future__ import annotations

from dataclasses import replace
from typing import Any, List, Optional
from uuid import UUID

from datetime import date, datetime, time, timezone, timedelta
from zoneinfo import ZoneInfo
import base64
import json
import hmac
import hashlib

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .... import models, schemas
from ....constants import RESERVATION_STATUS_SET
from ....db import get_session
from ....deps import require_dashboard_user
from ....notifications import (
    ReservationNotification,
    enqueue_reservation_notification,
    is_notification_worker_enabled,
)
from ....services import reservation_notifications as reservation_notifications_service
from ...admin import reservations as admin_reservations
from ....settings import settings

REMINDER_LEAD_HOURS = 3

JST = ZoneInfo("Asia/Tokyo")

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


async def _ensure_profile(db: AsyncSession, profile_id: UUID) -> models.Profile:
    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="profile_not_found")
    return profile


def _serialize_reservation(
    reservation: models.Reservation,
) -> schemas.DashboardReservationItem:
    preferred_slots: List[schemas.DashboardReservationPreferredSlot] = []
    for slot in getattr(reservation, "preferred_slots", []) or []:
        preferred_slots.append(
            schemas.DashboardReservationPreferredSlot(
                desired_start=slot.desired_start,
                desired_end=slot.desired_end,
                status=slot.status,  # type: ignore[arg-type]
            )
        )
    return schemas.DashboardReservationItem(
        id=reservation.id,
        status=reservation.status,  # type: ignore[arg-type]
        channel=reservation.channel,
        desired_start=reservation.desired_start,
        desired_end=reservation.desired_end,
        customer_name=reservation.customer_name,
        customer_phone=reservation.customer_phone,
        customer_email=reservation.customer_email,
        notes=reservation.notes,
        marketing_opt_in=getattr(reservation, "marketing_opt_in", None),
        staff_id=reservation.staff_id,
        created_at=reservation.created_at,
        updated_at=reservation.updated_at,
        approval_decision=getattr(reservation, "approval_decision", None),
        approval_decided_at=getattr(reservation, "approval_decided_at", None),
        approval_decided_by=getattr(reservation, "approval_decided_by", None),
        reminder_scheduled_at=getattr(reservation, "reminder_scheduled_at", None),
        preferred_slots=preferred_slots,
    )


_enqueue_reservation_notification_for_reservation = (
    reservation_notifications_service.enqueue_reservation_notification_for_reservation
)


async def _schedule_dashboard_reservation_reminder(
    db: AsyncSession,
    reservation: models.Reservation,
    base_notification: ReservationNotification,
) -> None:
    desired_start = reservation.desired_start
    if desired_start.tzinfo is None:
        desired_start = desired_start.replace(tzinfo=timezone.utc)

    reminder_at = desired_start - timedelta(hours=REMINDER_LEAD_HOURS)
    now = models.now_utc()
    if reminder_at <= now:
        return

    already_scheduled = getattr(reservation, "reminder_scheduled_at", None)
    if already_scheduled and already_scheduled >= reminder_at:
        return

    reminder_notification = replace(
        base_notification,
        reminder_at=reminder_at.isoformat(),
        event="reminder",
        audience=base_notification.audience or "customer",
        status="confirmed",
    )

    await enqueue_reservation_notification(
        db, reminder_notification, schedule_at=reminder_at
    )
    if hasattr(reservation, "reminder_scheduled_at"):
        reservation.reminder_scheduled_at = reminder_at


def _parse_date_param(value: str, *, field: str, is_end: bool = False) -> datetime:
    try:
        if len(value) == 10:
            parsed_date = date.fromisoformat(value)
            parsed_datetime = datetime.combine(
                parsed_date,
                time.max if is_end else time.min,
                tzinfo=timezone.utc,
            )
        else:
            parsed_datetime = datetime.fromisoformat(value)
            if parsed_datetime.tzinfo is None:
                parsed_datetime = parsed_datetime.replace(tzinfo=timezone.utc)
            else:
                parsed_datetime = parsed_datetime.astimezone(timezone.utc)
    except ValueError as exc:  # pragma: no cover - validation path
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "field": field,
                "message": "日付パラメータの形式が正しくありません。",
            },
        ) from exc

    if (
        is_end
        and parsed_datetime.time() == time.max
        and parsed_datetime.tzinfo is timezone.utc
    ):
        # time.max already includes microseconds=999999, keep inclusive by staying as-is
        return parsed_datetime

    return parsed_datetime


def _encode_cursor(value: datetime, reservation_id: UUID) -> str:
    payload = {
        "value": value.isoformat(),
        "id": str(reservation_id),
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode(
        "utf-8"
    )
    encoded_payload = base64.urlsafe_b64encode(payload_bytes).decode("utf-8")
    secret = getattr(settings, "cursor_signature_secret", None)
    if secret:
        digest = hmac.new(
            secret.encode("utf-8"), payload_bytes, hashlib.sha256
        ).digest()
        signature = base64.urlsafe_b64encode(digest).decode("utf-8")
        return f"{encoded_payload}.{signature}"
    return encoded_payload


def _decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    secret = getattr(settings, "cursor_signature_secret", None)
    if secret:
        if "." not in cursor:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "field": "cursor",
                    "message": "カーソルの形式が正しくありません。",
                },
            )
        encoded_payload, encoded_signature = cursor.split(".", 1)
    else:
        encoded_payload = cursor
        encoded_signature = None

    try:
        payload_bytes = base64.urlsafe_b64decode(encoded_payload.encode("utf-8"))
        payload = json.loads(payload_bytes.decode("utf-8"))
        if secret:
            expected = hmac.new(
                secret.encode("utf-8"), payload_bytes, hashlib.sha256
            ).digest()
            provided = base64.urlsafe_b64decode(encoded_signature.encode("utf-8"))
            if not hmac.compare_digest(expected, provided):
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "field": "cursor",
                        "message": "カーソルの検証に失敗しました。",
                    },
                )
        value = datetime.fromisoformat(payload["value"])
        reservation_id = UUID(payload["id"])
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        else:
            value = value.astimezone(timezone.utc)
        return value, reservation_id
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field": "cursor", "message": "カーソルの形式が正しくありません。"},
        ) from exc


@router.get(
    "/shops/{profile_id}/reservations",
    response_model=schemas.DashboardReservationListResponse,
)
async def list_dashboard_reservations(
    profile_id: UUID,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    sort: str = Query(default="latest", pattern="^(latest|date)$"),
    direction: str = Query(default="desc", pattern="^(asc|desc)$"),
    query: Optional[str] = Query(default=None, alias="q"),
    start_date: Optional[str] = Query(default=None, alias="start"),
    end_date: Optional[str] = Query(default=None, alias="end"),
    mode: Optional[str] = Query(default=None, pattern="^(today|tomorrow)$"),
    cursor: Optional[str] = Query(default=None),
    cursor_direction: str = Query(default="forward", pattern="^(forward|backward)$"),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> schemas.DashboardReservationListResponse:
    _ = user
    profile = await _ensure_profile(db, profile_id)

    filters = [models.Reservation.shop_id == profile.id]

    if status_filter:
        if status_filter not in RESERVATION_STATUS_SET:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "field": "status",
                    "message": "不正なステータスが指定されました。",
                },
            )
        filters.append(models.Reservation.status == status_filter)

    if query:
        value = query.strip()
        if value:
            pattern = f"%{value}%"
            filters.append(
                or_(
                    models.Reservation.customer_name.ilike(pattern),
                    models.Reservation.customer_phone.ilike(pattern),
                    models.Reservation.customer_email.ilike(pattern),
                )
            )

    if mode:
        today_jst = datetime.now(JST).date()
        target_date = today_jst if mode == "today" else today_jst + timedelta(days=1)
        start_dt = datetime.combine(target_date, time.min, tzinfo=JST).astimezone(
            timezone.utc
        )
        end_dt = datetime.combine(target_date, time.max, tzinfo=JST).astimezone(
            timezone.utc
        )
        filters.append(models.Reservation.desired_start >= start_dt)
        filters.append(models.Reservation.desired_start <= end_dt)
    else:
        if start_date:
            start_dt = _parse_date_param(start_date, field="start")
            filters.append(models.Reservation.desired_start >= start_dt)

        if end_date:
            end_dt = _parse_date_param(end_date, field="end", is_end=True)
            filters.append(models.Reservation.desired_start <= end_dt)

    sort_column = (
        models.Reservation.created_at
        if sort == "latest"
        else models.Reservation.desired_start
    )
    order_clause = sort_column.asc() if direction == "asc" else sort_column.desc()
    id_order_clause = (
        models.Reservation.id.asc()
        if direction == "asc"
        else models.Reservation.id.desc()
    )

    if cursor:
        cursor_value, cursor_id = _decode_cursor(cursor)
        if direction == "desc":
            if cursor_direction == "forward":
                filters.append(
                    or_(
                        sort_column < cursor_value,
                        (sort_column == cursor_value)
                        & (models.Reservation.id < cursor_id),
                    )
                )
            else:
                filters.append(
                    or_(
                        sort_column > cursor_value,
                        (sort_column == cursor_value)
                        & (models.Reservation.id > cursor_id),
                    )
                )
        else:
            if cursor_direction == "forward":
                filters.append(
                    or_(
                        sort_column > cursor_value,
                        (sort_column == cursor_value)
                        & (models.Reservation.id > cursor_id),
                    )
                )
            else:
                filters.append(
                    or_(
                        sort_column < cursor_value,
                        (sort_column == cursor_value)
                        & (models.Reservation.id < cursor_id),
                    )
                )

    stmt = (
        select(models.Reservation)
        .where(*filters)
        .options(selectinload(models.Reservation.preferred_slots))
        .order_by(order_clause, id_order_clause)
        .limit(limit + 1)
    )

    total_stmt = select(func.count()).where(*filters)

    result = await db.execute(stmt)
    reservations = list(result.scalars().all())
    next_cursor: Optional[str] = None
    if len(reservations) > limit:
        last_item = reservations.pop()
        cursor_value = (
            last_item.created_at if sort == "latest" else last_item.desired_start
        )
        next_cursor = _encode_cursor(cursor_value, last_item.id)

    prev_cursor: Optional[str] = None
    if cursor and reservations:
        first_item = reservations[0]
        first_value = (
            first_item.created_at if sort == "latest" else first_item.desired_start
        )
        prev_cursor = _encode_cursor(first_value, first_item.id)

    total = await db.scalar(total_stmt) or 0

    return schemas.DashboardReservationListResponse(
        profile_id=profile.id,
        total=int(total),
        reservations=[
            _serialize_reservation(reservation) for reservation in reservations
        ],
        next_cursor=next_cursor,
        prev_cursor=prev_cursor,
    )


__all__ = [
    "router",
    "_serialize_reservation",
    "_parse_date_param",
    "_encode_cursor",
    "_decode_cursor",
]


@router.patch(
    "/shops/{profile_id}/reservations/{reservation_id}",
    response_model=schemas.DashboardReservationItem,
)
async def update_dashboard_reservation(
    profile_id: UUID,
    reservation_id: UUID,
    payload: schemas.DashboardReservationUpdateRequest,
    response: Response,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> schemas.DashboardReservationItem:
    profile = await _ensure_profile(db, profile_id)

    stmt = (
        select(models.Reservation)
        .where(
            models.Reservation.id == reservation_id,
            models.Reservation.shop_id == profile.id,
        )
        .options(selectinload(models.Reservation.preferred_slots))
    )
    result = await db.execute(stmt)
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="reservation_not_found")

    new_status = payload.status
    if new_status not in RESERVATION_STATUS_SET:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field": "status", "message": "不正なステータスが指定されました。"},
        )

    now = models.now_utc()
    status_changed = reservation.status != new_status

    note_text = (payload.note or "").strip()
    if note_text:
        if reservation.notes:
            reservation.notes = f"{reservation.notes}\n{note_text}"
        else:
            reservation.notes = note_text

    if status_changed:
        reservation.status = new_status
        event = models.ReservationStatusEvent(
            reservation_id=reservation.id,
            status=new_status,
            changed_at=now,
            changed_by="dashboard",
            note=note_text or None,
        )
        db.add(event)

        decision_value = None
        if new_status == "confirmed":
            decision_value = "approved"
        elif new_status == "declined":
            decision_value = "declined"
        reservation.approval_decision = decision_value
        reservation.approval_decided_at = now if decision_value else None
        reservation.approval_decided_by = str(user.id) if decision_value else None

    reservation.updated_at = now

    await db.flush()

    conflict_detected = False
    if status_changed and new_status in {"pending", "confirmed"}:
        conflict_detected = await admin_reservations._check_overlap(
            db,
            reservation.shop_id,
            reservation.desired_start,
            reservation.desired_end,
            exclude_reservation_id=reservation.id,
        )
        if conflict_detected:
            response.headers["X-Reservation-Conflict"] = "1"

    async_job_status: dict[str, str | None] | None = None
    if status_changed and new_status in {"confirmed", "declined"}:
        shop = await admin_reservations._ensure_shop(db, reservation.shop_id)
        queue_active = is_notification_worker_enabled()
        notification = await _enqueue_reservation_notification_for_reservation(
            db,
            reservation,
            shop,
        )
        async_job_status = {
            "status": "queued" if queue_active else "skipped",
            "error": None,
        }

        if new_status == "confirmed":
            await _schedule_dashboard_reservation_reminder(
                db, reservation, notification
            )

    await db.commit()
    await db.refresh(reservation)
    await db.refresh(reservation, attribute_names=["preferred_slots"])

    payload = _serialize_reservation(reservation)
    if async_job_status:
        payload_dict = payload.model_dump()
        payload_dict["async_job"] = async_job_status
        return payload_dict  # type: ignore[return-value]

    return payload
