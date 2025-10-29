from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Mapping
from uuid import UUID

from ..constants import DEFAULT_RESERVATION_STATUS, RESERVATION_STATUS_SET, ReservationStatusLiteral
from ..schemas import ReservationAdminSummary

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


def build_reservation_summary(
    reservation: Any,
    shop_names: Mapping[UUID, str],
) -> ReservationAdminSummary:
    """Normalize a reservation record for admin API responses."""
    try:
        shop_id = getattr(reservation, "shop_id")
        reservation_id = getattr(reservation, "id")

        status = _normalize_status(getattr(reservation, "status", None))
        channel = _stringify_optional(getattr(reservation, "channel", None))
        notes = _stringify_optional(getattr(reservation, "notes", None))
        customer_name = _stringify_required(getattr(reservation, "customer_name", ""))
        customer_phone = _stringify_required(getattr(reservation, "customer_phone", ""))
        customer_email = _stringify_optional(getattr(reservation, "customer_email", None))

        return ReservationAdminSummary(
            id=reservation_id,
            shop_id=shop_id,
            shop_name=shop_names.get(shop_id, "") or "",
            status=status,  # type: ignore[arg-type]
            desired_start=getattr(reservation, "desired_start"),
            desired_end=getattr(reservation, "desired_end"),
            channel=channel,
            notes=notes,
            customer_name=customer_name,
            customer_phone=customer_phone,
            customer_email=customer_email,
            created_at=getattr(reservation, "created_at"),
            updated_at=getattr(reservation, "updated_at"),
        )
    except Exception:
        logger.exception(
            "admin/reservations serialization failed",
            extra={"reservation_id": getattr(reservation, "id", None)},
        )
        now = datetime.now(timezone.utc)
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
            desired_start=getattr(reservation, "desired_start", now),
            desired_end=getattr(reservation, "desired_end", now),
            channel=None,
            notes=None,
            customer_name="",
            customer_phone="",
            customer_email=None,
            created_at=getattr(reservation, "created_at", now),
            updated_at=getattr(reservation, "updated_at", now),
        )
