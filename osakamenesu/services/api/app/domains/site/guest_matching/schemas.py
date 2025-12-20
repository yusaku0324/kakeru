"""Request/Response schemas for guest matching API."""

from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class GuestMatchingRequest(BaseModel):
    area: Optional[str] = Field(default=None, max_length=100)
    date: Optional[str] = None
    time_from: str | None = None
    time_to: str | None = None
    budget_level: str | None = Field(default=None, pattern="^(low|mid|high)?$")
    mood_pref: dict[str, float] | None = None
    talk_pref: dict[str, float] | None = None
    style_pref: dict[str, float] | None = None
    look_pref: dict[str, float] | None = None
    free_text: str | None = Field(default=None, max_length=500)
    guest_token: str | None = None
    # v2 scoring options (optional)
    mood_tags: list[str] | None = None
    style_tags: list[str] | None = None
    look_types: list[str] | None = None
    contact_styles: list[str] | None = None
    hobby_tags: list[str] | None = None
    price_rank_min: int | None = Field(default=None, ge=1, le=5)
    price_rank_max: int | None = Field(default=None, ge=1, le=5)
    age_min: int | None = Field(default=None, ge=18, le=99)
    age_max: int | None = Field(default=None, ge=18, le=99)
    base_staff_id: str | None = None
    sort: str | None = None
    limit: int | None = Field(default=None, ge=1, le=100)
    offset: int | None = Field(default=None, ge=0)
    phase: str | None = None
    step_index: int | None = Field(default=None, ge=1)
    entry_source: str | None = None

    @field_validator("phase")
    @classmethod
    def _normalize_phase(cls, value: str | None) -> str | None:
        if not value:
            return None
        v = value.lower()
        return v if v in {"explore", "narrow", "book"} else None


class MatchingBreakdown(BaseModel):
    base_staff_similarity: float
    tag_similarity: float
    price_match: float
    age_match: float
    photo_similarity: float
    availability_boost: float


class MatchingCandidate(BaseModel):
    id: str
    therapist_id: str
    therapist_name: str
    shop_id: str
    shop_name: str
    score: float
    breakdown: MatchingBreakdown
    summary: str | None = None
    slots: list[dict[str, Any]] = Field(default_factory=list)
    mood_tag: str | None = None
    style_tag: str | None = None
    look_type: str | None = None
    talk_level: str | None = None
    contact_style: str | None = None
    hobby_tags: list[str] | None = None
    price_rank: int | None = None
    age: int | None = None
    photo_url: str | None = None
    score: float | None = None
    photo_similarity: float | None = None
    is_available: bool | None = None
    availability: dict[str, Any] | None = None


class MatchingResponse(BaseModel):
    items: list[MatchingCandidate]
    total: int


class SimilarTherapistItem(BaseModel):
    """Response item for /similar. All scores are normalized to 0..1.

    photo_similarity is a placeholder that will later be replaced with an embedding
    similarity score; v1 mirrors tag_similarity.
    """

    id: str
    name: str
    age: int | None = None
    price_rank: int | None = None
    mood_tag: str | None = None
    style_tag: str | None = None
    look_type: str | None = None
    contact_style: str | None = None
    hobby_tags: list[str] = Field(default_factory=list)
    photo_url: str | None = None
    is_available_now: bool = True
    score: float
    photo_similarity: float
    tag_similarity: float


class SimilarResponse(BaseModel):
    base_staff_id: str
    items: list[SimilarTherapistItem]
