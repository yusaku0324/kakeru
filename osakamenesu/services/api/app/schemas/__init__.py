"""
Schemas package - re-exports all schemas for backward compatibility.

Schemas are organized into domain-specific modules:
- base: Common imports and constants
- auth: Authentication schemas
- favorite: User favorites schemas
- profile: Profile/Shop search schemas
- shop: Shop detail, staff, availability schemas
- shop_detail: ShopDetail schema
- review: Review and diary schemas
- reservation: Reservation schemas
- admin: Admin and bulk operation schemas
- dashboard: Dashboard-related schemas
- ops: Operations/metrics schemas
"""

# Base exports
from .base import (
    REVIEW_ASPECT_KEYS,
    ReviewAspectKey,
)

# Auth
from .auth import (
    AuthRequestLink,
    AuthVerifyRequest,
    AuthTestLoginRequest,
    UserPublic,
    AuthSessionStatus,
)

# Favorite
from .favorite import (
    FavoriteItem,
    FavoriteCreate,
    TherapistFavoriteItem,
    TherapistFavoriteCreate,
)

# Profile
from .profile import (
    ProfileCreate,
    DiscountIn,
    Promotion,
    ProfileDoc,
    AvailabilityOut,
    ProfileDetail,
    ProfileMarketingUpdate,
    FacetValue,
)

# Shop
from .shop import (
    NextAvailableSlot,
    ShopStaffPreview,
    ShopSummary,
    ShopSearchResponse,
    MediaImage,
    SocialLink,
    ContactInfo,
    GeoLocation,
    MenuItem,
    StaffShift,
    StaffTags,
    StaffSummary,
    AvailabilitySlot,
    AvailabilityDay,
    AvailabilityCalendar,
    AvailabilitySlotIn,
    AvailabilityCreate,
    AvailabilityUpsert,
    MenuInput,
    BulkMenuInput,
    StaffInput,
    ShopContactUpdate,
    ShopContentUpdate,
)

# Shop Detail
from .shop_detail import ShopDetail

# Review
from .review import (
    ReviewAspectScore,
    HighlightedReview,
    ReviewItem,
    ReviewAspectSummary,
    ReviewSummary,
    ReviewCreateRequest,
    ReviewListResponse,
    ReviewModerationRequest,
    DiarySnippet,
    DiaryItem,
    DiaryListResponse,
)

# Reservation
from .reservation import (
    ReservationCustomerInput,
    ReservationCustomer,
    ReservationPreferredSlotBase,
    ReservationPreferredSlotInput,
    ReservationPreferredSlot,
    ReservationStatusEvent,
    Reservation,
    ReservationCreateRequest,
    ReservationUpdateRequest,
    ReservationAdminSummary,
    ReservationAdminList,
    ReservationAdminUpdate,
)

# Admin
from .admin import (
    BulkReviewInput,
    BulkDiaryInput,
    BulkAvailabilityInput,
    BulkShopContentItem,
    BulkShopContentRequest,
    BulkShopIngestResult,
    BulkShopContentResponse,
    ShopAdminSummary,
    ShopAdminList,
    ShopAdminDetail,
)

# Dashboard
from .dashboard import (
    DashboardNotificationStatus,
    DashboardNotificationChannelEmail,
    DashboardNotificationChannelLine,
    DashboardNotificationChannelSlack,
    DashboardNotificationChannels,
    DashboardNotificationSettingsResponse,
    DashboardNotificationSettingsUpdatePayload,
    DashboardNotificationSettingsTestPayload,
    DashboardShopContact,
    DashboardShopMenu,
    DashboardShopStaff,
    DashboardShopSummaryItem,
    DashboardShopListResponse,
    DashboardShopProfileResponse,
    DashboardShopProfileCreatePayload,
    DashboardShopProfileUpdatePayload,
    DashboardReservationPreferredSlot,
    DashboardReservationItem,
    DashboardReservationListResponse,
    DashboardReservationUpdateRequest,
    DashboardTherapistSummary,
    DashboardTherapistDetail,
    DashboardTherapistPhotoUploadResponse,
    DashboardTherapistCreatePayload,
    DashboardTherapistUpdatePayload,
    DashboardTherapistReorderItem,
    DashboardTherapistReorderPayload,
)

