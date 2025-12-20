"""Base model definitions and shared utilities."""

from __future__ import annotations

from sqlalchemy.orm import declarative_base
from sqlalchemy import Enum
from datetime import datetime, UTC

from ..enums import (
    STATUS_PROFILE_VALUES,
    STATUS_DIARY_VALUES,
    OUTLINK_KIND_VALUES,
    REPORT_TARGET_VALUES,
    REPORT_STATUS_VALUES,
    REVIEW_STATUS_VALUES,
    THERAPIST_STATUS_VALUES,
    SERVICE_TYPE_VALUES,
    RESERVATION_STATUS_VALUES,
    RESERVATION_SLOT_STATUS_VALUES,
    GUEST_RESERVATION_STATUS_VALUES,
    THERAPIST_SHIFT_STATUS_VALUES,
)


Base = declarative_base()


# Enum definitions using centralized values from enums.py
StatusProfile = Enum(*STATUS_PROFILE_VALUES, name="status_profile")
StatusDiary = Enum(*STATUS_DIARY_VALUES, name="status_diary")
OutlinkKind = Enum(*OUTLINK_KIND_VALUES, name="outlink_kind")
ReportTarget = Enum(*REPORT_TARGET_VALUES, name="report_target")
ReportStatus = Enum(*REPORT_STATUS_VALUES, name="report_status")
ReviewStatus = Enum(*REVIEW_STATUS_VALUES, name="review_status")
TherapistStatus = Enum(*THERAPIST_STATUS_VALUES, name="therapist_status")
ServiceType = Enum(*SERVICE_TYPE_VALUES, name="service_type")
ReservationStatus = Enum(*RESERVATION_STATUS_VALUES, name="reservation_status")
ReservationSlotStatus = Enum(
    *RESERVATION_SLOT_STATUS_VALUES, name="reservation_slot_status"
)
GuestReservationStatus = Enum(
    *GUEST_RESERVATION_STATUS_VALUES, name="guest_reservation_status"
)
TherapistShiftStatus = Enum(
    *THERAPIST_SHIFT_STATUS_VALUES, name="therapist_shift_status"
)

# Notification constants
RESERVATION_NOTIFICATION_CHANNEL_KEYS = ("email", "slack", "line", "log")
RESERVATION_NOTIFICATION_STATUS_KEYS = (
    "pending",
    "in_progress",
    "succeeded",
    "failed",
    "cancelled",
)
RESERVATION_NOTIFICATION_ATTEMPT_STATUS_KEYS = ("success", "failure")


def now_utc() -> datetime:
    """Return current UTC datetime."""
    return datetime.now(UTC)
