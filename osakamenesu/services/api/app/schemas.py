from __future__ import annotations

import re
from datetime import datetime, date
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, conint, constr, field_validator, model_validator

from .constants import (
    RESERVATION_SLOT_STATUS_SET,
    ReservationSlotStatusLiteral,
    ReservationStatusLiteral,
)


REVIEW_ASPECT_KEYS = ("therapist_service", "staff_response", "room_cleanliness")
ReviewAspectKey = Literal["therapist_service", "staff_response", "room_cleanliness"]


class AuthRequestLink(BaseModel):
    email: EmailStr
    scope: Literal["dashboard", "site"] = "dashboard"


class AuthVerifyRequest(BaseModel):
    token: str


class AuthTestLoginRequest(BaseModel):
    email: EmailStr
    display_name: Optional[str] = None
    scope: Literal["dashboard", "site"] = "site"


class UserPublic(BaseModel):
    id: UUID
    email: EmailStr
    display_name: Optional[str] = None
    created_at: datetime
    last_login_at: Optional[datetime] = None


class AuthSessionStatus(BaseModel):
    authenticated: bool
    site_authenticated: bool = False
    dashboard_authenticated: bool = False
    scopes: List[str] = Field(default_factory=list)
    user: Optional[UserPublic] = None


class FavoriteItem(BaseModel):
    shop_id: UUID
    created_at: datetime


class FavoriteCreate(BaseModel):
    shop_id: UUID


class TherapistFavoriteItem(BaseModel):
    therapist_id: UUID
    shop_id: UUID
    created_at: datetime


class TherapistFavoriteCreate(BaseModel):
    therapist_id: UUID


class ProfileCreate(BaseModel):
    slug: Optional[str] = None
    name: str
    area: str
    price_min: int
    price_max: int
    bust_tag: str
    service_type: str = "store"
    height_cm: Optional[int] = None
    age: Optional[int] = None
    body_tags: Optional[List[str]] = None
    photos: Optional[List[str]] = None
    contact_json: Optional[dict] = None
    discounts: Optional[List[Dict[str, Any]]] = None
    ranking_badges: Optional[List[str]] = None
    ranking_weight: Optional[int] = None
    status: str = "draft"


class DiscountIn(BaseModel):
    label: str
    description: Optional[str] = None
    expires_at: Optional[str] = None


class Promotion(BaseModel):
    label: str
    description: Optional[str] = None
    expires_at: Optional[str] = None
    highlight: Optional[str] = None


class ProfileDoc(BaseModel):
    id: str
    slug: Optional[str] = None
    name: str
    area: str
    price_min: int
    price_max: int
    bust_tag: str
    service_type: str
    store_name: Optional[str] = None
    height_cm: Optional[int] = None
    age: Optional[int] = None
    body_tags: List[str] = Field(default_factory=list)
    photos: List[str] = Field(default_factory=list)
    discounts: List[Dict[str, Any]] = Field(default_factory=list)
    ranking_badges: List[str] = Field(default_factory=list)
    ranking_weight: Optional[int] = None
    status: str = "published"
    today: bool = False
    tag_score: float = 0.0
    ctr7d: float = 0.0
    updated_at: int = Field(..., description="unix ts")
    promotions: List[Dict[str, Any]] = Field(default_factory=list)
    review_score: Optional[float] = None
    review_count: Optional[int] = None
    review_highlights: List[Dict[str, Any]] = Field(default_factory=list)
    review_aspect_averages: Dict[str, float] = Field(default_factory=dict)
    review_aspect_counts: Dict[str, int] = Field(default_factory=dict)
    ranking_reason: Optional[str] = None
    staff_preview: Optional[Any] = None
    price_band: Optional[str] = None
    price_band_label: Optional[str] = None
    has_promotions: Optional[bool] = None
    has_discounts: Optional[bool] = None
    promotion_count: Optional[int] = None
    ranking_score: Optional[float] = None
    diary_count: Optional[int] = None
    has_diaries: Optional[bool] = None
    diary_count: Optional[int] = None
    has_diaries: Optional[bool] = None
    diary_count: Optional[int] = None
    has_diaries: Optional[bool] = None


