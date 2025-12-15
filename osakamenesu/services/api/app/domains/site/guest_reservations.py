from __future__ import annotations

import logging
import os
from uuid import UUID, uuid4
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, model_validator
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

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
from .therapist_availability import is_available
from ...rate_limiters import rate_limit_reservation
from ...services.business_hours import (
    load_booking_rules_from_profile,
    load_business_hours_from_profile,
    is_within_business_hours,
)
from ...utils.datetime import ensure_jst_datetime
from .utils import normalize_shop_menus

# 本番環境ではdebug情報を隠す
_IS_PRODUCTION = (
    os.getenv("FLY_APP_NAME") is not None or os.getenv("VERCEL") is not None
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/guest/reservations", tags=["guest-reservations"])

GuestReservationStatus = _GuestReservationStatus  # backward-compat for existing imports
HOLD_TTL_MINUTES = 15


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


def _coerce_uuid(value: Any) -> UUID | None:
    if isinstance(value, UUID):
        return value
    if isinstance(value, str):
        try:
            return UUID(value)
        except ValueError:
            return None
    return None


async def _try_fetch_profile(db: AsyncSession, shop_id: Any) -> Profile | None:
    shop_uuid = _coerce_uuid(shop_id)
    if not shop_uuid:
        return None
    try:
        res = await db.execute(select(Profile).where(Profile.id == shop_uuid))
    except Exception:  # pragma: no cover - fail-open
        # NOTE: If the session is in a "pending rollback" state (e.g. after a
        # transient DB error), we must rollback before continuing. Otherwise
        # later availability checks can fail with internal_error.
        try:
            await db.rollback()
        except Exception:
            pass
        return None
    if res is None:  # test stubs may return None
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
    if profile is None:
        return None
    course_uuid = _coerce_uuid(course_id)
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

    - service_end_at: start_at + (course/base duration + extension)
    - occupied_end_at: service_end_at + base_buffer_minutes (after buffer)
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
    end_at = _parse_datetime(end_raw) if end_raw is not None else None

    if not shop_id:
        reasons.append("shop_id_required")
    if not start_at:
        reasons.append("invalid_start_or_end")
    elif end_raw is not None and not end_at:
        reasons.append("invalid_start_or_end")
    elif end_at and start_at >= end_at:
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

    if duration is None and not normalized.get("course_id"):
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
        try:
            await db.rollback()
        except Exception:
            pass
        debug["rejected_reasons"].append("internal_error")
        return None, debug

    if not candidates:
        debug["rejected_reasons"].append("no_candidate")
        return None, debug

    available_candidates: list[tuple[Any, float]] = []

    for cand in candidates:
        therapist_id = cand.get("therapist_id")
        try:
            # lock=True でレースコンディションを防ぐ（フリー予約時も同様）
            ok, avail_debug = await is_available(
                db, therapist_id, start_at, end_at, lock=True
            )
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
    shop_id = normalized.get("shop_id")
    therapist_id = normalized.get("therapist_id")
    course_id = normalized.get("course_id")

    if not start_at:
        return None, {"rejected_reasons": rejected}

    # Normalize to JST for consistent server-side computations.
    start_at = ensure_jst_datetime(start_at)

    profile: Profile | None = None
    if shop_id:
        profile = await _try_fetch_profile(db, shop_id)

    # Compute server-side times (end_at is derived, client end_at is not authoritative).
    # base_duration_minutes may come from payload.duration_minutes or (end_at-start_at) fallback.
    (
        service_duration_minutes,
        planned_extension_minutes,
        buffer_minutes,
        _service_end_at,
        occupied_end_at,
        time_error,
    ) = compute_booking_times(
        profile=profile,
        start_at=start_at,
        course_id=course_id,
        base_duration_minutes=normalized.get("duration_minutes"),
        planned_extension_minutes=payload.get("planned_extension_minutes")
        if isinstance(payload, dict)
        else None,
    )
    if time_error:
        rejected.append(time_error)
        return None, {"rejected_reasons": rejected}

    rejected.extend(check_deadline(start_at, now, shop_settings=None))

    # Business hours check (optional). Missing/invalid config means "no restriction".
    cfg = load_business_hours_from_profile(profile)
    if cfg is not None:
        if not is_within_business_hours(cfg, start_at, occupied_end_at):
            rejected.append("outside_business_hours")

    # 指名予約の場合のみ is_available をチェック（フリーは v1 ではスキップ。将来は assign_for_free 内で可否判定を入れる TODO）
    # lock=True でレースコンディションを防ぐ（SELECT FOR UPDATE）
    if therapist_id:
        try:
            available, availability_debug = await is_available(
                db,
                therapist_id,
                start_at,
                occupied_end_at,
                lock=True,
            )
        except Exception:  # pragma: no cover - defensive fail-soft
            available = False
            availability_debug = {"rejected_reasons": ["internal_error"]}
        if not available:
            reasons = availability_debug.get("rejected_reasons") or []
            rejected.extend(reasons)

    # フリー/おまかせの場合は割当
    if not therapist_id:
        assigned, assign_debug = await assign_for_free(
            db,
            shop_id,
            start_at,
            occupied_end_at,
            normalized.get("base_staff_id"),
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
            start_at=ensure_jst_datetime(start_at) if start_at else start_at,
            end_at=occupied_end_at,
            duration_minutes=service_duration_minutes,
            planned_extension_minutes=planned_extension_minutes,
            buffer_minutes=buffer_minutes,
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


def _payload_matches_idempotency(
    reservation: GuestReservation,
    *,
    shop_id: UUID,
    therapist_id: UUID,
    start_at: datetime,
    duration_minutes: int,
    planned_extension_minutes: int,
) -> bool:
    return (
        str(reservation.shop_id) == str(shop_id)
        and str(reservation.therapist_id) == str(therapist_id)
        and reservation.start_at == start_at
        and int(reservation.duration_minutes or 0) == int(duration_minutes)
        and int(reservation.planned_extension_minutes or 0)
        == int(planned_extension_minutes)
    )


async def create_guest_reservation_hold(
    db: AsyncSession,
    payload: dict[str, Any],
    *,
    idempotency_key: str,
    now: datetime | None = None,
) -> tuple[Optional[GuestReservation], dict[str, Any], str | None]:
    """
    Create a TTL-based reservation hold (status=reserved).

    - Requires Idempotency-Key
    - reserved_until is computed server-side (now + HOLD_TTL_MINUTES)
    - reserved is treated as blocking only while reserved_until > now (lazy expiry)
    """
    now = now or now_utc()
    rejected: list[str] = []

    normalized, reasons = validate_request(payload)
    rejected.extend(reasons)

    start_at = normalized.get("start_at")
    shop_id = normalized.get("shop_id")
    therapist_id = normalized.get("therapist_id")
    course_id = normalized.get("course_id")

    if not start_at:
        return None, {"rejected_reasons": rejected}, None
    if not therapist_id:
        rejected.append("therapist_id_required")
        return None, {"rejected_reasons": rejected}, None

    start_at = ensure_jst_datetime(start_at)

    existing = None
    try:
        existing_res = await db.execute(
            select(GuestReservation).where(
                GuestReservation.idempotency_key == idempotency_key
            )
        )
        existing = existing_res.scalar_one_or_none()
    except Exception:  # pragma: no cover - defensive
        try:
            await db.rollback()
        except Exception:
            pass
        existing = None

    profile: Profile | None = None
    if shop_id:
        profile = await _try_fetch_profile(db, shop_id)

    (
        service_duration_minutes,
        planned_extension_minutes,
        buffer_minutes,
        _service_end_at,
        occupied_end_at,
        time_error,
    ) = compute_booking_times(
        profile=profile,
        start_at=start_at,
        course_id=course_id,
        base_duration_minutes=normalized.get("duration_minutes"),
        planned_extension_minutes=payload.get("planned_extension_minutes")
        if isinstance(payload, dict)
        else None,
    )
    if time_error:
        rejected.append(time_error)
        return None, {"rejected_reasons": rejected}, None

    if existing is not None:
        if not _payload_matches_idempotency(
            existing,
            shop_id=shop_id,
            therapist_id=therapist_id,
            start_at=start_at,
            duration_minutes=service_duration_minutes,
            planned_extension_minutes=planned_extension_minutes,
        ):
            return (
                None,
                {"rejected_reasons": ["idempotency_key_conflict"]},
                "idempotency_key_conflict",
            )
        return existing, {}, None

    rejected.extend(check_deadline(start_at, now, shop_settings=None))

    cfg = load_business_hours_from_profile(profile)
    if cfg is not None:
        if not is_within_business_hours(cfg, start_at, occupied_end_at):
            rejected.append("outside_business_hours")

    try:
        available, availability_debug = await is_available(
            db,
            therapist_id,
            start_at,
            occupied_end_at,
            lock=True,
        )
    except Exception:  # pragma: no cover - defensive fail-soft
        available = False
        availability_debug = {"rejected_reasons": ["internal_error"]}
    if not available:
        reasons = availability_debug.get("rejected_reasons") or []
        rejected.extend(reasons)

    if rejected:
        return None, {"rejected_reasons": rejected}, None

    reserved_until = now + timedelta(minutes=HOLD_TTL_MINUTES)
    try:
        reservation = GuestReservation(
            shop_id=shop_id,
            therapist_id=therapist_id,
            start_at=start_at,
            end_at=occupied_end_at,
            duration_minutes=service_duration_minutes,
            planned_extension_minutes=planned_extension_minutes,
            buffer_minutes=buffer_minutes,
            reserved_until=reserved_until,
            idempotency_key=idempotency_key,
            course_id=normalized.get("course_id"),
            price=normalized.get("price"),
            payment_method=normalized.get("payment_method"),
            contact_info=normalized.get("contact_info"),
            guest_token=normalized.get("guest_token"),
            user_id=normalized.get("user_id"),
            notes=normalized.get("notes"),
            status="reserved",
            base_staff_id=normalized.get("base_staff_id"),
        )
        if not getattr(reservation, "id", None):
            reservation.id = uuid4()
        db.add(reservation)
        await db.commit()
        await db.refresh(reservation)
        return reservation, {}, None
    except IntegrityError:
        try:
            await db.rollback()
        except Exception:
            pass
        return None, {"rejected_reasons": ["overlap_existing_reservation"]}, None
    except Exception:  # pragma: no cover - fail-soft
        logger.warning("guest_reservation_hold_failed", exc_info=True)
        try:
            await db.rollback()
        except Exception:
            pass
        return None, {"rejected_reasons": ["internal_error"]}, None


# ---- API 層 ----


class GuestReservationPayload(BaseModel):
    shop_id: UUID
    therapist_id: UUID | None = None
    start_at: datetime
    end_at: datetime | None = None
    duration_minutes: int | None = None
    planned_extension_minutes: int | None = 0
    course_id: UUID | None = None
    price: float | None = None
    payment_method: str | None = None
    contact_info: dict[str, Any] | None = None
    guest_token: str | None = None
    user_id: UUID | None = None
    notes: str | None = None
    base_staff_id: UUID | None = None

    @model_validator(mode="after")
    def _validate_timing_sources(self) -> "GuestReservationPayload":
        if (
            self.end_at is None
            and self.duration_minutes is None
            and self.course_id is None
        ):
            raise ValueError("one of end_at, duration_minutes, course_id is required")
        return self


class GuestReservationHoldPayload(BaseModel):
    shop_id: UUID
    therapist_id: UUID
    start_at: datetime
    end_at: datetime | None = None
    duration_minutes: int | None = None
    planned_extension_minutes: int | None = 0
    course_id: UUID | None = None
    price: float | None = None
    payment_method: str | None = None
    contact_info: dict[str, Any] | None = None
    guest_token: str | None = None
    user_id: UUID | None = None
    notes: str | None = None
    base_staff_id: UUID | None = None

    @model_validator(mode="after")
    def _validate_timing_sources(self) -> "GuestReservationHoldPayload":
        if (
            self.end_at is None
            and self.duration_minutes is None
            and self.course_id is None
        ):
            raise ValueError("one of end_at, duration_minutes, course_id is required")
        return self


class GuestReservationResponse(BaseModel):
    id: UUID
    status: str
    shop_id: UUID
    therapist_id: UUID | None
    start_at: datetime
    end_at: datetime
    duration_minutes: int | None = None
    reserved_until: datetime | None = None
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
        reserved_until=getattr(reservation, "reserved_until", None),
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
        end_at=payload.end_at
        or (payload.start_at + timedelta(minutes=payload.duration_minutes or 0)),
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
    "/hold",
    response_model=GuestReservationResponse,
    status_code=status.HTTP_200_OK,
)
async def hold_guest_reservation_api(
    payload: GuestReservationHoldPayload,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_session),
    user: Optional[User] = Depends(get_optional_site_user),
    _: None = Depends(rate_limit_reservation),
):
    data = payload.model_dump()
    if user:
        data["user_id"] = user.id
    else:
        data["user_id"] = None

    reservation, debug, error_code = await create_guest_reservation_hold(
        db,
        data,
        idempotency_key=idempotency_key,
        now=None,
    )
    if error_code == "idempotency_key_conflict":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="idempotency_key_conflict",
        )
    if reservation:
        return _serialize(reservation, debug=None)

    safe_debug: dict[str, Any] | None = None
    if not _IS_PRODUCTION:
        safe_debug = debug
    elif debug:
        safe_debug = {"rejected_reasons": debug.get("rejected_reasons", [])}

    return GuestReservationResponse(
        id=UUID(int=0),
        status="rejected",
        shop_id=payload.shop_id,
        therapist_id=payload.therapist_id,
        start_at=payload.start_at,
        end_at=payload.end_at
        or (payload.start_at + timedelta(minutes=payload.duration_minutes or 0)),
        duration_minutes=payload.duration_minutes,
        reserved_until=None,
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
