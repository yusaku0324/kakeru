"""Profile (Shop) search and summary schemas."""

from .base import BaseModel, Field, List, Dict, Literal, Optional, Any, UUID, datetime


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
    outlinks: List[Dict[str, str]] = Field(default_factory=list)


class ProfileMarketingUpdate(BaseModel):
    discounts: Optional[List[DiscountIn]] = None
    ranking_badges: Optional[List[str]] = None
    ranking_weight: Optional[int] = None


class FacetValue(BaseModel):
    value: str
    label: Optional[str] = None
    count: int
    selected: Optional[bool] = None
