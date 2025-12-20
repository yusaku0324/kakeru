from __future__ import annotations

import logging
from datetime import datetime, timedelta, date, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
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

    # reservations
    res_stmt = select(GuestReservation).where(GuestReservation.shop_id == shop_id)
    res_res = await db.execute(res_stmt)
    reservations = res_res.scalars().all()

    def _is_confirmed(r: GuestReservation) -> bool:
        return (r.status or "").lower() == "confirmed"

    today_res = [
        r
        for r in reservations
        if _is_confirmed(r) and r.start_at and today_start <= r.start_at < today_end
    ]
    week_res = [
        r
        for r in reservations
        if _is_confirmed(r) and r.start_at and week_start <= r.start_at < week_end
    ]

    recent = sorted(
        reservations,
        key=lambda r: r.start_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )[:5]

    # therapist lookup for names
    therapist_ids = {r.therapist_id for r in recent if r.therapist_id}
    names: dict[UUID, str] = {}
    if therapist_ids:
        th_stmt = select(Therapist).where(Therapist.id.in_(therapist_ids))
        th_res = await db.execute(th_stmt)
        for th in th_res.scalars().all():
            names[th.id] = th.name

    # shifts
    shift_stmt = select(TherapistShift).where(
        TherapistShift.shop_id == shop_id,
        TherapistShift.availability_status == "available",
    )
    shift_res = await db.execute(shift_stmt)
    shifts = shift_res.scalars().all()
    today_shifts = [s for s in shifts if s.date == today_start.date()]

    # workload ratio
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
        "today_reservations": len(today_res),
        "week_reservations": len(week_res),
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
