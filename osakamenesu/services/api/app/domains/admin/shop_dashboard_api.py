from __future__ import annotations

import logging
from datetime import datetime, timedelta, date, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...deps import require_admin, audit_admin
from ...models import GuestReservation, Therapist, TherapistShift

logger = logging.getLogger(__name__)

router = APIRouter()


def _today_range(now: datetime) -> tuple[datetime, datetime]:
    start = now.astimezone(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    end = start + timedelta(days=1)
    return start, end


def _week_range(now: datetime) -> tuple[datetime, datetime]:
    today_start, today_end = _today_range(now)
    start = today_start - timedelta(days=7)
    end = today_end
    return start, end


async def _compute_dashboard(
    db: AsyncSession, shop_id: UUID, now: datetime
) -> dict[str, Any]:
    today_start, today_end = _today_range(now)
    week_start, week_end = _week_range(now)
    today_date = today_start.date()

    # Query 1: Count today's confirmed reservations (SQL aggregation)
    today_count_stmt = (
        select(func.count())
        .select_from(GuestReservation)
        .where(
            GuestReservation.shop_id == shop_id,
            GuestReservation.status == "confirmed",
            GuestReservation.start_at >= today_start,
            GuestReservation.start_at < today_end,
        )
    )
    today_count_res = await db.execute(today_count_stmt)
    today_reservations = today_count_res.scalar() or 0

    # Query 2: Count week's confirmed reservations (SQL aggregation)
    week_count_stmt = (
        select(func.count())
        .select_from(GuestReservation)
        .where(
            GuestReservation.shop_id == shop_id,
            GuestReservation.status == "confirmed",
            GuestReservation.start_at >= week_start,
            GuestReservation.start_at < week_end,
        )
    )
    week_count_res = await db.execute(week_count_stmt)
    week_reservations = week_count_res.scalar() or 0

    # Query 3: Get today's confirmed reservations for workload calculation
    today_res_stmt = select(GuestReservation).where(
        GuestReservation.shop_id == shop_id,
        GuestReservation.status == "confirmed",
        GuestReservation.start_at >= today_start,
        GuestReservation.start_at < today_end,
    )
    today_res_result = await db.execute(today_res_stmt)
    today_res = today_res_result.scalars().all()

    # Query 4: Get recent 5 reservations (with date filter for efficiency)
    recent_stmt = (
        select(GuestReservation)
        .where(GuestReservation.shop_id == shop_id)
        .order_by(desc(GuestReservation.start_at))
        .limit(5)
    )
    recent_res = await db.execute(recent_stmt)
    recent = recent_res.scalars().all()

    # Query 5: Therapist lookup for recent reservations
    therapist_ids = {r.therapist_id for r in recent if r.therapist_id}
    names: dict[UUID, str] = {}
    if therapist_ids:
        th_stmt = select(Therapist).where(Therapist.id.in_(therapist_ids))
        th_res = await db.execute(th_stmt)
        for th in th_res.scalars().all():
            names[th.id] = th.name

    # Query 6: Get today's available shifts (filtered by date in SQL)
    shift_stmt = select(TherapistShift).where(
        TherapistShift.shop_id == shop_id,
        TherapistShift.availability_status == "available",
        TherapistShift.date == today_date,
    )
    shift_res = await db.execute(shift_stmt)
    today_shifts = shift_res.scalars().all()

    # workload ratio calculation
    shift_minutes = sum(
        int((s.end_at - s.start_at).total_seconds() // 60)
        for s in today_shifts
        if s.start_at and s.end_at
    )
    res_minutes = sum(
        int((r.end_at - r.start_at).total_seconds() // 60)
        for r in today_res
        if r.start_at and r.end_at
    )
    workload_ratio = 0.0
    if shift_minutes > 0:
        workload_ratio = min(1.0, max(0.0, res_minutes / shift_minutes))

    return {
        "shop_id": str(shop_id),
        "today_reservations": today_reservations,
        "week_reservations": week_reservations,
        "today_shifts": len(today_shifts),
        "today_workload_ratio": workload_ratio,
        "recent_reservations": [
            {
                "id": str(r.id),
                "therapist_id": str(r.therapist_id) if r.therapist_id else None,
                "therapist_name": names.get(r.therapist_id) if r.therapist_id else None,
                "start_at": r.start_at.isoformat() if r.start_at else None,
                "end_at": r.end_at.isoformat() if r.end_at else None,
                "status": r.status,
            }
            for r in recent
        ],
    }


@router.get("/api/admin/shops/{shop_id}/dashboard")
async def shop_dashboard(
    shop_id: UUID,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    try:
        now = datetime.now(timezone.utc)
        data = await _compute_dashboard(db, shop_id, now)
        return data
    except Exception as e:  # pragma: no cover - fail-soft for dashboard
        logger.exception("failed to compute shop dashboard: %s", e)
        raise HTTPException(status_code=500, detail="dashboard_error") from e
