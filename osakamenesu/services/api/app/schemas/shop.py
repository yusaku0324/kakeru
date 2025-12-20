"""Shop detail, staff, availability, and related schemas."""

from typing import Literal

from .base import (
    Any,
    BaseModel,
    Dict,
    Field,
    List,
    Optional,
    UUID,
    date,
    datetime,
)
from .profile import Promotion, FacetValue


class NextAvailableSlot(BaseModel):
    start_at: datetime
    end_at: Optional[datetime] = None
    status: Literal["ok", "maybe"]


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
    status: Optional[Literal["available", "limited", "unavailable"]] = None


class StaffTags(BaseModel):
    """Tags for staff profile display (mood, style, look, etc.)."""

    mood: Optional[str] = None
    style: Optional[str] = None
    look: Optional[str] = None
    contact: Optional[str] = None
    hobby_tags: Optional[List[str]] = None


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
    recommended_score: Optional[float] = None
    tags: Optional[StaffTags] = None


class AvailabilitySlot(BaseModel):
    start_at: datetime
    end_at: datetime
    status: Literal["open", "blocked"] = "open"
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


class AvailabilitySlotIn(BaseModel):
    start_at: datetime
    end_at: datetime
    status: Literal["open", "blocked"] = "open"
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
    description: Optional[str] = None
    catch_copy: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = Field(
        default=None, description="公開状態: draft(下書き), published(公開中)"
    )
    room_count: Optional[int] = Field(default=None, ge=1, description="同時予約可能数")
    buffer_minutes: Optional[int] = Field(
        default=None, ge=0, le=120, description="予約間バッファ時間（分）"
    )
    default_slot_duration_minutes: Optional[int] = Field(
        default=None, ge=30, description="デフォルト施術時間（分）"
    )
    price_min: Optional[int] = None
    price_max: Optional[int] = None
    service_type: Optional[str] = None
    service_tags: Optional[List[str]] = None
    menus: Optional[List[MenuInput]] = None
    staff: Optional[List[StaffInput]] = None
    contact: Optional[ShopContactUpdate] = None
    photos: Optional[List[str]] = None
