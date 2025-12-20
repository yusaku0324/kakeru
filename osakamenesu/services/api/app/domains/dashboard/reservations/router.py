"""Dashboard reservations router - uses GuestReservation for unified reservation management."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from datetime import datetime, time, timezone, timedelta
from zoneinfo import ZoneInfo
import base64
import json
import hmac
import hashlib
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models, schemas
from ....db import get_session
from ....deps import require_dashboard_user, verify_shop_manager
from ....settings import settings
from ...site.guest_reservations import update_guest_reservation_status

# GuestReservation statuses that map to dashboard status set
GUEST_RESERVATION_STATUS_SET = {
    "pending",
    "confirmed",
    "cancelled",
    "expired",
    "reserved",
    "no_show",
}

JST = ZoneInfo("Asia/Tokyo")

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

logger = logging.getLogger(__name__)


async def _ensure_profile(db: AsyncSession, profile_id: UUID) -> models.Profile:
    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="profile_not_found")
    return profile


def _serialize_guest_reservation(
    reservation: models.GuestReservation,
) -> schemas.DashboardReservationItem:
    """Serialize GuestReservation to DashboardReservationItem."""
    # Map status - GuestReservation uses different status values
    status_val = reservation.status
    if hasattr(status_val, "value"):
        status_val = status_val.value

    # Map to dashboard status - "reserved" and "no_show" map to cancelled for dashboard
    status_mapping = {
        "pending": "pending",
        "confirmed": "confirmed",
        "cancelled": "cancelled",
        "expired": "expired",
        "reserved": "pending",  # hold status -> pending
        "no_show": "cancelled",
        "draft": "pending",
    }
    dashboard_status = status_mapping.get(status_val, "pending")

    # Extract customer info from contact_info or dedicated fields
    contact = reservation.contact_info or {}
    customer_name = reservation.customer_name or contact.get("name") or "ゲスト"
    customer_phone = reservation.customer_phone or contact.get("phone") or ""
    customer_email = reservation.customer_email or contact.get("email")

    return schemas.DashboardReservationItem(
        id=reservation.id,
        status=dashboard_status,  # type: ignore[arg-type]
        channel=reservation.channel,
        desired_start=reservation.start_at,
        desired_end=reservation.end_at,
        customer_name=customer_name,
        customer_phone=customer_phone,
        customer_email=customer_email,
        notes=reservation.notes,
        marketing_opt_in=None,  # Not tracked in GuestReservation
        staff_id=reservation.therapist_id,
        created_at=reservation.created_at,
        updated_at=reservation.updated_at,
        approval_decision=None,  # Not tracked in GuestReservation
        approval_decided_at=None,
        approval_decided_by=None,
        reminder_scheduled_at=None,
        preferred_slots=[],  # GuestReservation doesn't have preferred slots
    )


def _parse_date_param(value: str, *, field: str, is_end: bool = False) -> datetime:
    """Parse date string to datetime.

    Supports:
    - Date only: YYYY-MM-DD (interpreted as UTC)
    - ISO datetime with timezone: YYYY-MM-DDTHH:MM:SS+HH:MM (converted to UTC)
    """
    try:
        # Try ISO format with timezone first
        if "T" in value:
            parsed = datetime.fromisoformat(value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)

        # Date-only format
        parsed = datetime.strptime(value, "%Y-%m-%d")
        if is_end:
            parsed = datetime.combine(parsed.date(), time.max)
        else:
            parsed = datetime.combine(parsed.date(), time.min)
        return parsed.replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "field": field,
                "message": "日付の形式が正しくありません（YYYY-MM-DD）。",
            },
        ) from exc


def _encode_cursor(value: datetime, reservation_id: UUID) -> str:
    """Encode cursor for pagination."""
    payload = json.dumps(
        {"value": value.isoformat(), "id": str(reservation_id)},
        separators=(",", ":"),
    ).encode("utf-8")
    secret = settings.cursor_signature_secret
    if secret:
        signature = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).digest()
        return (
            base64.urlsafe_b64encode(payload).decode("utf-8")
            + "."
            + base64.urlsafe_b64encode(signature).decode("utf-8")
        )
    return base64.urlsafe_b64encode(payload).decode("utf-8")


def _decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    """Decode cursor for pagination."""
    secret = settings.cursor_signature_secret
    try:
        if "." in cursor:
            encoded_payload, encoded_signature = cursor.rsplit(".", 1)
        else:
            encoded_payload = cursor
            encoded_signature = ""
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
    except Exception as exc:
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
    """List GuestReservations for a shop (dashboard view)."""
    await verify_shop_manager(db, user.id, profile_id)
    profile = await _ensure_profile(db, profile_id)

    filters = [models.GuestReservation.shop_id == profile.id]

    # Status filter - map dashboard status to GuestReservation statuses
    if status_filter:
        # Map dashboard status to GuestReservation statuses
        status_mapping = {
            "pending": ["pending", "reserved", "draft"],
            "confirmed": ["confirmed"],
            "declined": [
                "cancelled"
            ],  # Dashboard uses "declined", GuestReservation uses "cancelled"
            "cancelled": ["cancelled"],
            "expired": ["expired"],
        }
        mapped_statuses = status_mapping.get(status_filter, [status_filter])
        filters.append(models.GuestReservation.status.in_(mapped_statuses))

    # Text search - search customer fields
    if query:
        value = query.strip()
        if value:
            pattern = f"%{value}%"
            filters.append(
                or_(
                    models.GuestReservation.customer_name.ilike(pattern),
                    models.GuestReservation.customer_phone.ilike(pattern),
                    models.GuestReservation.customer_email.ilike(pattern),
                    models.GuestReservation.notes.ilike(pattern),
                )
            )

    # Date filtering
    if mode:
        today_jst = datetime.now(JST).date()
        target_date = today_jst if mode == "today" else today_jst + timedelta(days=1)
        start_dt = datetime.combine(target_date, time.min, tzinfo=JST).astimezone(
            timezone.utc
        )
        end_dt = datetime.combine(target_date, time.max, tzinfo=JST).astimezone(
            timezone.utc
        )
        filters.append(models.GuestReservation.start_at >= start_dt)
        filters.append(models.GuestReservation.start_at <= end_dt)
    else:
        if start_date:
            start_dt = _parse_date_param(start_date, field="start")
            filters.append(models.GuestReservation.start_at >= start_dt)

        if end_date:
            end_dt = _parse_date_param(end_date, field="end", is_end=True)
            filters.append(models.GuestReservation.start_at <= end_dt)

    # Sorting
    sort_column = (
        models.GuestReservation.created_at
        if sort == "latest"
        else models.GuestReservation.start_at
    )
    order_clause = sort_column.asc() if direction == "asc" else sort_column.desc()
    id_order_clause = (
        models.GuestReservation.id.asc()
        if direction == "asc"
        else models.GuestReservation.id.desc()
    )

    # Cursor-based pagination
    if cursor:
        cursor_value, cursor_id = _decode_cursor(cursor)
        if direction == "desc":
            if cursor_direction == "forward":
                filters.append(
                    or_(
                        sort_column < cursor_value,
                        (sort_column == cursor_value)
                        & (models.GuestReservation.id < cursor_id),
                    )
                )
            else:
                filters.append(
                    or_(
                        sort_column > cursor_value,
                        (sort_column == cursor_value)
                        & (models.GuestReservation.id > cursor_id),
                    )
                )
        else:
            if cursor_direction == "forward":
                filters.append(
                    or_(
                        sort_column > cursor_value,
                        (sort_column == cursor_value)
                        & (models.GuestReservation.id > cursor_id),
                    )
                )
            else:
                filters.append(
                    or_(
                        sort_column < cursor_value,
                        (sort_column == cursor_value)
                        & (models.GuestReservation.id < cursor_id),
                    )
                )

    stmt = (
        select(models.GuestReservation)
        .where(*filters)
        .order_by(order_clause, id_order_clause)
        .limit(limit + 1)
    )

    total_stmt = select(func.count()).select_from(
        select(models.GuestReservation).where(*filters).subquery()
    )

    result = await db.execute(stmt)
    reservations = list(result.scalars().all())
    next_cursor: Optional[str] = None
    if len(reservations) > limit:
        last_item = reservations.pop()
        cursor_value = last_item.created_at if sort == "latest" else last_item.start_at
        next_cursor = _encode_cursor(cursor_value, last_item.id)

    prev_cursor: Optional[str] = None
    if cursor and reservations:
        first_item = reservations[0]
        first_value = first_item.created_at if sort == "latest" else first_item.start_at
        prev_cursor = _encode_cursor(first_value, first_item.id)

    total = await db.scalar(total_stmt) or 0

    return schemas.DashboardReservationListResponse(
        profile_id=profile.id,
        total=int(total),
        reservations=[
            _serialize_guest_reservation(reservation) for reservation in reservations
        ],
        next_cursor=next_cursor,
        prev_cursor=prev_cursor,
    )


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
    """Update a GuestReservation status from the dashboard."""
    await verify_shop_manager(db, user.id, profile_id)
    profile = await _ensure_profile(db, profile_id)

    # Find the reservation
    stmt = select(models.GuestReservation).where(
        models.GuestReservation.id == reservation_id,
        models.GuestReservation.shop_id == profile.id,
    )
    result = await db.execute(stmt)
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="reservation_not_found")

    new_status = payload.status

    # Map dashboard status to GuestReservation status
    status_mapping = {
        "pending": "pending",
        "confirmed": "confirmed",
        "declined": "cancelled",  # Dashboard uses "declined", GuestReservation uses "cancelled"
        "cancelled": "cancelled",
        "expired": "expired",
    }
    guest_status = status_mapping.get(new_status, new_status)

    # Update notes if provided
    note_text = (payload.note or "").strip()
    if note_text:
        if reservation.notes:
            reservation.notes = f"{reservation.notes}\n{note_text}"
        else:
            reservation.notes = note_text
        db.add(reservation)

    # Update status using the service
    updated_reservation, error = await update_guest_reservation_status(
        db, reservation_id, guest_status, reason=note_text or None
    )

    if error == "not_found":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="reservation_not_found")
    if error == "invalid_status":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field": "status", "message": "不正なステータスが指定されました。"},
        )
    if error == "invalid_transition":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "field": "status",
                "message": "このステータス遷移は許可されていません。",
            },
        )

    await db.commit()
    await db.refresh(updated_reservation)

    return _serialize_guest_reservation(updated_reservation)


__all__ = [
    "router",
    "_serialize_guest_reservation",
    "_parse_date_param",
    "_encode_cursor",
    "_decode_cursor",
]