class AvailabilityOut(BaseModel):
    date: str  # YYYY-MM-DD
    is_today: bool = False
    slots_json: Optional[Dict[str, Any]] = None


class ProfileDetail(BaseModel):
    id: str
    slug: Optional[str] = None
    name: str
    area: str
    price_min: int
    price_max: int
    bust_tag: str
    service_type: str = "store"
    store_name: Optional[str] = None
    height_cm: Optional[int] = None
    age: Optional[int] = None
    body_tags: List[str] = Field(default_factory=list)
    photos: List[str] = Field(default_factory=list)
    discounts: List[Dict[str, Any]] = Field(default_factory=list)
    ranking_badges: List[str] = Field(default_factory=list)
    ranking_weight: Optional[int] = None
    status: str = "published"
    today: bool = False
    availability_today: Optional[AvailabilityOut] = None
    outlinks: List[Dict[str, str]] = Field(default_factory=list)  # [{kind, token}]


class ProfileMarketingUpdate(BaseModel):
    discounts: Optional[List[DiscountIn]] = None
    ranking_badges: Optional[List[str]] = None
    ranking_weight: Optional[int] = None


class FacetValue(BaseModel):
    value: str
    label: Optional[str] = None
    count: int
    selected: Optional[bool] = None


class NextAvailableSlot(BaseModel):
    start_at: datetime
    status: Literal['ok', 'maybe']


class ShopStaffPreview(BaseModel):
    id: Optional[str] = None
    name: str
    alias: Optional[str] = None
    headline: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    avatar_url: Optional[str] = None
    specialties: List[str] = Field(default_factory=list)
    today_available: Optional[bool] = None
    next_available_at: Optional[datetime] = None
    next_available_slot: Optional[NextAvailableSlot] = None


class ShopSummary(BaseModel):
    id: UUID
    slug: Optional[str] = None
    name: str
    store_name: Optional[str] = None
    area: str
    area_name: Optional[str] = None
    address: Optional[str] = None
    categories: List[str] = Field(default_factory=list)
    service_tags: List[str] = Field(default_factory=list)
    min_price: int = Field(..., ge=0)
    max_price: int = Field(..., ge=0)
    nearest_station: Optional[str] = None
    station_line: Optional[str] = None
    station_exit: Optional[str] = None
    station_walk_minutes: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    lead_image_url: Optional[str] = None
    badges: List[str] = Field(default_factory=list)
    today_available: Optional[bool] = None
    next_available_at: Optional[datetime] = None
    next_available_slot: Optional[NextAvailableSlot] = None
    distance_km: Optional[float] = None
    online_reservation: Optional[bool] = None
    updated_at: Optional[datetime] = None
    ranking_reason: Optional[str] = None
    promotions: List[Promotion] = Field(default_factory=list)
    price_band: Optional[str] = None
    price_band_label: Optional[str] = None
    has_promotions: Optional[bool] = None
    has_discounts: Optional[bool] = None
    promotion_count: Optional[int] = None
    ranking_score: Optional[float] = None
    staff_preview: List[ShopStaffPreview] = Field(default_factory=list)


class ShopSearchResponse(BaseModel):
    page: int
    page_size: int
    total: int
    results: List[ShopSummary]
    facets: Dict[str, List[FacetValue]] = Field(default_factory=dict)


class MediaImage(BaseModel):
    url: str
    kind: Optional[str] = None
    caption: Optional[str] = None
    order: Optional[int] = None


class SocialLink(BaseModel):
    platform: str
    url: str
    label: Optional[str] = None

class ContactInfo(BaseModel):
    phone: Optional[str] = None
    line_id: Optional[str] = None
    website_url: Optional[str] = None
    reservation_form_url: Optional[str] = None
    sns: List[SocialLink] = Field(default_factory=list)


