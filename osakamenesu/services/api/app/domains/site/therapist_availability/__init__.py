"""Therapist availability API package.

Provides availability checking, slot listing, and reservation conflict detection.
"""

from .router import router
from .constants import (
    ACTIVE_RESERVATION_STATUSES,
    DEFAULT_HOLD_TTL_MINUTES,
)
from .schemas import (
    AvailabilitySummaryItem,
    AvailabilitySummaryResponse,
    AvailabilitySlotStatus,
    AvailabilitySlot,
    AvailabilitySlotsResponse,
    SlotVerificationResponse,
)
from .helpers import (
    determine_slot_status,
    _ensure_aware,
    _parse_breaks,
    _subtract_intervals,
    _normalize_intervals,
    _day_window,
    _filter_slots_by_date,
    _overlaps,
    _is_active_reservation,
    _filter_active_reservations,
    _reservation_status_value,
)
from .service import (
    has_overlapping_reservation,
    is_available,
    list_daily_slots,
    list_availability_summary,
    resolve_therapist_id,
    _fetch_therapist_with_buffer,
    _fetch_shifts,
    _fetch_reservations,
    _calculate_available_slots,
)

# Backward compatibility aliases (with underscore prefix for testability)
_has_overlapping_reservation = has_overlapping_reservation
_is_available = is_available
_list_daily_slots = list_daily_slots
_list_availability_summary = list_availability_summary
_resolve_therapist_id = resolve_therapist_id
_determine_slot_status = determine_slot_status

__all__ = [
    "router",
    # Constants
    "ACTIVE_RESERVATION_STATUSES",
    "DEFAULT_HOLD_TTL_MINUTES",
    # Schemas
    "AvailabilitySummaryItem",
    "AvailabilitySummaryResponse",
    "AvailabilitySlotStatus",
    "AvailabilitySlot",
    "AvailabilitySlotsResponse",
    "SlotVerificationResponse",
    # Helpers
    "determine_slot_status",
    "_ensure_aware",
    "_parse_breaks",
    "_subtract_intervals",
    "_normalize_intervals",
    "_day_window",
    "_filter_slots_by_date",
    "_overlaps",
    "_is_active_reservation",
    "_filter_active_reservations",
    "_reservation_status_value",
    # Service
    "has_overlapping_reservation",
    "is_available",
    "list_daily_slots",
    "list_availability_summary",
    "resolve_therapist_id",
    "_fetch_therapist_with_buffer",
    "_fetch_shifts",
    "_fetch_reservations",
    "_calculate_available_slots",
    # Backward compatibility aliases
    "_has_overlapping_reservation",
    "_is_available",
    "_list_daily_slots",
    "_list_availability_summary",
    "_resolve_therapist_id",
    "_determine_slot_status",
]
