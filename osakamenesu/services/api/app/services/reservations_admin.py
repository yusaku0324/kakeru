from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Mapping
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..constants import DEFAULT_RESERVATION_STATUS, RESERVATION_STATUS_SET, ReservationStatusLiteral
from ..schemas import ReservationAdminList, ReservationAdminSummary

logger = logging.getLogger(__name__)


def _stringify_optional(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed or None
    try:
        trimmed = str(value).strip()
    except Exception:
        return None
    return trimmed or None


def _stringify_required(value: Any) -> str:
    return _stringify_optional(value) or ""


def _normalize_status(value: Any) -> ReservationStatusLiteral:
    candidate: str | None = None
    if isinstance(value, str):
        candidate = value.strip().lower() or None
    else:
        try:
            candidate = str(value).strip().lower() or None
        except Exception:
            candidate = None
    if candidate and candidate in RESERVATION_STATUS_SET:
        return candidate  # type: ignore[return-value]
    return DEFAULT_RESERVATION_STATUS


def _coerce_datetime(value: Any, *, fallback: datetime | None = None) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed
        except ValueError:
            pass
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc)
        except Exception:
            pass
    return fallback or datetime.now(timezone.utc)


def build_reservation_summary(
    reservation: Any,
    shop_names: Mapping[UUID, str],
) -> ReservationAdminSummary:
    """Normalize a reservation record for admin API responses."""
    fallback_now = datetime.now(timezone.utc)
    try:
        shop_id = getattr(reservation, "shop_id")
        reservation_id = getattr(reservation, "id")

        status = _normalize_status(getattr(reservation, "status", None))
        channel = _stringify_optional(getattr(reservation, "channel", None))
        notes = _stringify_optional(getattr(reservation, "notes", None))
        customer_name = _stringify_required(getattr(reservation, "customer_name", ""))
        customer_phone = _stringify_required(getattr(reservation, "customer_phone", ""))
        customer_email = _stringify_optional(getattr(reservation, "customer_email", None))
        desired_start = _coerce_datetime(getattr(reservation, "desired_start", None), fallback=fallback_now)
        desired_end = _coerce_datetime(getattr(reservation, "desired_end", None), fallback=fallback_now)
        created_at = _coerce_datetime(getattr(reservation, "created_at", None), fallback=fallback_now)
        updated_at = _coerce_datetime(getattr(reservation, "updated_at", None), fallback=created_at)

        return ReservationAdminSummary(
            id=reservation_id,
            shop_id=shop_id,
            shop_name=shop_names.get(shop_id, "") or "",
            status=status,  # type: ignore[arg-type]
            desired_start=desired_start,
            desired_end=desired_end,
            channel=channel,
            notes=notes,
            customer_name=customer_name,
            customer_phone=customer_phone,
            customer_email=customer_email,
            created_at=created_at,
            updated_at=updated_at,
        )
    except Exception:
        logger.exception(
            "admin/reservations serialization failed",
            extra={"reservation_id": getattr(reservation, "id", None)},
        )
        now = fallback_now
        fallback_id = getattr(reservation, "id", uuid.uuid4())
        if not isinstance(fallback_id, UUID):
            try:
                fallback_id = UUID(str(fallback_id))
            except Exception:
                fallback_id = uuid.uuid4()
        fallback_shop_id = getattr(reservation, "shop_id", uuid.uuid4())
        if not isinstance(fallback_shop_id, UUID):
            try:
                fallback_shop_id = UUID(str(fallback_shop_id))
            except Exception:
                fallback_shop_id = uuid.uuid4()

        return ReservationAdminSummary(
            id=fallback_id,
            shop_id=fallback_shop_id,
            shop_name=shop_names.get(fallback_shop_id, "") or "",
            status=DEFAULT_RESERVATION_STATUS,
            desired_start=_coerce_datetime(getattr(reservation, "desired_start", None), fallback=now),
            desired_end=_coerce_datetime(getattr(reservation, "desired_end", None), fallback=now),
            channel=None,
            notes=None,
            customer_name="",
            customer_phone="",
            customer_email=None,
            created_at=_coerce_datetime(getattr(reservation, "created_at", None), fallback=now),
            updated_at=_coerce_datetime(getattr(reservation, "updated_at", None), fallback=now),
        )


async def list_reservations(
    db: AsyncSession,
    *,
    status: str | None,
    limit: int,
    offset: int,
) -> ReservationAdminList:
    """Fetch reservations for the admin dashboard with shop metadata."""

    stmt = select(models.Reservation).order_by(models.Reservation.created_at.desc())
    count_stmt = select(func.count()).select_from(models.Reservation)

    if status:
        stmt = stmt.where(models.Reservation.status == status)
        count_stmt = count_stmt.where(models.Reservation.status == status)

    reservations_result = await db.execute(stmt.offset(offset).limit(limit))
    reservations = reservations_result.scalars().all()

    total = (await db.execute(count_stmt)).scalar_one()

    shop_names: dict[UUID, str] = {}
    shop_ids = [r.shop_id for r in reservations]
    if shop_ids:
        profiles_result = await db.execute(
            select(models.Profile.id, models.Profile.name).where(models.Profile.id.in_(shop_ids))
        )
        shop_names = dict(profiles_result.all())

    items = [build_reservation_summary(reservation, shop_names) for reservation in reservations]

    return ReservationAdminList(total=total, items=items)
