from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import GuestReservation, TherapistShift

logger = logging.getLogger(__name__)


def _overlaps(
    a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime
) -> bool:
    """半開区間 [a_start, a_end) と [b_start, b_end) の重なり判定。"""
    return a_start < b_end and b_start < a_end


async def is_available(
    db: AsyncSession,
    therapist_id: UUID,
    start_at: datetime,
    end_at: datetime,
) -> tuple[bool, dict[str, Any]]:
    """シフトと既存予約を見て予約可否を判定する (fail-soft)。"""
    if not start_at or not end_at or start_at >= end_at:
        return False, {"rejected_reasons": ["invalid_time_range"]}

    try:
        # 1) シフト存在（availability_status=available で内包しているか）
        shift_stmt = select(TherapistShift).where(
            TherapistShift.therapist_id == therapist_id,
            TherapistShift.availability_status == "available",
            TherapistShift.start_at <= start_at,
            TherapistShift.end_at >= end_at,
        )
        shift_res = await db.execute(shift_stmt)
        shift = shift_res.scalar_one_or_none()
        if not shift:
            return False, {"rejected_reasons": ["no_shift"]}

        # 2) 休憩との重なり
        for br in shift.break_slots or []:
            br_start = br.get("start_at")
            br_end = br.get("end_at")
            if not br_start or not br_end:
                continue
            try:
                br_start_dt = (
                    br_start
                    if isinstance(br_start, datetime)
                    else datetime.fromisoformat(br_start)
                )
                br_end_dt = (
                    br_end
                    if isinstance(br_end, datetime)
                    else datetime.fromisoformat(br_end)
                )
            except Exception:
                continue
            if _overlaps(start_at, end_at, br_start_dt, br_end_dt):
                return False, {"rejected_reasons": ["on_break"]}

        # 3) 既存予約との重なり (pending/confirmed)
        res_stmt = select(GuestReservation).where(
            GuestReservation.therapist_id == therapist_id,
            GuestReservation.status.in_(("pending", "confirmed")),
            and_(
                GuestReservation.start_at < end_at, GuestReservation.end_at > start_at
            ),
        )
        res_res = await db.execute(res_stmt)
        if res_res.scalar_one_or_none():
            return False, {"rejected_reasons": ["overlap_existing_reservation"]}

        return True, {"rejected_reasons": []}
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("is_available_failed: %s", exc)
        return False, {"rejected_reasons": ["internal_error"]}
