"""Review and diary schemas."""

from typing import Literal

from .base import (
    Any,
    BaseModel,
    Dict,
    Field,
    List,
    Optional,
    UUID,
    conint,
    constr,
    date,
    datetime,
)


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
    status: Literal["pending", "published", "rejected"]
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
    status: Literal["pending", "published", "rejected"]


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
