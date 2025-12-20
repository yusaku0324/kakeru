"""Utility functions for guest reservations."""

from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ....models import GuestReservation, Profile
from ....services.business_hours import load_booking_rules_from_profile
from ....utils.datetime import ensure_jst_datetime
from ..utils import normalize_shop_menus


def parse_datetime(value: Any) -> Optional[datetime]:
    """Parse a datetime value from various input types."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


def coerce_uuid(value: Any) -> UUID | None:
    """Convert a value to UUID if possible."""
    if isinstance(value, UUID):
        return value
    if isinstance(value, str):
        try:
            return UUID(value)
        except ValueError:
            return None
    return None


def attach_reason(reservation: GuestReservation, reason: str | None) -> None:
    """Append a reason to reservation notes."""
    if not reason:
        return
    reservation.notes = (
        f"{reservation.notes}\n{reason}" if reservation.notes else reason
    )


async def try_fetch_profile(db: AsyncSession, shop_id: Any) -> Profile | None:
    """Fetch a profile by shop_id, fail-soft."""
    shop_uuid = coerce_uuid(shop_id)
    if not shop_uuid:
        return None
    try:
        res = await db.execute(select(Profile).where(Profile.id == shop_uuid))
    except Exception:  # pragma: no cover - fail-open
        try:
            await db.rollback()
        except Exception:
            pass
        return None
    if res is None:
        return None
    if hasattr(res, "scalar_one_or_none"):
        return res.scalar_one_or_none()
    if hasattr(res, "scalar"):
        return res.scalar()
    return None


def resolve_course_duration_minutes(
    profile: Profile | None,
    course_id: Any,
) -> int | None:
    """Resolve course duration from profile menus."""
    if profile is None:
        return None
    course_uuid = coerce_uuid(course_id)
    if course_uuid is None:
        return None
    menus = normalize_shop_menus((profile.contact_json or {}).get("menus"), profile.id)
    for menu in menus:
        if menu.id == course_uuid and isinstance(menu.duration_minutes, int):
            if menu.duration_minutes > 0:
                return menu.duration_minutes
    return None


def normalize_extension_minutes(
    ext: Any,
    *,
    step: int,
    max_: int,
) -> tuple[int, str | None]:
    """Normalize and validate extension minutes."""
    if ext is None:
        return 0, None
    try:
        ext_minutes = int(ext)
    except Exception:
        return 0, "invalid_extension"
    if ext_minutes < 0:
        return 0, "invalid_extension"
    if max_ <= 0 and ext_minutes != 0:
        return 0, "invalid_extension"
    if step <= 0:
        return 0, "invalid_extension"
    if ext_minutes % step != 0:
        return 0, "invalid_extension"
    if ext_minutes > max_:
        return 0, "invalid_extension"
    return ext_minutes, None


def compute_booking_times(
    *,
    profile: Profile | None,
    start_at: datetime,
    course_id: Any,
    base_duration_minutes: Any,
    planned_extension_minutes: Any,
) -> tuple[int, int, int, datetime, datetime, str | None]:
    """
    Compute reservation time fields.

    Returns: (service_duration, extension, buffer, service_end, occupied_end, error)
    """
    rules = load_booking_rules_from_profile(profile)
    ext_minutes, ext_err = normalize_extension_minutes(
        planned_extension_minutes,
        step=rules.extension_step_minutes,
        max_=rules.max_extension_minutes,
    )
    if ext_err:
        return 0, 0, 0, start_at, start_at, ext_err

    resolved_course_duration = resolve_course_duration_minutes(profile, course_id)
    duration_minutes = resolved_course_duration
    if duration_minutes is None:
        try:
            if base_duration_minutes is not None:
                duration_minutes = int(base_duration_minutes)
        except Exception:
            duration_minutes = None

    if duration_minutes is None or duration_minutes <= 0:
        return 0, 0, 0, start_at, start_at, "invalid_timing"

    service_duration_minutes = duration_minutes + ext_minutes
    if service_duration_minutes <= 0:
        return 0, 0, 0, start_at, start_at, "invalid_timing"

    buffer_minutes = rules.base_buffer_minutes
    if buffer_minutes < 0:
        buffer_minutes = 0

    start_jst = ensure_jst_datetime(start_at)
    service_end_at = start_jst + timedelta(minutes=service_duration_minutes)
    occupied_end_at = service_end_at + timedelta(minutes=buffer_minutes)
    return (
        service_duration_minutes,
        ext_minutes,
        buffer_minutes,
        service_end_at,
        occupied_end_at,
        None,
    )


def reservation_status_value(reservation: GuestReservation) -> str:
    """Get the string value of a reservation status."""
    value = reservation.status
    if hasattr(value, "value"):
        value = value.value
    return str(value)


def is_active_shop_reservation(reservation: GuestReservation, now: datetime) -> bool:
    """Check if a reservation is currently active."""
    status_value = reservation_status_value(reservation)
    if status_value in {"pending", "confirmed"}:
        return True
    if status_value != "reserved":
        return False
    reserved_until = getattr(reservation, "reserved_until", None)
    if reserved_until is None:
        return True
    return reserved_until > now


async def count_overlapping_active_shop_reservations(
    db: AsyncSession,
    *,
    shop_id: UUID,
    start_at: datetime,
    end_at: datetime,
    now: datetime,
    lock: bool = False,
) -> int:
    """Count overlapping active reservations for room capacity check."""
    stmt = select(GuestReservation).where(
        GuestReservation.shop_id == shop_id,
        GuestReservation.status.in_(("pending", "confirmed", "reserved")),
        GuestReservation.start_at < end_at,
        GuestReservation.end_at > start_at,
    )
    if lock:
        try:
            stmt = stmt.with_for_update()
        except Exception:
            pass
    res = await db.execute(stmt)
    if res is None:
        return 0

    reservations: list[GuestReservation] = []
    if hasattr(res, "scalars"):
        scalars = res.scalars()
        if hasattr(scalars, "all"):
            reservations = list(scalars.all())
    elif hasattr(res, "rows"):
        rows = getattr(res, "rows", None)
        if isinstance(rows, list) and rows and isinstance(rows[0], GuestReservation):
            reservations = list(rows)

    active = [r for r in reservations if is_active_shop_reservation(r, now)]
    return len(active)
