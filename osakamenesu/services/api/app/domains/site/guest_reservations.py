from __future__ import annotations

import logging
import os
from uuid import UUID, uuid4
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import (
    GuestReservation,
    GuestReservationStatus as _GuestReservationStatus,
    Profile,
    Therapist,
    User,
    now_utc,
)
from ...db import get_session
from ...deps import get_optional_site_user
from .therapist_availability import is_available, has_overlapping_reservation
from ...rate_limiters import rate_limit_reservation

# 本番環境ではdebug情報を隠す
_IS_PRODUCTION = (
    os.getenv("FLY_APP_NAME") is not None or os.getenv("VERCEL") is not None
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/guest/reservations", tags=["guest-reservations"])

GuestReservationStatus = _GuestReservationStatus  # backward-compat for existing imports


def _attach_reason(reservation: GuestReservation, reason: str | None) -> None:
    if not reason:
        return
    reservation.notes = (
        f"{reservation.notes}\n{reason}" if reservation.notes else reason
    )


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
    normalized["user_id"] = payload.get("user_id")
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

    共通ヘルパー has_overlapping_reservation を使用。
    """
    reasons: list[str] = []
    if not therapist_id:
        return reasons  # フリー/おまかせの場合はここでは判定しない

    if not db or not hasattr(db, "execute"):
        return reasons

    # 共通ヘルパーを使用して重複チェック
    try:
        therapist_uuid = (
            therapist_id if isinstance(therapist_id, UUID) else UUID(str(therapist_id))
        )
        has_overlap = await has_overlapping_reservation(
            db, therapist_uuid, start_at, end_at
        )
        if has_overlap:
            reasons.append("overlap_existing_reservation")
    except (ValueError, TypeError):
        # therapist_id が UUID に変換できない場合はスキップ
        pass

    # シフト整合は将来拡張。現時点では未検証。
    return reasons


async def assign_for_free(
    db: AsyncSession,
    shop_id: Any,
    start_at: datetime,
    end_at: datetime,
    base_staff_id: Any | None = None,
) -> tuple[Optional[Any], dict[str, Any]]:
    """
    フリー/おまかせ時の割当。

    v1 ポリシー:
    - shop 内の公開 & booking 有効なセラピストを候補にする。
    - is_available=True のみ残し、base_staff_id/matching_tags があれば簡易スコアで 0..1 にクリップ。
    - 最もスコアが高い 1 名を返す。候補ゼロなら None。
    - 例外時は fail-soft で internal_error とする。
    """

    debug: dict[str, Any] = {"rejected_reasons": []}
    candidates: list[dict[str, Any]] = []

    try:
        if not db or not hasattr(db, "execute"):
            debug["rejected_reasons"].append("internal_error")
            return None, debug

        # ショップの存在確認（セキュリティ強化）
        # db.get が使用できない場合（テスト用モックなど）はスキップ
        if hasattr(db, "get"):
            shop = await db.get(Profile, shop_id)
            if not shop:
                debug["rejected_reasons"].append("shop_not_found")
                return None, debug

        res = await db.execute(
            select(
                Therapist.id,
                Therapist.display_order,
                Therapist.created_at,
            ).where(
                Therapist.profile_id == shop_id,
                Therapist.status == "published",
                Therapist.is_booking_enabled.is_(True),
            )
        )
        candidates = [
            {
                "therapist_id": row[0],
                "display_order": row[1] or 0,
                "created_at": row[2],
            }
            for row in res.fetchall()
        ]
    except Exception:  # pragma: no cover - defensive
        logger.warning("assign_for_free_candidates_failed", exc_info=True)
        debug["rejected_reasons"].append("internal_error")
        return None, debug

    if not candidates:
        debug["rejected_reasons"].append("no_candidate")
        return None, debug

    available_candidates: list[tuple[Any, float]] = []

    for cand in candidates:
        therapist_id = cand.get("therapist_id")
        try:
            ok, avail_debug = await is_available(db, therapist_id, start_at, end_at)
        except Exception:  # pragma: no cover - defensive
            ok = False
            avail_debug = {"rejected_reasons": ["internal_error"]}

        if not ok:
            reasons = avail_debug.get("rejected_reasons") or []
            debug.setdefault("skipped", []).append(
                {"therapist_id": str(therapist_id), "reasons": reasons}
            )
            continue

        score = 0.5
        if base_staff_id and str(base_staff_id) == str(therapist_id):
            score = 0.9
        score = max(0.0, min(1.0, score))

        available_candidates.append((therapist_id, score, cand.get("display_order", 0)))

    if not available_candidates:
        debug["rejected_reasons"].append("no_available_therapist")
        return None, debug

    # score desc -> display_order asc -> therapist_id asc で安定ソート
    available_candidates.sort(key=lambda t: (-t[1], t[2], str(t[0])))
    chosen = available_candidates[0][0]
    debug["rejected_reasons"] = []
    return chosen, debug


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

    # 指名予約の場合のみ is_available をチェック（フリーは v1 ではスキップ。将来は assign_for_free 内で可否判定を入れる TODO）
    if therapist_id and start_at and end_at:
        try:
            available, availability_debug = await is_available(
                db, therapist_id, start_at, end_at
            )
        except Exception:  # pragma: no cover - defensive fail-soft
            available = False
            availability_debug = {"rejected_reasons": ["internal_error"]}
        if not available:
            reasons = availability_debug.get("rejected_reasons") or []
            rejected.extend(reasons)

    # フリー/おまかせの場合は割当
    if not therapist_id and start_at and end_at:
        assigned, assign_debug = await assign_for_free(
            db, shop_id, start_at, end_at, normalized.get("base_staff_id")
        )
        if assigned:
            therapist_id = assigned
            normalized["therapist_id"] = assigned
        else:
            reasons = assign_debug.get("rejected_reasons") or ["no_available_therapist"]
            rejected.extend(reasons)

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
            user_id=normalized.get("user_id"),
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
    user_id: UUID | None = None
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
    user_id: UUID | None = None
    notes: str | None = None
    base_staff_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    debug: dict[str, Any] | None = None


def _serialize(
    reservation: GuestReservation, debug: dict[str, Any] | None = None
) -> GuestReservationResponse:
    status_val = reservation.status
    if hasattr(status_val, "value"):
        status_val = status_val.value
    return GuestReservationResponse(
        id=reservation.id,
        status=status_val,
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
        user_id=reservation.user_id,
        notes=reservation.notes,
        base_staff_id=reservation.base_staff_id,
        created_at=reservation.created_at,
        updated_at=reservation.updated_at,
        debug=debug,
    )


async def cancel_guest_reservation(
    db: AsyncSession, reservation_id: UUID, reason: str | None = None
) -> GuestReservation | None:
    res = await db.execute(
        select(GuestReservation).where(GuestReservation.id == reservation_id)
    )
    reservation = res.scalar_one_or_none()
    if not reservation:
        return None
    if str(reservation.status) == "cancelled":
        return reservation
    _attach_reason(reservation, reason)
    reservation.status = "cancelled"
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)
    return reservation


async def update_guest_reservation_status(
    db: AsyncSession,
    reservation_id: UUID,
    next_status: str,
    *,
    reason: str | None = None,
) -> tuple[GuestReservation | None, str | None]:
    """
    Transition reservation status with admin-facing rules.

    Returns (reservation, error_code).
    error_code is one of: None, "invalid_status", "not_found", "invalid_transition".
    """
    allowed_statuses = {"pending", "confirmed", "cancelled"}
    if next_status not in allowed_statuses:
        return None, "invalid_status"

    res = await db.execute(
        select(GuestReservation).where(GuestReservation.id == reservation_id)
    )
    reservation = res.scalar_one_or_none()
    if not reservation:
        return None, "not_found"

    current_status = (
        reservation.status.value
        if hasattr(reservation.status, "value")
        else reservation.status
    )
    if current_status == next_status:
        return reservation, None

    if current_status == "pending" and next_status == "confirmed":
        reservation.status = "confirmed"
        _attach_reason(reservation, reason)
        db.add(reservation)
        await db.commit()
        await db.refresh(reservation)
        return reservation, None

    if current_status in {"pending", "confirmed"} and next_status == "cancelled":
        reservation = await cancel_guest_reservation(db, reservation_id, reason=reason)
        return reservation, None

    return reservation, "invalid_transition"


@router.post(
    "",
    response_model=GuestReservationResponse,
    status_code=status.HTTP_200_OK,
)
async def create_guest_reservation_api(
    payload: GuestReservationPayload,
    db: AsyncSession = Depends(get_session),
    user: Optional[User] = Depends(get_optional_site_user),
    _: None = Depends(rate_limit_reservation),
):
    data = payload.model_dump()
    # If user is authenticated, use their user_id (ignore any user_id from payload)
    if user:
        data["user_id"] = user.id
    else:
        # Anonymous user cannot specify user_id
        data["user_id"] = None
    reservation, debug = await create_guest_reservation(db, data, now=None)
    if reservation:
        return _serialize(reservation, debug=None)
    # fail-soft: 200で返却し、debugに理由を含める（本番環境では詳細を隠す）
    # 本番環境では rejected_reasons のみを返し、skipped などの詳細は隠す
    safe_debug: dict[str, Any] | None = None
    if not _IS_PRODUCTION:
        safe_debug = debug
    elif debug:
        # 本番環境では rejected_reasons のみを公開
        safe_debug = {"rejected_reasons": debug.get("rejected_reasons", [])}
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
        user_id=user.id if user else None,
        notes=payload.notes,
        base_staff_id=payload.base_staff_id,
        created_at=now_utc(),
        updated_at=now_utc(),
        debug=safe_debug,
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


@router.get(
    "",
    response_model=list[GuestReservationResponse],
    status_code=status.HTTP_200_OK,
)
async def list_guest_reservations_api(
    guest_token: Optional[str] = None,
    db: AsyncSession = Depends(get_session),
    user: Optional[User] = Depends(get_optional_site_user),
):
    # Build query based on authentication status
    # Security: guest_token is only used for anonymous users or to migrate
    # anonymous reservations to a logged-in user's account (same token ownership required)
    if user:
        # Authenticated user: get reservations by user_id only
        # guest_token is ignored for security - we don't want OR condition
        # that could expose other users' reservations
        res = await db.execute(
            select(GuestReservation)
            .where(GuestReservation.user_id == user.id)
            .order_by(desc(GuestReservation.start_at))
        )
    elif guest_token:
        # Anonymous user with guest_token
        res = await db.execute(
            select(GuestReservation)
            .where(GuestReservation.guest_token == guest_token)
            .order_by(desc(GuestReservation.start_at))
        )
    else:
        # No user and no guest_token - return empty list
        return []
    reservations = res.scalars().all()
    return [_serialize(r, debug=None) for r in reservations]
