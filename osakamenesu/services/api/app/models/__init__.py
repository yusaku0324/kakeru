"""
Models package - re-exports all models for backward compatibility.

Models are organized into domain-specific modules:
- base: Base class, enums, and utilities
- profile: Profile (Shop) model
- therapist: Therapist and TherapistShift models
- user: User, ShopManager, UserAuthToken, UserSession
- favorite: UserFavorite, UserTherapistFavorite
- content: Diary, Availability, Outlink, Click, Consent
- review: Review, Report
- notification: DashboardNotificationSetting
- admin: AdminLog, AdminChangeLog
- reservation: Reservation and notification delivery models, GuestReservation
- matching: GuestMatchLog
"""

# Base and utilities
from .base import (
    Base,
    now_utc,
    # Enum types
    StatusProfile,
    StatusDiary,
    OutlinkKind,
    ReportTarget,
    ReportStatus,
    ReviewStatus,
    TherapistStatus,
    ServiceType,
    ReservationStatus,
    ReservationSlotStatus,
    GuestReservationStatus,
    TherapistShiftStatus,
    # Constants
    RESERVATION_NOTIFICATION_CHANNEL_KEYS,
    RESERVATION_NOTIFICATION_STATUS_KEYS,
    RESERVATION_NOTIFICATION_ATTEMPT_STATUS_KEYS,
)

# Profile
from .profile import Profile

# Therapist
from .therapist import Therapist, TherapistShift

# User and auth
from .user import User, ShopManager, UserAuthToken, UserSession

# Favorites
from .favorite import UserFavorite, UserTherapistFavorite

# Content
from .content import Diary, Availability, Outlink, Click, Consent

# Review and Report
from .review import Review, Report

# Notification
from .notification import DashboardNotificationSetting

# Admin
from .admin import AdminLog, AdminChangeLog

# Reservation
from .reservation import (
    Reservation,
    ReservationStatusEvent,
    ReservationPreferredSlot,
    ReservationNotificationChannelOption,
    ReservationNotificationStatusOption,
    ReservationNotificationAttemptStatusOption,
    ReservationNotificationDelivery,
    ReservationNotificationAttempt,
    GuestReservation,
)

# Matching
from .matching import GuestMatchLog

__all__ = [
    # Base
    "Base",
    "now_utc",
    # Enums
    "StatusProfile",
    "StatusDiary",
    "OutlinkKind",
    "ReportTarget",
    "ReportStatus",
    "ReviewStatus",
    "TherapistStatus",
    "ServiceType",
    "ReservationStatus",
    "ReservationSlotStatus",
    "GuestReservationStatus",
    "TherapistShiftStatus",
    # Constants
    "RESERVATION_NOTIFICATION_CHANNEL_KEYS",
    "RESERVATION_NOTIFICATION_STATUS_KEYS",
    "RESERVATION_NOTIFICATION_ATTEMPT_STATUS_KEYS",
    # Profile
    "Profile",
    # Therapist
    "Therapist",
    "TherapistShift",
    # User
    "User",
    "ShopManager",
    "UserAuthToken",
    "UserSession",
    # Favorites
    "UserFavorite",
    "UserTherapistFavorite",
    # Content
    "Diary",
    "Availability",
    "Outlink",
    "Click",
    "Consent",
    # Review
    "Review",
    "Report",
    # Notification
    "DashboardNotificationSetting",
    # Admin
    "AdminLog",
    "AdminChangeLog",
    # Reservation
    "Reservation",
    "ReservationStatusEvent",
    "ReservationPreferredSlot",
    "ReservationNotificationChannelOption",
    "ReservationNotificationStatusOption",
    "ReservationNotificationAttemptStatusOption",
    "ReservationNotificationDelivery",
    "ReservationNotificationAttempt",
    "GuestReservation",
    # Matching
    "GuestMatchLog",
]
