"""Guest reservations API package.

Provides guest-facing reservation booking and management endpoints.
"""

from datetime import timedelta

from ....db import get_session
from ....models import GuestReservationStatus as _GuestReservationStatus, now_utc

from .router import router
from .schemas import (
    GuestReservationPayload,
    GuestReservationHoldPayload,
    GuestReservationResponse,
    serialize_reservation,
)
from .service import (
    HOLD_TTL_MINUTES,
    assign_for_free,
    create_guest_reservation,
    create_guest_reservation_hold,
    cancel_guest_reservation,
    update_guest_reservation_status,
)
from .utils import (
    coerce_uuid,
    try_fetch_profile,
    try_fetch_profile as _try_fetch_profile,
    resolve_course_duration_minutes,
    normalize_extension_minutes,
    compute_booking_times,
    count_overlapping_active_shop_reservations,
    is_active_shop_reservation as _is_active_shop_reservation,
)
from .validation import validate_request, check_deadline
from ..therapist_availability import is_available

# Backward compatibility
GuestReservationStatus = _GuestReservationStatus

__all__ = [
    "router",
    "get_session",
    "GuestReservationStatus",
    "now_utc",
    "timedelta",
    "GuestReservationPayload",
    "GuestReservationHoldPayload",
    "GuestReservationResponse",
    "serialize_reservation",
    "HOLD_TTL_MINUTES",
    "assign_for_free",
    "create_guest_reservation",
    "create_guest_reservation_hold",
    "cancel_guest_reservation",
    "update_guest_reservation_status",
    "coerce_uuid",
    "try_fetch_profile",
    "_try_fetch_profile",
    "resolve_course_duration_minutes",
    "normalize_extension_minutes",
    "compute_booking_times",
    "count_overlapping_active_shop_reservations",
    "_is_active_shop_reservation",
    "validate_request",
    "check_deadline",
    "is_available",
]
