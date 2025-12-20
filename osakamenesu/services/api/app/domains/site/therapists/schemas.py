"""Pydantic schemas for therapist detail API."""

from pydantic import BaseModel


class TherapistTags(BaseModel):
    mood: str | None = None
    style: str | None = None
    look: str | None = None
    contact: str | None = None
    hobby_tags: list[str] | None = None


class TherapistInfo(BaseModel):
    id: str
    name: str
    age: int | None = None
    price_rank: int | None = None
    tags: TherapistTags | None = None
    profile_text: str | None = None
    photos: list[str] | None = None
    badges: list[str] | None = None


class ShopInfo(BaseModel):
    id: str
    slug: str | None = None
    name: str
    area: str


class AvailabilitySlotInfo(BaseModel):
    starts_at: str
    ends_at: str
    is_available: bool
    rejected_reasons: list[str] | None = None


class AvailabilityWindow(BaseModel):
    days: int
    slot_granularity_minutes: int


class AvailabilityInfo(BaseModel):
    slots: list[AvailabilitySlotInfo]
    phase: str = "explore"
    window: AvailabilityWindow


class BreakdownInfo(BaseModel):
    base_staff_similarity: float | None = None
    tag_similarity: float | None = None
    price_match: float | None = None
    age_match: float | None = None
    photo_similarity: float | None = None
    availability_boost: float | None = None
    score: float | None = None


class TherapistDetailResponse(BaseModel):
    therapist: TherapistInfo
    shop: ShopInfo
    availability: AvailabilityInfo
    recommended_score: float | None = None
    breakdown: BreakdownInfo | None = None
    entry_source: str


class SimilarTherapistTags(BaseModel):
    """Tags for similar therapist display."""

    mood: str | None = None
    style: str | None = None


class SimilarTherapistItem(BaseModel):
    """Similar therapist item for frontend display."""

    id: str
    name: str
    photos: list[str] | None = None
    tags: SimilarTherapistTags | None = None
    price_rank: int | None = None
    similarity_score: float
    available_today: bool


class SimilarTherapistsResponse(BaseModel):
    """Response for similar therapists endpoint."""

    therapists: list[SimilarTherapistItem]
