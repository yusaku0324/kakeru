from __future__ import annotations

import logging
from uuid import UUID, uuid4
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import (
    GuestReservation,
    GuestReservationStatus,
    Therapist,
    now_utc,
)
from ...db import get_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/guest/reservations", tags=["guest-reservations"])

# ステータスが重複判定の対象となるもの（pending/confirmed を重複禁止とみなす）
ACTIVE_STATUSES = ("pending", "confirmed")


def _parse_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


def validate_request(payload: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """
    入力の最低限の正規化と検証を行い、問題点を rejected_reasons に集約する。
    例外は投げず、呼び出し側で fail-soft に扱えるようにする。
    """
    reasons: list[str] = []
    normalized: dict[str, Any] = {}

    shop_id = payload.get("shop_id")
    start_raw = payload.get("start_at")
    end_raw = payload.get("end_at")
    start_at = _parse_datetime(start_raw)
    end_at = _parse_datetime(end_raw)

    if not shop_id:
        reasons.append("shop_id_required")
    if not start_at or not end_at:
        reasons.append("invalid_start_or_end")
    elif start_at >= end_at:
        reasons.append("end_before_start")

    normalized["shop_id"] = shop_id
    normalized["therapist_id"] = payload.get("therapist_id")
    normalized["start_at"] = start_at
    normalized["end_at"] = end_at
    normalized["course_id"] = payload.get("course_id")
    normalized["price"] = payload.get("price")
    normalized["payment_method"] = payload.get("payment_method")
    normalized["contact_info"] = payload.get("contact_info")
    normalized["guest_token"] = payload.get("guest_token")
    normalized["notes"] = payload.get("notes")
    normalized["base_staff_id"] = payload.get("base_staff_id")

    duration = payload.get("duration_minutes")
    if duration is None and start_at and end_at:
        duration = int((end_at - start_at).total_seconds() // 60)
    normalized["duration_minutes"] = duration

    if not duration:
        reasons.append("duration_missing")

    return normalized, reasons


def check_deadline(
    start_at: datetime,
    now: datetime,
    shop_settings: Optional[dict[str, Any]] = None,
) -> list[str]:
    """
    受付締切を判定する。締切超過なら理由を返す。例外は投げない。
    """
    if not start_at:
        return ["invalid_start_time"]
    cutoff_minutes = 60
    if shop_settings and isinstance(shop_settings.get("deadline_minutes"), int):
        cutoff_minutes = max(0, shop_settings["deadline_minutes"])
    delta = (start_at - now).total_seconds() / 60
    if delta < cutoff_minutes:
        return ["deadline_over"]
    return []


async def check_shift_and_overlap(
    db: AsyncSession,
    shop_id: Any,
    therapist_id: Any,
    start_at: datetime,
    end_at: datetime,
) -> list[str]:
    """
    シフト/営業時間の厳密判定は未実装。まずは重複予約のみチェック。
    """
    reasons: list[str] = []
    if not therapist_id:
        return reasons  # フリー/おまかせの場合はここでは判定しない

    if not db or not hasattr(db, "execute"):
        return reasons

    stmt = select(GuestReservation).where(
        GuestReservation.therapist_id == therapist_id,
        GuestReservation.status.in_(ACTIVE_STATUSES),
        and_(GuestReservation.start_at < end_at, GuestReservation.end_at > start_at),
    )
    res = await db.execute(stmt)
    if res.scalar():
        reasons.append("overlap_existing_reservation")

    # シフト整合は将来拡張。現時点では未検証。
    return reasons


async def assign_for_free(
    db: AsyncSession,
    shop_id: Any,
    start_at: datetime,
    end_at: datetime,
    base_staff_id: Any | None = None,
) -> Optional[Any]:
    """
    フリー/おまかせ時の割当。v1 は単純に shop の published + is_booking_enabled なセラピストを返す。
    条件に合う人がいなければ None を返す。
    """
    if not db or not hasattr(db, "execute"):
        return None
    stmt = (
        select(Therapist.id)
        .where(
            Therapist.profile_id == shop_id,
            Therapist.status == "published",
            Therapist.is_booking_enabled.is_(True),
        )
        .order_by(Therapist.display_order, Therapist.created_at)
    )
    res = await db.execute(stmt)
    row = res.first()
    return row[0] if row else None


async def create_guest_reservation(
    db: AsyncSession,
    payload: dict[str, Any],
    now: datetime | None = None,
) -> tuple[Optional[GuestReservation], dict[str, Any]]:
    """
    fail-soft 方針で予約を作成。rejected_reasons があれば予約を作らず返す。
    """
    now = now or now_utc()
    rejected: list[str] = []

    normalized, reasons = validate_request(payload)
    rejected.extend(reasons)

    start_at = normalized.get("start_at")
    end_at = normalized.get("end_at")
    shop_id = normalized.get("shop_id")
    therapist_id = normalized.get("therapist_id")

    if start_at and end_at:
        rejected.extend(check_deadline(start_at, now, shop_settings=None))

    rejected.extend(
        await check_shift_and_overlap(db, shop_id, therapist_id, start_at, end_at)
        if start_at and end_at
        else []
    )

    # フリー/おまかせの場合は割当
    if not therapist_id and start_at and end_at:
        assigned = await assign_for_free(
            db, shop_id, start_at, end_at, normalized.get("base_staff_id")
        )
        if assigned:
            therapist_id = assigned
            normalized["therapist_id"] = assigned
        else:
            rejected.append("no_available_therapist")

    if rejected:
        return None, {"rejected_reasons": rejected}

    try:
        reservation = GuestReservation(
            shop_id=shop_id,
            therapist_id=therapist_id,
            start_at=start_at,
            end_at=end_at,
            duration_minutes=normalized.get("duration_minutes"),
            course_id=normalized.get("course_id"),
            price=normalized.get("price"),
            payment_method=normalized.get("payment_method"),
            contact_info=normalized.get("contact_info"),
            guest_token=normalized.get("guest_token"),
            notes=normalized.get("notes"),
            status="confirmed",
            base_staff_id=normalized.get("base_staff_id"),
        )
        if not getattr(reservation, "id", None):
            reservation.id = uuid4()
        db.add(reservation)
        await db.commit()
        await db.refresh(reservation)
        return reservation, {}
    except Exception as exc:  # pragma: no cover - fail-soft
        logger.warning("guest_reservation_create_failed: %s", exc)
        try:
            await db.rollback()
        except Exception:
            pass
    return None, {"rejected_reasons": ["internal_error"]}


# ---- API 層 ----


class GuestReservationPayload(BaseModel):
    shop_id: UUID
    therapist_id: UUID | None = None
    start_at: datetime
    end_at: datetime
    duration_minutes: int | None = None
    course_id: UUID | None = None
    price: float | None = None
    payment_method: str | None = None
    contact_info: dict[str, Any] | None = None
    guest_token: str | None = None
    notes: str | None = None
    base_staff_id: UUID | None = None


class GuestReservationResponse(BaseModel):
    id: UUID
    status: str
    shop_id: UUID
    therapist_id: UUID | None
    start_at: datetime
    end_at: datetime
    duration_minutes: int | None = None
    course_id: UUID | None = None
    price: float | None = None
    payment_method: str | None = None
    contact_info: dict[str, Any] | None = None
    guest_token: str | None = None
    notes: str | None = None
    base_staff_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    debug: dict[str, Any] | None = None


def _serialize(
    reservation: GuestReservation, debug: dict[str, Any] | None = None
) -> GuestReservationResponse:
    return GuestReservationResponse(
        id=reservation.id,
        status=reservation.status.value
        if isinstance(reservation.status, GuestReservationStatus)
        else reservation.status,
        shop_id=reservation.shop_id,
        therapist_id=reservation.therapist_id,
        start_at=reservation.start_at,
        end_at=reservation.end_at,
        duration_minutes=reservation.duration_minutes,
        course_id=reservation.course_id,
        price=reservation.price,
        payment_method=reservation.payment_method,
        contact_info=reservation.contact_info,
        guest_token=reservation.guest_token,
        notes=reservation.notes,
        base_staff_id=reservation.base_staff_id,
        created_at=reservation.created_at,
        updated_at=reservation.updated_at,
        debug=debug,
    )


async def cancel_guest_reservation(
    db: AsyncSession, reservation_id: UUID
) -> GuestReservation | None:
    res = await db.execute(
        select(GuestReservation).where(GuestReservation.id == reservation_id)
    )
    reservation = res.scalar_one_or_none()
    if not reservation:
        return None
    if reservation.status == GuestReservationStatus.cancelled:
        return reservation
    reservation.status = GuestReservationStatus.cancelled
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)
    return reservation


@router.post(
    "",
    response_model=GuestReservationResponse,
    status_code=status.HTTP_200_OK,
)
async def create_guest_reservation_api(
    payload: GuestReservationPayload,
    db: AsyncSession = Depends(get_session),
):
    reservation, debug = await create_guest_reservation(
        db, payload.model_dump(), now=None
    )
    if reservation:
        return _serialize(reservation, debug=None)
    # fail-soft: 200で返却し、debugに理由を含める
    return GuestReservationResponse(
        id=UUID(int=0),
        status="rejected",
        shop_id=payload.shop_id,
        therapist_id=payload.therapist_id,
        start_at=payload.start_at,
        end_at=payload.end_at,
        duration_minutes=payload.duration_minutes,
        course_id=payload.course_id,
        price=payload.price,
        payment_method=payload.payment_method,
        contact_info=payload.contact_info,
        guest_token=payload.guest_token,
        notes=payload.notes,
        base_staff_id=payload.base_staff_id,
        created_at=now_utc(),
        updated_at=now_utc(),
        debug=debug,
    )


@router.post(
    "/{reservation_id}/cancel",
    response_model=GuestReservationResponse,
    status_code=status.HTTP_200_OK,
)
async def cancel_guest_reservation_api(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_session),
):
    reservation = await cancel_guest_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="reservation_not_found"
        )
    return _serialize(reservation, debug=None)


@router.get(
    "/{reservation_id}",
    response_model=GuestReservationResponse,
    status_code=status.HTTP_200_OK,
)
async def get_guest_reservation_api(
    reservation_id: UUID,
    db: AsyncSession = Depends(get_session),
):
    res = await db.execute(
        select(GuestReservation).where(GuestReservation.id == reservation_id)
    )
    reservation = res.scalar_one_or_none()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="reservation_not_found"
        )
    return _serialize(reservation, debug=None)
