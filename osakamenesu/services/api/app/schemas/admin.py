"""Admin schemas."""

from .base import (
    BaseModel,
    Field,
    List,
    Dict,
    Optional,
    Any,
    UUID,
    datetime,
    date,
    conint,
)
from .shop import (
    MenuItem,
    StaffSummary,
    AvailabilityDay,
    AvailabilitySlotIn,
    ShopContactUpdate,
    BulkMenuInput,
)

# Import centralized enum Literals from enums.py
from ..enums import (
    ReviewStatusLiteral,
    DiaryStatusLiteral,
)


class BulkReviewInput(BaseModel):
    external_id: Optional[str] = None
    score: conint(ge=1, le=5)  # type: ignore[valid-type]
    title: Optional[str] = None
    body: str
    author_alias: Optional[str] = None
    visited_at: Optional[date] = None
    status: ReviewStatusLiteral = "published"
    aspects: Optional[Dict[str, Any]] = None


class BulkDiaryInput(BaseModel):
    external_id: Optional[str] = None
    title: str
    body: str
    photos: List[str] = Field(default_factory=list)
    hashtags: List[str] = Field(default_factory=list)
    status: DiaryStatusLiteral = "published"
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
