"""API router for therapist availability endpoints."""

import logging
from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....db import get_session
from ....utils.cache import availability_cache
from ....utils.datetime import JST
from .helpers import determine_slot_status
from .schemas import (
    AvailabilitySlot,
    AvailabilitySlotsResponse,
    AvailabilitySummaryResponse,
    SlotVerificationResponse,
)

# Import parent package for testability (allows monkeypatching via domain.*)
from .. import therapist_availability as _pkg

logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/api/guest/therapists",
    tags=["guest-therapist-availability"],
)


@router.get(
    "/{therapist_id}/availability_summary",
    response_model=AvailabilitySummaryResponse,
    status_code=status.HTTP_200_OK,
)
async def get_availability_summary_api(
    therapist_id: UUID,
    date_from: date = Query(..., description="inclusive YYYY-MM-DD"),
    date_to: date = Query(..., description="inclusive YYYY-MM-DD"),
    db: AsyncSession = Depends(get_session),
):
    if date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_date_range"
        )
    summary = await _pkg._list_availability_summary(
        db, therapist_id, date_from, date_to
    )
    return summary


@router.get(
    "/{therapist_id}/availability_slots",
    response_model=AvailabilitySlotsResponse,
    status_code=status.HTTP_200_OK,
)
async def get_availability_slots_api(
    therapist_id: str,
    date: date = Query(..., description="target YYYY-MM-DD"),
    db: AsyncSession = Depends(get_session),
):
    resolved_id = await _pkg._resolve_therapist_id(db, therapist_id)
    if not resolved_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="therapist_not_found",
        )

    # Check cache first (TTL: 60 seconds)
    cache_key = f"availability_slots:{resolved_id}:{date.isoformat()}"
    hit, cached_slots = await availability_cache.get(cache_key)

    if hit:
        logger.debug("Cache hit for %s", cache_key)
        slots = cached_slots
    else:
        logger.debug("Cache miss for %s", cache_key)
        slots = await _pkg._list_daily_slots(db, resolved_id, date)
        await availability_cache.set(cache_key, slots)

    now = datetime.now(JST)

    # Filter and adjust slots based on current time
    filtered_slots = []
    for start, end in slots:
        # Ensure timezone-aware comparison
        start_aware = start if start.tzinfo else start.replace(tzinfo=JST)
        end_aware = end if end.tzinfo else end.replace(tzinfo=JST)

        # Skip completely past slots
        if end_aware <= now:
            continue

        # Adjust start time for partially past slots
        effective_start = max(start_aware, now)

        filtered_slots.append(
            AvailabilitySlot(
                start_at=effective_start,
                end_at=end_aware,
                status=determine_slot_status(effective_start, end_aware, now),
            )
        )

    return AvailabilitySlotsResponse(
        therapist_id=resolved_id,
        date=date,
        slots=filtered_slots,
    )


@router.get(
    "/{therapist_id}/verify_slot",
    response_model=SlotVerificationResponse,
    status_code=status.HTTP_200_OK,
    responses={
        409: {
            "description": "Slot is no longer available",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "slot_unavailable",
                        "status": "blocked",
                        "conflicted_at": "2025-01-01T12:00:00+09:00",
                    }
                }
            },
        }
    },
)
async def verify_slot_api(
    therapist_id: str,
    start_at: datetime = Query(..., description="Slot start time (ISO format)"),
    db: AsyncSession = Depends(get_session),
):
    """
    予約前にスロットの最新状態を検証する。

    - 200: スロットが予約可能
    - 409: スロットが予約不可（他の予約が入った等）
    """
    resolved_id = await _pkg._resolve_therapist_id(db, therapist_id)
    if not resolved_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="therapist_not_found",
        )

    now = datetime.now(JST)

    # start_at から日付を取得してスロット一覧を取得
    target_date = (
        start_at.date() if start_at.tzinfo else start_at.replace(tzinfo=JST).date()
    )
    slots = await _pkg._list_daily_slots(db, resolved_id, target_date)

    # 指定された start_at に一致するスロットを検索
    matching_slot = None
    start_at_aware = start_at if start_at.tzinfo else start_at.replace(tzinfo=JST)

    for slot_start, slot_end in slots:
        slot_start_aware = (
            slot_start if slot_start.tzinfo else slot_start.replace(tzinfo=JST)
        )
        # タイムスタンプが一致するか確認（秒単位で比較）
        if abs((slot_start_aware - start_at_aware).total_seconds()) < 60:
            matching_slot = (slot_start, slot_end)
            break

    if not matching_slot:
        # スロットが存在しない（予約済み or シフト外）
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "detail": "slot_unavailable",
                "status": "blocked",
                "conflicted_at": now.isoformat(),
            },
        )

    slot_start, slot_end = matching_slot
    slot_status = determine_slot_status(slot_start, slot_end, now)

    if slot_status == "blocked":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "detail": "slot_unavailable",
                "status": slot_status,
                "conflicted_at": now.isoformat(),
            },
        )

    return SlotVerificationResponse(
        therapist_id=resolved_id,
        start_at=slot_start,
        end_at=slot_end,
        status=slot_status,
        verified_at=now,
        is_available=slot_status in ("open", "tentative"),
    )
