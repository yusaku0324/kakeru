"""
Centralized enum definitions for the API.

This module provides a single source of truth for all enum values used
in both SQLAlchemy models and Pydantic schemas.

Usage in models.py:
    from .enums import THERAPIST_STATUS_VALUES
    TherapistStatus = Enum(*THERAPIST_STATUS_VALUES, name="therapist_status")

Usage in schemas.py:
    from .enums import TherapistStatusLiteral
    status: TherapistStatusLiteral = "draft"

IMPORTANT: When adding or modifying enum values:
1. Update the VALUES tuple in this file
2. Create an Alembic migration to update the database enum
3. Run tests to ensure consistency

Note: This file is the single source of truth for all enum values.
Do not define enum values elsewhere in the codebase.
"""

from typing import Literal, Tuple


# ============================================================================
# Profile Status
# ============================================================================
STATUS_PROFILE_VALUES: Tuple[str, ...] = ("draft", "published", "hidden")
StatusProfileLiteral = Literal["draft", "published", "hidden"]


# ============================================================================
# Diary Status
# ============================================================================
STATUS_DIARY_VALUES: Tuple[str, ...] = ("mod", "published", "hidden")
DiaryStatusLiteral = Literal["mod", "published", "hidden"]


# ============================================================================
# Outlink Kind
# ============================================================================
OUTLINK_KIND_VALUES: Tuple[str, ...] = ("line", "tel", "web")
OutlinkKindLiteral = Literal["line", "tel", "web"]


# ============================================================================
# Report Target
# ============================================================================
REPORT_TARGET_VALUES: Tuple[str, ...] = ("profile", "diary")
ReportTargetLiteral = Literal["profile", "diary"]


# ============================================================================
# Report Status
# ============================================================================
REPORT_STATUS_VALUES: Tuple[str, ...] = ("open", "closed")
ReportStatusLiteral = Literal["open", "closed"]


# ============================================================================
# Review Status
# ============================================================================
REVIEW_STATUS_VALUES: Tuple[str, ...] = ("pending", "published", "rejected")
ReviewStatusLiteral = Literal["pending", "published", "rejected"]


# ============================================================================
# Therapist Status
# VALID VALUES: draft, published, archived
# NOTE: "active" is NOT a valid value (was incorrectly used in some places)
# ============================================================================
THERAPIST_STATUS_VALUES: Tuple[str, ...] = ("draft", "published", "archived")
TherapistStatusLiteral = Literal["draft", "published", "archived"]


# ============================================================================
# Service Type
# - store: 店舗型（固定の店舗で施術）
# - dispatch: 出張型（お客様の場所へ出張）
# - freelance: フリーランス（店舗に所属しない個人セラピスト）
# ============================================================================
SERVICE_TYPE_VALUES: Tuple[str, ...] = ("store", "dispatch", "freelance")
ServiceTypeLiteral = Literal["store", "dispatch", "freelance"]


# ============================================================================
# Reservation Status (Shop-side)
# ============================================================================
RESERVATION_STATUS_VALUES: Tuple[str, ...] = (
    "pending",
    "confirmed",
    "declined",
    "cancelled",
    "expired",
)
ReservationStatusLiteral = Literal[
    "pending", "confirmed", "declined", "cancelled", "expired"
]


# ============================================================================
# Reservation Slot Status
# ============================================================================
RESERVATION_SLOT_STATUS_VALUES: Tuple[str, ...] = ("open", "tentative", "blocked")
ReservationSlotStatusLiteral = Literal["open", "tentative", "blocked"]


# ============================================================================
# Guest Reservation Status
# ============================================================================
GUEST_RESERVATION_STATUS_VALUES: Tuple[str, ...] = (
    "draft",
    "pending",
    "confirmed",
    "cancelled",
    "no_show",
    "reserved",
    "expired",
)
GuestReservationStatusLiteral = Literal[
    "draft", "pending", "confirmed", "cancelled", "no_show", "reserved", "expired"
]


# ============================================================================
# Therapist Shift Status
# ============================================================================
THERAPIST_SHIFT_STATUS_VALUES: Tuple[str, ...] = ("available", "busy", "off")
TherapistShiftStatusLiteral = Literal["available", "busy", "off"]


# ============================================================================
# Notification Channel
# ============================================================================
NOTIFICATION_CHANNEL_VALUES: Tuple[str, ...] = ("email", "slack", "line", "log")
NotificationChannelLiteral = Literal["email", "slack", "line", "log"]


# ============================================================================
# Notification Status
# ============================================================================
NOTIFICATION_STATUS_VALUES: Tuple[str, ...] = (
    "pending",
    "in_progress",
    "succeeded",
    "failed",
)
NotificationStatusLiteral = Literal["pending", "in_progress", "succeeded", "failed"]


# ============================================================================
# Helper functions for validation
# ============================================================================
def is_valid_therapist_status(value: str) -> bool:
    """Check if a value is a valid therapist status."""
    return value in THERAPIST_STATUS_VALUES


def is_valid_reservation_status(value: str) -> bool:
    """Check if a value is a valid reservation status."""
    return value in RESERVATION_STATUS_VALUES


# ============================================================================
# All exported names
# ============================================================================
__all__ = [
    # Profile Status
    "STATUS_PROFILE_VALUES",
    "StatusProfileLiteral",
    # Diary Status
    "STATUS_DIARY_VALUES",
    "DiaryStatusLiteral",
    # Outlink Kind
    "OUTLINK_KIND_VALUES",
    "OutlinkKindLiteral",
    # Report Target
    "REPORT_TARGET_VALUES",
    "ReportTargetLiteral",
    # Report Status
    "REPORT_STATUS_VALUES",
    "ReportStatusLiteral",
    # Review Status
    "REVIEW_STATUS_VALUES",
    "ReviewStatusLiteral",
    # Therapist Status
    "THERAPIST_STATUS_VALUES",
    "TherapistStatusLiteral",
    # Service Type
    "SERVICE_TYPE_VALUES",
    "ServiceTypeLiteral",
    # Reservation Status
    "RESERVATION_STATUS_VALUES",
    "ReservationStatusLiteral",
    # Reservation Slot Status
    "RESERVATION_SLOT_STATUS_VALUES",
    "ReservationSlotStatusLiteral",
    # Guest Reservation Status
    "GUEST_RESERVATION_STATUS_VALUES",
    "GuestReservationStatusLiteral",
    # Therapist Shift Status
    "THERAPIST_SHIFT_STATUS_VALUES",
    "TherapistShiftStatusLiteral",
    # Notification Channel
    "NOTIFICATION_CHANNEL_VALUES",
    "NotificationChannelLiteral",
    # Notification Status
    "NOTIFICATION_STATUS_VALUES",
    "NotificationStatusLiteral",
    # Helpers
    "is_valid_therapist_status",
    "is_valid_reservation_status",
]
