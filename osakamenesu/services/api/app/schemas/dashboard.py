"""Dashboard schemas."""

from .base import (
    BaseModel,
    Field,
    List,
    Optional,
    UUID,
    datetime,
    ReservationSlotStatusLiteral,
    ReservationStatusLiteral,
)
from .shop import AvailabilityCalendar
from ..enums import TherapistStatusLiteral


# Notification schemas
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


# Shop schemas
class DashboardShopContact(BaseModel):
    phone: Optional[str] = None
    line_id: Optional[str] = None
    website_url: Optional[str] = None
    reservation_form_url: Optional[str] = None
    business_hours: Optional[str] = None


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
    availability_calendar: Optional[AvailabilityCalendar] = None
    default_slot_duration_minutes: Optional[int] = None


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
    default_slot_duration_minutes: Optional[int] = None


# Reservation schemas
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
    preferred_slots: List[DashboardReservationPreferredSlot] = Field(
        default_factory=list
    )


class DashboardReservationListResponse(BaseModel):
    profile_id: UUID
    total: int
    reservations: List[DashboardReservationItem] = Field(default_factory=list)
    next_cursor: Optional[str] = None
    prev_cursor: Optional[str] = None


class DashboardReservationUpdateRequest(BaseModel):
    status: ReservationStatusLiteral
    note: Optional[str] = None


# Therapist schemas
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
