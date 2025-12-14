from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import GuestReservation

logger = logging.getLogger(__name__)

# NOTE:
# `HOLD_TTL_MINUTES` is currently defined in `app.domains.site.guest_reservations`.
# This constant is used only as a defensive fallback when `reserved_until` is NULL.
DEFAULT_HOLD_TTL_MINUTES = 15


def _status_value(reservation: GuestReservation) -> str:
    value = reservation.status
    if hasattr(value, "value"):
        value = value.value
    return str(value)


def _should_expire_hold(
    reservation: GuestReservation,
    *,
    now: datetime,
    ttl_minutes: int,
) -> bool:
    if _status_value(reservation) != "reserved":
        return False

    reserved_until = getattr(reservation, "reserved_until", None)
    if reserved_until is not None:
        return reserved_until <= now

    created_at = getattr(reservation, "created_at", None)
    if created_at is None:
        return False

    cutoff = now - timedelta(minutes=ttl_minutes)
    return created_at <= cutoff


async def expire_reserved_holds(
    db: AsyncSession,
    *,
    now: datetime | None = None,
    ttl_minutes: int = DEFAULT_HOLD_TTL_MINUTES,
    limit: int = 1000,
) -> int:
    """Expire GuestReservation holds (status=reserved) past TTL.

    - Normal path: `reserved_until <= now` -> status=expired
    - Defensive: `reserved_until IS NULL` -> expire when `created_at <= now - ttl`

    Caller is responsible for committing the transaction.
    """
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=ttl_minutes)

    stmt = (
        select(GuestReservation)
        .where(GuestReservation.status == "reserved")
        .where(
            or_(
                and_(
                    GuestReservation.reserved_until.is_not(None),
                    GuestReservation.reserved_until <= now,
                ),
                and_(
                    GuestReservation.reserved_until.is_(None),
                    GuestReservation.created_at <= cutoff,
                ),
            )
        )
        .limit(limit)
    )
    res = await db.execute(stmt)
    reservations = list(res.scalars().all())

    expired: list[GuestReservation] = []
    for reservation in reservations:
        if not _should_expire_hold(reservation, now=now, ttl_minutes=ttl_minutes):
            continue
        reservation.status = "expired"
        reservation.updated_at = now
        expired.append(reservation)

    if expired:
        logger.info(
            "expire_reserved_holds: expired=%s ttl_minutes=%s limit=%s",
            len(expired),
            ttl_minutes,
            limit,
        )

    return len(expired)
