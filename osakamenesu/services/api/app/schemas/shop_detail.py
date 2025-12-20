"""ShopDetail schema - extends ShopSummary with full details."""

from .base import Field, List, Dict, Optional, Any
from .shop import (
    ShopSummary,
    MediaImage,
    ContactInfo,
    GeoLocation,
    MenuItem,
    StaffSummary,
    AvailabilityCalendar,
)
from .review import ReviewSummary, DiarySnippet


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
