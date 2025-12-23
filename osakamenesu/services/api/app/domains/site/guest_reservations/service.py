"""Business logic for guest reservations."""

import logging
import sys
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from ....models import GuestReservation, Profile, Therapist, now_utc
from ....services.business_hours import (
    load_business_hours_from_profile,
    is_within_business_hours,
)
from ....utils.cache import availability_cache
from ....utils.datetime import ensure_jst_datetime
from ..therapist_availability import is_available as _is_available_impl

from .utils import (
    coerce_uuid,
    try_fetch_profile as _try_fetch_profile_impl,
    compute_booking_times,
    count_overlapping_active_shop_reservations,
    attach_reason,
)
from .validation import validate_request, check_deadline


def _get_parent_module():
    """Get parent module for monkeypatching support."""
    return sys.modules.get("app.domains.site.guest_reservations")


async def is_available(db, therapist_id, start_at, end_at, lock=False):
    """Wrapper for is_available that supports monkeypatching."""
    parent = _get_parent_module()
    if parent and hasattr(parent, "is_available"):
        return await parent.is_available(db, therapist_id, start_at, end_at, lock=lock)
    return await _is_available_impl(db, therapist_id, start_at, end_at, lock=lock)


async def try_fetch_profile(db, shop_id):
    """Wrapper for try_fetch_profile that supports monkeypatching."""
    parent = _get_parent_module()
    if parent and hasattr(parent, "_try_fetch_profile"):
        return await parent._try_fetch_profile(db, shop_id)
    return await _try_fetch_profile_impl(db, shop_id)


logger = logging.getLogger(__name__)
HOLD_TTL_MINUTES = 15


async def assign_for_free(
    db: AsyncSession,
    shop_id: Any,
    start_at: datetime,
    end_at: datetime,
    base_staff_id: Any | None = None,
) -> tuple[Optional[Any], dict[str, Any]]:
    """
    Assign a therapist for omakase/free reservations.

    v1 policy:
    - Get published & booking-enabled therapists in the shop
    - Filter by is_available=True
    - Score by base_staff_id match, return highest scorer
    """
    debug: dict[str, Any] = {"rejected_reasons": []}
    candidates: list[dict[str, Any]] = []

    try:
        if not db or not hasattr(db, "execute"):
            debug["rejected_reasons"].append("internal_error")
            return None, debug

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

    available_candidates: list[tuple[Any, float, int]] = []

    for cand in candidates:
        therapist_id = cand.get("therapist_id")
        try:
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
    Create a guest reservation (fail-soft).

    Returns (reservation, debug_info).
    """
    now = now or now_utc()
    rejected: list[str] = []
    extra_debug: dict[str, Any] = {}

    normalized, reasons = validate_request(payload)
    rejected.extend(reasons)

    start_at = normalized.get("start_at")
    shop_id = normalized.get("shop_id")
    therapist_id = normalized.get("therapist_id")
    course_id = normalized.get("course_id")

    if not start_at:
        return None, {"rejected_reasons": rejected}

    start_at = ensure_jst_datetime(start_at)

    profile: Profile | None = None
    if shop_id:
        profile = await try_fetch_profile(db, shop_id)

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

    cfg = load_business_hours_from_profile(profile)
    if cfg is not None:
        if not is_within_business_hours(cfg, start_at, occupied_end_at):
            rejected.append("outside_business_hours")

    shop_uuid = coerce_uuid(shop_id)
    if shop_uuid:
        room_count = 1
        if profile is not None:
            try:
                room_count = int(getattr(profile, "room_count", 1) or 1)
            except Exception:
                room_count = 1
        room_count = max(1, room_count)
        try:
            active_count = await count_overlapping_active_shop_reservations(
                db,
                shop_id=shop_uuid,
                start_at=start_at,
                end_at=occupied_end_at,
                now=now,
                lock=True,
            )
        except Exception:  # pragma: no cover - defensive fail-soft
            try:
                await db.rollback()
            except Exception:
                pass
            rejected.append("internal_error")
        else:
            if active_count >= room_count:
                rejected.append("room_full")
                extra_debug["room_capacity"] = {
                    "room_count": room_count,
                    "active_count": active_count,
                }

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

    if not therapist_id:
        parent = _get_parent_module()
        _assign_fn = (
            parent.assign_for_free
            if parent and hasattr(parent, "assign_for_free")
            else assign_for_free
        )
        assigned, assign_debug = await _assign_fn(
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
        return None, {"rejected_reasons": rejected, **extra_debug}

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

        # Invalidate availability cache for this therapist's date
        if therapist_id and start_at:
            cache_key = (
                f"availability_slots:{therapist_id}:{start_at.date().isoformat()}"
            )
            await availability_cache.invalidate(cache_key)
            logger.debug("Invalidated cache: %s", cache_key)

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
    """Check if reservation matches idempotency payload."""
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

    Returns (reservation, debug_info, error_code).
    """
    now = now or now_utc()
    rejected: list[str] = []
    extra_debug: dict[str, Any] = {}

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
        profile = await try_fetch_profile(db, shop_id)

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

    shop_uuid = coerce_uuid(shop_id)
    if shop_uuid:
        room_count = 1
        if profile is not None:
            try:
                room_count = int(getattr(profile, "room_count", 1) or 1)
            except Exception:
                room_count = 1
        room_count = max(1, room_count)
        try:
            active_count = await count_overlapping_active_shop_reservations(
                db,
                shop_id=shop_uuid,
                start_at=start_at,
                end_at=occupied_end_at,
                now=now,
                lock=True,
            )
        except Exception:  # pragma: no cover - defensive fail-soft
            try:
                await db.rollback()
            except Exception:
                pass
            rejected.append("internal_error")
        else:
            if active_count >= room_count:
                rejected.append("room_full")
                extra_debug["room_capacity"] = {
                    "room_count": room_count,
                    "active_count": active_count,
                }

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
        return None, {"rejected_reasons": rejected, **extra_debug}, None

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

        # Invalidate availability cache for this therapist's date
        if therapist_id and start_at:
            cache_key = (
                f"availability_slots:{therapist_id}:{start_at.date().isoformat()}"
            )
            await availability_cache.invalidate(cache_key)
            logger.debug("Invalidated cache (hold): %s", cache_key)

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


async def cancel_guest_reservation(
    db: AsyncSession, reservation_id: UUID, reason: str | None = None
) -> GuestReservation | None:
    """Cancel a guest reservation."""
    res = await db.execute(
        select(GuestReservation).where(GuestReservation.id == reservation_id)
    )
    reservation = res.scalar_one_or_none()
    if not reservation:
        return None
    if str(reservation.status) == "cancelled":
        return reservation
    attach_reason(reservation, reason)
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
        attach_reason(reservation, reason)
        db.add(reservation)
        await db.commit()
        await db.refresh(reservation)
        return reservation, None

    if current_status in {"pending", "confirmed"} and next_status == "cancelled":
        reservation = await cancel_guest_reservation(db, reservation_id, reason=reason)
        return reservation, None

    return reservation, "invalid_transition"