class GeoLocation(BaseModel):
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    nearest_station: Optional[str] = None
    station_line: Optional[str] = None
    station_exit: Optional[str] = None
    station_walk_minutes: Optional[int] = None


class MenuItem(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    price: int
    currency: str = "JPY"
    is_reservable_online: bool = True
    tags: List[str] = Field(default_factory=list)


class StaffShift(BaseModel):
    date: date
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    status: Optional[Literal['available', 'limited', 'unavailable']] = None


class StaffSummary(BaseModel):
    id: UUID
    name: str
    alias: Optional[str] = None
    avatar_url: Optional[str] = None
    headline: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    next_shift: Optional[StaffShift] = None
    specialties: List[str] = Field(default_factory=list)
    is_pickup: Optional[bool] = None
    next_available_slot: Optional[NextAvailableSlot] = None


class AvailabilitySlot(BaseModel):
    start_at: datetime
    end_at: datetime
    status: Literal['open', 'tentative', 'blocked'] = 'open'
    staff_id: Optional[UUID] = None
    menu_id: Optional[UUID] = None


class AvailabilityDay(BaseModel):
    date: date
    is_today: Optional[bool] = None
    slots: List[AvailabilitySlot]


class AvailabilityCalendar(BaseModel):
    shop_id: UUID
    generated_at: datetime
    days: List[AvailabilityDay]


class ReviewAspectScore(BaseModel):
    score: conint(ge=1, le=5)
    note: Optional[constr(max_length=240)] = None


class HighlightedReview(BaseModel):
    review_id: Optional[UUID] = None
    title: str
    body: str
    score: int
    visited_at: Optional[date] = None
    author_alias: Optional[str] = None
    aspects: Dict[str, Any] = Field(default_factory=dict)


class ReviewItem(BaseModel):
    id: UUID
    profile_id: UUID
    status: Literal['pending', 'published', 'rejected']
    score: int
    title: Optional[str] = None
    body: str
    author_alias: Optional[str] = None
    visited_at: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    aspects: Dict[str, Any] = Field(default_factory=dict)


class ReviewAspectSummary(BaseModel):
    key: str
    average_score: Optional[float] = None
    total: int = 0


class ReviewSummary(BaseModel):
    average_score: Optional[float] = None
    review_count: Optional[int] = None
    highlighted: List[HighlightedReview] = Field(default_factory=list)
    aspect_averages: Dict[str, float] = Field(default_factory=dict)
    aspect_counts: Dict[str, int] = Field(default_factory=dict)


class ReviewCreateRequest(BaseModel):
    score: conint(ge=1, le=5)
    body: constr(min_length=1, max_length=4000)
    title: Optional[constr(max_length=160)] = None
    author_alias: Optional[constr(max_length=80)] = None
    visited_at: Optional[date] = None
    aspects: Optional[Dict[str, Any]] = Field(default=None)


class ReviewListResponse(BaseModel):
    total: int
    items: List[ReviewItem]
    aspect_averages: Dict[str, float] = Field(default_factory=dict)
    aspect_counts: Dict[str, int] = Field(default_factory=dict)


class ReviewModerationRequest(BaseModel):
    status: Literal['pending', 'published', 'rejected']


class DiarySnippet(BaseModel):
    id: Optional[UUID] = None
    title: Optional[str] = None
    body: str
    photos: List[str] = Field(default_factory=list)
    hashtags: List[str] = Field(default_factory=list)
    published_at: Optional[datetime] = None


class DiaryItem(BaseModel):
    id: UUID
    profile_id: UUID
    title: str
    body: str
    photos: List[str] = Field(default_factory=list)
    hashtags: List[str] = Field(default_factory=list)
    created_at: datetime


class DiaryListResponse(BaseModel):
    total: int
    items: List[DiaryItem]


class ShopDetail(ShopSummary):
    description: Optional[str] = None
    catch_copy: Optional[str] = None
    photos: List[MediaImage] = Field(default_factory=list)
    contact: Optional[ContactInfo] = None
    location: Optional[GeoLocation] = None
    menus: List[MenuItem] = Field(default_factory=list)
    staff: List[StaffSummary] = Field(default_factory=list)
    availability_calendar: Optional[AvailabilityCalendar] = None
    reviews: Optional[ReviewSummary] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    diaries: List[DiarySnippet] = Field(default_factory=list)


class ReservationCustomerInput(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    line_id: Optional[str] = None
    remark: Optional[str] = None

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("name is required")
        normalized = value.strip()
        if len(normalized) > 80:
            raise ValueError("name must be 80 characters or fewer")
        return normalized

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("phone is required")
        normalized = value.strip()
        digits = re.sub(r"\D+", "", normalized)
        if len(digits) < 10 or len(digits) > 13:
            raise ValueError("phone must include 10-13 numeric digits")
        return normalized

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class ReservationCustomer(ReservationCustomerInput):
    id: Optional[UUID] = None


class ReservationPreferredSlotBase(BaseModel):
    desired_start: datetime
    desired_end: datetime
    status: ReservationSlotStatusLiteral = "open"

    @field_validator("status")
    @classmethod
    def _validate_status(cls, value: str) -> ReservationSlotStatusLiteral:
        if value not in RESERVATION_SLOT_STATUS_SET:
            raise ValueError("invalid slot status")
        return value  # type: ignore[return-value]

    @model_validator(mode="after")
    def _validate_range(self) -> "ReservationPreferredSlotBase":
        if self.desired_end <= self.desired_start:
            raise ValueError("desired_end must be after desired_start")
        return self


class ReservationPreferredSlotInput(ReservationPreferredSlotBase):
    pass


class ReservationPreferredSlot(ReservationPreferredSlotBase):
    id: UUID
    created_at: datetime


class ReservationStatusEvent(BaseModel):
    status: ReservationStatusLiteral
    changed_at: datetime
    changed_by: Optional[str] = None
    note: Optional[str] = None


class Reservation(BaseModel):
    id: UUID
    status: ReservationStatusLiteral
    shop_id: UUID
    staff_id: Optional[UUID] = None
    menu_id: Optional[UUID] = None
    channel: Optional[str] = None
    desired_start: datetime
    desired_end: datetime
    notes: Optional[str] = None
    customer: ReservationCustomer
    status_history: List[ReservationStatusEvent] = Field(default_factory=list)
    marketing_opt_in: Optional[bool] = None
    created_at: datetime
    updated_at: datetime
    preferred_slots: List[ReservationPreferredSlot] = Field(default_factory=list)


class ReservationCreateRequest(BaseModel):
    shop_id: UUID
    staff_id: Optional[UUID] = None
    menu_id: Optional[UUID] = None
    channel: Optional[str] = None
    desired_start: datetime
    desired_end: datetime
    notes: Optional[str] = None
    customer: ReservationCustomerInput
    marketing_opt_in: Optional[bool] = None
    preferred_slots: Optional[List[ReservationPreferredSlotInput]] = None


class ReservationUpdateRequest(BaseModel):
    status: Optional[ReservationStatusLiteral] = None
    staff_id: Optional[UUID] = None
    notes: Optional[str] = None
    response_message: Optional[str] = None
    keep_customer_contacted: Optional[bool] = None


class ReservationAdminSummary(BaseModel):
    id: UUID
    shop_id: UUID
    shop_name: str
    status: ReservationStatusLiteral
    desired_start: datetime
    desired_end: datetime
    channel: Optional[str] = None
    notes: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ReservationAdminList(BaseModel):
    total: int
    items: list[ReservationAdminSummary]


class ReservationAdminUpdate(BaseModel):
    status: Optional[ReservationStatusLiteral] = None
    notes: Optional[str] = None


class AvailabilitySlotIn(BaseModel):
    start_at: datetime
    end_at: datetime
    status: Literal['open', 'tentative', 'blocked'] = 'open'
    staff_id: Optional[UUID] = None
    menu_id: Optional[UUID] = None


class AvailabilityCreate(BaseModel):
    profile_id: UUID
    date: date
    slots: Optional[List[AvailabilitySlotIn]] = None


class AvailabilityUpsert(BaseModel):
    date: date
    slots: Optional[List[AvailabilitySlotIn]] = None


class MenuInput(BaseModel):
    id: Optional[UUID] = None
    name: str
    price: int
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    is_reservable_online: Optional[bool] = True


class BulkMenuInput(MenuInput):
    external_id: Optional[str] = None


class StaffInput(BaseModel):
    id: Optional[UUID] = None
    name: str
    alias: Optional[str] = None
    headline: Optional[str] = None
    specialties: List[str] = Field(default_factory=list)


class ShopContactUpdate(BaseModel):
    phone: Optional[str] = None
    line_id: Optional[str] = None
    website_url: Optional[str] = None
    reservation_form_url: Optional[str] = None
    sns: Optional[List[Dict[str, Any]]] = None


class ShopContentUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    area: Optional[str] = None
    price_min: Optional[int] = None
    price_max: Optional[int] = None
    service_type: Optional[str] = None
    service_tags: Optional[List[str]] = None
    menus: Optional[List[MenuInput]] = None
    staff: Optional[List[StaffInput]] = None
    contact: Optional[ShopContactUpdate] = None
    description: Optional[str] = None
    catch_copy: Optional[str] = None
    address: Optional[str] = None
    photos: Optional[List[str]] = None


ReviewStatusLiteral = Literal['pending', 'published', 'rejected']
DiaryStatusLiteral = Literal['mod', 'published', 'hidden']
TherapistStatusLiteral = Literal['draft', 'published', 'archived']


class BulkReviewInput(BaseModel):
    external_id: Optional[str] = None
    score: conint(ge=1, le=5)  # type: ignore[valid-type]
    title: Optional[str] = None
    body: str
    author_alias: Optional[str] = None
    visited_at: Optional[date] = None
    status: ReviewStatusLiteral = 'published'
    aspects: Optional[Dict[str, Any]] = None


class BulkDiaryInput(BaseModel):
    external_id: Optional[str] = None
    title: str
    body: str
    photos: List[str] = Field(default_factory=list)
    hashtags: List[str] = Field(default_factory=list)
    status: DiaryStatusLiteral = 'published'
    created_at: Optional[datetime] = None


class BulkAvailabilityInput(BaseModel):
    date: date
    slots: Optional[List[AvailabilitySlotIn]] = None


class BulkShopContentItem(BaseModel):
    shop_id: UUID
    service_tags: Optional[List[str]] = None
    photos: Optional[List[str]] = None
    menus: Optional[List[BulkMenuInput]] = None
    reviews: Optional[List[BulkReviewInput]] = None
    diaries: Optional[List[BulkDiaryInput]] = None
    availability: Optional[List[BulkAvailabilityInput]] = None
    contact: Optional[ShopContactUpdate] = None
    description: Optional[str] = None
    catch_copy: Optional[str] = None
    address: Optional[str] = None


class BulkShopContentRequest(BaseModel):
    shops: List[BulkShopContentItem]


class BulkShopIngestResult(BaseModel):
    shop_id: UUID
    photos_updated: bool = False
    menus_updated: bool = False
    reviews_created: int = 0
    reviews_updated: int = 0
    diaries_created: int = 0
    diaries_updated: int = 0
    availability_upserts: int = 0


class BulkShopContentResponse(BaseModel):
    processed: List[BulkShopIngestResult] = Field(default_factory=list)
    errors: List[Dict[str, Any]] = Field(default_factory=list)


class ShopAdminSummary(BaseModel):
    id: UUID
    name: str
    slug: Optional[str] = None
    area: str
    status: str
    service_type: str


class ShopAdminList(BaseModel):
    items: List[ShopAdminSummary]


class ShopAdminDetail(BaseModel):
    id: UUID
    name: str
    slug: Optional[str] = None
    area: str
    price_min: int
    price_max: int
    service_type: str
    service_tags: List[str] = Field(default_factory=list)
    contact: Dict[str, Any] | None = None
    description: Optional[str] = None
    catch_copy: Optional[str] = None
    address: Optional[str] = None
    photos: List[str] = Field(default_factory=list)
    menus: List[MenuItem] = Field(default_factory=list)
    staff: List[StaffSummary] = Field(default_factory=list)
    availability: List[AvailabilityDay] = Field(default_factory=list)

DashboardNotificationStatus = ReservationStatusLiteral


class DashboardNotificationChannelEmail(BaseModel):
    enabled: bool = False
    recipients: List[str] = Field(default_factory=list)


class DashboardNotificationChannelLine(BaseModel):
    enabled: bool = False
    token: Optional[str] = None


class DashboardNotificationChannelSlack(BaseModel):
    enabled: bool = False
    webhook_url: Optional[str] = None


class DashboardNotificationChannels(BaseModel):
    email: DashboardNotificationChannelEmail
    line: DashboardNotificationChannelLine
    slack: DashboardNotificationChannelSlack


class DashboardNotificationSettingsResponse(BaseModel):
    profile_id: UUID
    updated_at: datetime
    trigger_status: List[DashboardNotificationStatus] = Field(default_factory=list)
    channels: DashboardNotificationChannels


class DashboardNotificationSettingsUpdatePayload(BaseModel):
    updated_at: datetime
    trigger_status: List[DashboardNotificationStatus]
    channels: DashboardNotificationChannels


class DashboardNotificationSettingsTestPayload(BaseModel):
    trigger_status: List[DashboardNotificationStatus]
    channels: DashboardNotificationChannels


class DashboardShopContact(BaseModel):
    phone: Optional[str] = None
    line_id: Optional[str] = None
    website_url: Optional[str] = None
    reservation_form_url: Optional[str] = None


class DashboardShopMenu(BaseModel):
    id: Optional[str] = None
    name: str
    price: int
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    is_reservable_online: Optional[bool] = True


class DashboardShopStaff(BaseModel):
    id: Optional[str] = None
    name: str
    alias: Optional[str] = None
    headline: Optional[str] = None
    specialties: List[str] = Field(default_factory=list)


class DashboardShopSummaryItem(BaseModel):
    id: UUID
    name: str
    area: Optional[str] = None
    status: Optional[str] = None
    updated_at: Optional[datetime] = None


class DashboardShopListResponse(BaseModel):
    shops: List[DashboardShopSummaryItem] = Field(default_factory=list)


class DashboardShopProfileResponse(BaseModel):
    id: UUID
    slug: Optional[str] = None
    name: str
    store_name: Optional[str] = None
    area: str
    price_min: int
    price_max: int
    service_type: str
    service_tags: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    catch_copy: Optional[str] = None
    address: Optional[str] = None
    photos: List[str] = Field(default_factory=list)
    contact: Optional[DashboardShopContact] = None
    menus: List[DashboardShopMenu] = Field(default_factory=list)
    staff: List[DashboardShopStaff] = Field(default_factory=list)
    updated_at: datetime
    status: Optional[str] = None


class DashboardShopProfileCreatePayload(BaseModel):
    name: str
    area: str
    price_min: int = Field(ge=0)
    price_max: int = Field(ge=0)
    service_type: Optional[str] = None
    service_tags: Optional[List[str]] = None
    description: Optional[str] = None
    catch_copy: Optional[str] = None
    address: Optional[str] = None
    photos: Optional[List[str]] = None
    contact: Optional[DashboardShopContact] = None


class DashboardShopProfileUpdatePayload(BaseModel):
    updated_at: datetime
    name: Optional[str] = None
    slug: Optional[str] = None
    area: Optional[str] = None
    price_min: Optional[int] = None
    price_max: Optional[int] = None
    service_type: Optional[str] = None
    service_tags: Optional[List[str]] = None
    description: Optional[str] = None
    catch_copy: Optional[str] = None
    address: Optional[str] = None
    photos: Optional[List[str]] = None
    contact: Optional[DashboardShopContact] = None
    menus: Optional[List[DashboardShopMenu]] = None
    staff: Optional[List[DashboardShopStaff]] = None
    status: Optional[str] = None


class DashboardReservationPreferredSlot(BaseModel):
    desired_start: datetime
    desired_end: datetime
    status: ReservationSlotStatusLiteral


class DashboardReservationItem(BaseModel):
    id: UUID
    status: ReservationStatusLiteral
    channel: Optional[str] = None
    desired_start: datetime
    desired_end: datetime
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    notes: Optional[str] = None
    marketing_opt_in: Optional[bool] = None
    staff_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    approval_decision: Optional[str] = None
    approval_decided_at: Optional[datetime] = None
    approval_decided_by: Optional[str] = None
    reminder_scheduled_at: Optional[datetime] = None
    preferred_slots: List[DashboardReservationPreferredSlot] = Field(default_factory=list)


class DashboardReservationListResponse(BaseModel):
    profile_id: UUID
    total: int
    reservations: List[DashboardReservationItem] = Field(default_factory=list)
    next_cursor: Optional[str] = None
    prev_cursor: Optional[str] = None


class DashboardReservationUpdateRequest(BaseModel):
    status: ReservationStatusLiteral
    note: Optional[str] = None


class OpsQueueStats(BaseModel):
    pending: int = Field(ge=0)
    lag_seconds: float = Field(ge=0.0)
    oldest_created_at: Optional[datetime] = None
    next_attempt_at: Optional[datetime] = None


class OpsOutboxChannelSummary(BaseModel):
    channel: str
    pending: int = Field(ge=0)


class OpsOutboxSummary(BaseModel):
    channels: List[OpsOutboxChannelSummary] = Field(default_factory=list)


class OpsSlotsSummary(BaseModel):
    pending_total: int = Field(ge=0)
    pending_stale: int = Field(ge=0)
    confirmed_next_24h: int = Field(ge=0)
    window_start: datetime
    window_end: datetime


class DashboardTherapistSummary(BaseModel):
    id: UUID
    name: str
    alias: Optional[str] = None
    headline: Optional[str] = None
    status: TherapistStatusLiteral
    display_order: int
    is_booking_enabled: bool
    updated_at: datetime
    photo_urls: List[str] = Field(default_factory=list)
    specialties: List[str] = Field(default_factory=list)


class DashboardTherapistDetail(DashboardTherapistSummary):
    biography: Optional[str] = None
    qualifications: List[str] = Field(default_factory=list)
    experience_years: Optional[int] = None
    created_at: datetime


class DashboardTherapistPhotoUploadResponse(BaseModel):
    url: str
    filename: str
    content_type: str
    size: int = Field(ge=0)


class DashboardTherapistCreatePayload(BaseModel):
    name: str
    alias: Optional[str] = None
    headline: Optional[str] = None
    biography: Optional[str] = None
    specialties: Optional[List[str]] = None
    qualifications: Optional[List[str]] = None
    experience_years: Optional[int] = Field(default=None, ge=0)
    photo_urls: Optional[List[str]] = None
    is_booking_enabled: Optional[bool] = True


class DashboardTherapistUpdatePayload(BaseModel):
    updated_at: datetime
    name: Optional[str] = None
    alias: Optional[str] = None
    headline: Optional[str] = None
    biography: Optional[str] = None
    specialties: Optional[List[str]] = None
    qualifications: Optional[List[str]] = None
    experience_years: Optional[int] = Field(default=None, ge=0)
    photo_urls: Optional[List[str]] = None
    status: Optional[TherapistStatusLiteral] = None
    is_booking_enabled: Optional[bool] = None
    display_order: Optional[int] = None


class DashboardTherapistReorderItem(BaseModel):
    therapist_id: UUID
    display_order: int = Field(ge=0)


class DashboardTherapistReorderPayload(BaseModel):
    items: List[DashboardTherapistReorderItem]
