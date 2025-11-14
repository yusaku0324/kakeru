from __future__ import annotations

from datetime import datetime, timedelta, timezone
import secrets
from typing import Sequence, Tuple

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ... import models, schemas
from ...db import get_session
from ...settings import settings


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def require_ops_token(authorization: str | None = Header(None, alias="Authorization")) -> None:
    """Enforce optional bearer token for Ops endpoints."""
    token = getattr(settings, "ops_api_token", None)
    if not token:
        return

    if not authorization:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="ops_token_required")

    scheme, _, credentials = authorization.partition(" ")
    candidate = credentials.strip() if credentials else authorization.strip()
    if scheme.lower() == "bearer":
        candidate = credentials.strip()

    if not candidate or not secrets.compare_digest(candidate, token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="ops_token_invalid")


router = APIRouter(prefix="/api/ops", tags=["ops"], dependencies=[Depends(require_ops_token)])


async def _get_queue_stats(db: AsyncSession) -> schemas.OpsQueueStats:
    stmt = (
        select(
            func.count(models.ReservationNotificationDelivery.id),
            func.min(models.ReservationNotificationDelivery.created_at),
            func.min(models.ReservationNotificationDelivery.next_attempt_at),
        )
        .where(models.ReservationNotificationDelivery.status == "pending")
    )
    result = await db.execute(stmt)
    pending, oldest_created_at, next_attempt_at = result.one()

    pending_count = int(pending or 0)
    if not pending_count:
        return schemas.OpsQueueStats(
            pending=0,
            lag_seconds=0.0,
            oldest_created_at=None,
            next_attempt_at=None,
        )

    now = _utcnow()
    lag_seconds = 0.0
    if oldest_created_at:
        lag_seconds = max(0.0, (now - oldest_created_at).total_seconds())

    return schemas.OpsQueueStats(
        pending=pending_count,
        lag_seconds=lag_seconds,
        oldest_created_at=oldest_created_at,
        next_attempt_at=next_attempt_at,
    )


async def _get_outbox_summary(db: AsyncSession) -> schemas.OpsOutboxSummary:
    stmt = (
        select(
            models.ReservationNotificationDelivery.channel,
            func.count(models.ReservationNotificationDelivery.id),
        )
        .where(models.ReservationNotificationDelivery.status == "pending")
        .group_by(models.ReservationNotificationDelivery.channel)
        .order_by(models.ReservationNotificationDelivery.channel.asc())
    )
    result = await db.execute(stmt)
    rows: Sequence[Tuple[str, int]] = result.all()

    channels = [
        schemas.OpsOutboxChannelSummary(channel=channel, pending=int(count or 0))
        for channel, count in rows
    ]
    return schemas.OpsOutboxSummary(channels=channels)


async def _get_slots_summary(db: AsyncSession) -> schemas.OpsSlotsSummary:
    now = _utcnow()
    window_end = now + timedelta(hours=24)

    pending_total_stmt = select(func.count(models.Reservation.id)).where(models.Reservation.status == "pending")
    pending_stale_stmt = (
        select(func.count(models.Reservation.id))
        .where(models.Reservation.status == "pending")
        .where(models.Reservation.desired_start < now)
    )
    confirmed_stmt = (
        select(func.count(models.Reservation.id))
        .where(models.Reservation.status == "confirmed")
        .where(models.Reservation.desired_start >= now)
        .where(models.Reservation.desired_start < window_end)
    )

    pending_total = int(await db.scalar(pending_total_stmt) or 0)
    pending_stale = int(await db.scalar(pending_stale_stmt) or 0)
    confirmed_next_24h = int(await db.scalar(confirmed_stmt) or 0)

    return schemas.OpsSlotsSummary(
        pending_total=pending_total,
        pending_stale=pending_stale,
        confirmed_next_24h=confirmed_next_24h,
        window_start=now,
        window_end=window_end,
    )


@router.get("/queue", response_model=schemas.OpsQueueStats)
async def get_ops_queue(
    db: AsyncSession = Depends(get_session),
) -> schemas.OpsQueueStats:
    return await _get_queue_stats(db)


@router.get("/outbox", response_model=schemas.OpsOutboxSummary)
async def get_ops_outbox(
    db: AsyncSession = Depends(get_session),
) -> schemas.OpsOutboxSummary:
    return await _get_outbox_summary(db)


@router.get("/slots", response_model=schemas.OpsSlotsSummary)
async def get_ops_slots(
    db: AsyncSession = Depends(get_session),
) -> schemas.OpsSlotsSummary:
    return await _get_slots_summary(db)
