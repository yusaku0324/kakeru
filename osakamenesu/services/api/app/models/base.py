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
GuestReservationStatus = Enum(
    *GUEST_RESERVATION_STATUS_VALUES, name="guest_reservation_status"
)
TherapistShiftStatus = Enum(
    *THERAPIST_SHIFT_STATUS_VALUES, name="therapist_shift_status"
)


def now_utc() -> datetime:
    """Return current UTC datetime."""
    return datetime.now(UTC)