# Ops
from .ops import (
    OpsQueueStats,
    OpsOutboxChannelSummary,
    OpsOutboxSummary,
    OpsSlotsSummary,
)

__all__ = [
    # Base
    "REVIEW_ASPECT_KEYS",
    "ReviewAspectKey",
    # Auth
    "AuthRequestLink",
    "AuthVerifyRequest",
    "AuthTestLoginRequest",
    "UserPublic",
    "AuthSessionStatus",
    # Favorite
    "FavoriteItem",
    "FavoriteCreate",
    "TherapistFavoriteItem",
    "TherapistFavoriteCreate",
    # Profile
    "ProfileCreate",
    "DiscountIn",
    "Promotion",
    "ProfileDoc",
    "AvailabilityOut",
    "ProfileDetail",
    "ProfileMarketingUpdate",
    "FacetValue",
    # Shop
    "NextAvailableSlot",
    "ShopStaffPreview",
    "ShopSummary",
    "ShopSearchResponse",
    "MediaImage",
    "SocialLink",
    "ContactInfo",
    "GeoLocation",
    "MenuItem",
    "StaffShift",
    "StaffTags",
    "StaffSummary",
    "AvailabilitySlot",
    "AvailabilityDay",
    "AvailabilityCalendar",
    "AvailabilitySlotIn",
    "AvailabilityCreate",
    "AvailabilityUpsert",
    "MenuInput",
    "BulkMenuInput",
    "StaffInput",
    "ShopContactUpdate",
    "ShopContentUpdate",
    # Shop Detail
    "ShopDetail",
    # Review
    "ReviewAspectScore",
    "HighlightedReview",
    "ReviewItem",
    "ReviewAspectSummary",
    "ReviewSummary",
    "ReviewCreateRequest",
    "ReviewListResponse",
    "ReviewModerationRequest",
    "DiarySnippet",
    "DiaryItem",
    "DiaryListResponse",
    # Reservation
    "ReservationCustomerInput",
    "ReservationCustomer",
    "ReservationPreferredSlotBase",
    "ReservationPreferredSlotInput",
    "ReservationPreferredSlot",
    "ReservationStatusEvent",
    "Reservation",
    "ReservationCreateRequest",
    "ReservationUpdateRequest",
    "ReservationAdminSummary",
    "ReservationAdminList",
    "ReservationAdminUpdate",
    # Admin
    "BulkReviewInput",
    "BulkDiaryInput",
    "BulkAvailabilityInput",
    "BulkShopContentItem",
    "BulkShopContentRequest",
    "BulkShopIngestResult",
    "BulkShopContentResponse",
    "ShopAdminSummary",
    "ShopAdminList",
    "ShopAdminDetail",
    # Dashboard
    "DashboardNotificationStatus",
    "DashboardNotificationChannelEmail",
    "DashboardNotificationChannelLine",
    "DashboardNotificationChannelSlack",
    "DashboardNotificationChannels",
    "DashboardNotificationSettingsResponse",
    "DashboardNotificationSettingsUpdatePayload",
    "DashboardNotificationSettingsTestPayload",
    "DashboardShopContact",
    "DashboardShopMenu",
    "DashboardShopStaff",
    "DashboardShopSummaryItem",
    "DashboardShopListResponse",
    "DashboardShopProfileResponse",
    "DashboardShopProfileCreatePayload",
    "DashboardShopProfileUpdatePayload",
    "DashboardReservationPreferredSlot",
    "DashboardReservationItem",
    "DashboardReservationListResponse",
    "DashboardReservationUpdateRequest",
    "DashboardTherapistSummary",
    "DashboardTherapistDetail",
    "DashboardTherapistPhotoUploadResponse",
    "DashboardTherapistCreatePayload",
    "DashboardTherapistUpdatePayload",
    "DashboardTherapistReorderItem",
    "DashboardTherapistReorderPayload",
    # Ops
    "OpsQueueStats",
    "OpsOutboxChannelSummary",
    "OpsOutboxSummary",
    "OpsSlotsSummary",
]
