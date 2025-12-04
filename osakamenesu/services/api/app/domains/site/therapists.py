"""Therapist detail API for guest-facing pages."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ...db import get_session
from ...models import Profile, Therapist, TherapistShift
from .therapist_availability import list_daily_slots

logger = logging.getLogger(__name__)

# Sample therapist data for demo/development
SAMPLE_THERAPISTS: dict[str, dict] = {
    "11111111-1111-1111-8888-111111111111": {
        "name": "葵",
        "age": 26,
        "price_min": 11000,
        "price_max": 15000,
        "profile_text": "丁寧なオイルトリートメントで人気のセラピストです。お客様一人ひとりに合わせた施術を心がけています。",
        "photos": ["/images/demo-therapist-1.svg"],
        "specialties": ["リンパ", "ホットストーン", "指名多数"],
        "shop_slug": "sample-namba-resort",
        "shop_name": "アロマリゾート 難波本店",
        "shop_area": "難波/日本橋",
    },
    "22222222-2222-2222-8888-222222222222": {
        "name": "凛",
        "age": 24,
        "price_min": 10000,
        "price_max": 14000,
        "profile_text": "ストレッチと指圧を組み合わせた独自施術が評判です。疲れた身体を芯からほぐします。",
        "photos": ["/images/demo-therapist-2.svg"],
        "specialties": ["ストレッチ", "指圧", "ディープリンパ"],
        "shop_slug": "sample-namba-resort",
        "shop_name": "アロマリゾート 難波本店",
        "shop_area": "難波/日本橋",
    },
}


router = APIRouter(prefix="/api/v1/therapists", tags=["therapists"])


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


# ---- Similar Therapists Schemas ----


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


def _compute_price_rank(min_price: int | None, max_price: int | None) -> int | None:
    """Compute price rank from min/max price (1=cheap, 5=expensive)."""
    if min_price is None or max_price is None:
        return None
    avg = (min_price + max_price) / 2
    if avg < 5000:
        return 1
    elif avg < 10000:
        return 2
    elif avg < 15000:
        return 3
    elif avg < 20000:
        return 4
    else:
        return 5


def _get_sample_therapist_response(
    therapist_id: str,
    shop_slug: str | None,
    entry_source: str,
    days: int,
    slot_granularity_minutes: int,
) -> TherapistDetailResponse | None:
    """Return sample therapist data if ID matches known samples."""
    sample = SAMPLE_THERAPISTS.get(therapist_id)
    if not sample:
        return None

    # Verify shop_slug if provided
    if shop_slug and sample["shop_slug"] != shop_slug:
        return None

    tags = TherapistTags(
        mood="癒し系",
        style="ソフト",
        look=None,
        contact=None,
        hobby_tags=sample.get("specialties"),
    )

    therapist_info = TherapistInfo(
        id=therapist_id,
        name=sample["name"],
        age=sample.get("age"),
        price_rank=_compute_price_rank(sample.get("price_min"), sample.get("price_max")),
        tags=tags,
        profile_text=sample.get("profile_text"),
        photos=sample.get("photos"),
        badges=["人気"],
    )

    shop_info = ShopInfo(
        id="sample-shop-id",
        slug=sample["shop_slug"],
        name=sample["shop_name"],
        area=sample["shop_area"],
    )

    # Empty availability for sample
    availability = AvailabilityInfo(
        slots=[],
        phase="explore",
        window=AvailabilityWindow(
            days=days,
            slot_granularity_minutes=slot_granularity_minutes,
        ),
    )

    # Simple sample scores
    breakdown = BreakdownInfo(
        base_staff_similarity=0.8,
        tag_similarity=0.7,
        price_match=0.6,
        age_match=0.75,
        availability_boost=0.0,
        score=0.72,
    )

    return TherapistDetailResponse(
        therapist=therapist_info,
        shop=shop_info,
        availability=availability,
        recommended_score=0.72,
        breakdown=breakdown,
        entry_source=entry_source,
    )


def _compute_recommended_score(
    therapist: Therapist,
    profile: Profile,
    entry_source: str,
    has_availability: bool,
) -> tuple[float, BreakdownInfo]:
    """Compute recommended score based on entry source and profile attributes.

    Entry source weighting:
    - shop_page: Higher weight on shop affinity (ranking badges, display order)
    - search: Higher weight on visibility metrics
    - direct: Balanced approach

    Returns (score, breakdown) tuple.
    """
    # Base score from therapist display order (lower is better, normalize to 0-1)
    display_order = getattr(therapist, "display_order", 99) or 99
    base_staff_similarity = max(0.0, 1.0 - (display_order / 100.0))

    # Tag similarity from profile body_tags and therapist specialties
    profile_tags = set(profile.body_tags or [])
    therapist_tags = set(therapist.specialties or [])
    if profile_tags and therapist_tags:
        tag_overlap = len(profile_tags & therapist_tags)
        tag_union = len(profile_tags | therapist_tags)
        tag_similarity = tag_overlap / tag_union if tag_union > 0 else 0.5
    else:
        tag_similarity = 0.5

    # Price match (higher price ranges get slight boost for premium positioning)
    price_min = profile.price_min or 0
    price_max = profile.price_max or 0
    avg_price = (price_min + price_max) / 2 if price_max > 0 else 10000
    price_match = min(1.0, avg_price / 30000.0)  # Normalize to 0-1 (30k as max)

    # Age match (prime age range gets boost)
    age = profile.age
    if age and 20 <= age <= 35:
        age_match = 0.8 + (0.2 * (1.0 - abs(age - 27) / 15.0))
    elif age:
        age_match = 0.5
    else:
        age_match = 0.6  # Default when age unknown

    # Availability boost
    availability_boost = 0.15 if has_availability else 0.0

    # Entry source weighting
    if entry_source == "shop_page":
        # Shop page: prioritize shop-specific metrics
        weights = {
            "base_staff_similarity": 0.35,
            "tag_similarity": 0.25,
            "price_match": 0.15,
            "age_match": 0.10,
            "availability_boost": 0.15,
        }
    elif entry_source == "search":
        # Search: prioritize visibility and match
        weights = {
            "base_staff_similarity": 0.20,
            "tag_similarity": 0.30,
            "price_match": 0.20,
            "age_match": 0.15,
            "availability_boost": 0.15,
        }
    else:  # direct
        # Direct: balanced approach
        weights = {
            "base_staff_similarity": 0.25,
            "tag_similarity": 0.25,
            "price_match": 0.20,
            "age_match": 0.15,
            "availability_boost": 0.15,
        }

    # Calculate weighted score
    score = (
        weights["base_staff_similarity"] * base_staff_similarity
        + weights["tag_similarity"] * tag_similarity
        + weights["price_match"] * price_match
        + weights["age_match"] * age_match
        + weights["availability_boost"] * (1.0 if has_availability else 0.0)
    )

    # Ranking badge boost
    badges = profile.ranking_badges or []
    if "top_rated" in badges:
        score += 0.1
    if "new_arrival" in badges:
        score += 0.05

    # Normalize to 0-1 range
    score = max(0.0, min(1.0, score))

    breakdown = BreakdownInfo(
        base_staff_similarity=round(base_staff_similarity, 3),
        tag_similarity=round(tag_similarity, 3),
        price_match=round(price_match, 3),
        age_match=round(age_match, 3),
        availability_boost=round(availability_boost, 3),
        score=round(score, 3),
    )

    return score, breakdown


async def _fetch_therapist_with_profile(
    db: AsyncSession,
    therapist_id: UUID,
) -> tuple[Therapist, Profile] | None:
    """Fetch therapist with joined profile."""
    stmt = (
        select(Therapist)
        .options(joinedload(Therapist.profile))
        .where(Therapist.id == therapist_id)
    )
    result = await db.execute(stmt)
    therapist = result.scalar_one_or_none()
    if not therapist or not therapist.profile:
        return None
    return therapist, therapist.profile


async def _fetch_therapist_by_shop_slug(
    db: AsyncSession,
    therapist_id: UUID,
    shop_slug: str,
) -> tuple[Therapist, Profile] | None:
    """Fetch therapist with profile, verifying shop_slug matches."""
    stmt = (
        select(Therapist)
        .options(joinedload(Therapist.profile))
        .where(Therapist.id == therapist_id)
    )
    result = await db.execute(stmt)
    therapist = result.scalar_one_or_none()

    if not therapist or not therapist.profile:
        return None

    # Check if shop slug matches
    if therapist.profile.slug != shop_slug:
        return None

    return therapist, therapist.profile


async def _build_availability_slots(
    db: AsyncSession,
    therapist_id: UUID,
    days: int,
    slot_granularity_minutes: int,
) -> list[AvailabilitySlotInfo]:
    """Build availability slots for the specified number of days."""
    slots: list[AvailabilitySlotInfo] = []
    today = date.today()

    for day_offset in range(days):
        target_date = today + timedelta(days=day_offset)
        available_slots = await list_daily_slots(db, therapist_id, target_date)

        for slot_start, slot_end in available_slots:
            slots.append(
                AvailabilitySlotInfo(
                    starts_at=slot_start.isoformat(),
                    ends_at=slot_end.isoformat(),
                    is_available=True,
                    rejected_reasons=None,
                )
            )

    return slots


@router.get(
    "/{therapist_id}",
    response_model=TherapistDetailResponse,
    status_code=status.HTTP_200_OK,
)
async def get_therapist_detail(
    therapist_id: UUID,
    shop_slug: str | None = Query(default=None, description="Shop slug to verify affiliation"),
    entry_source: str = Query(default="direct", description="Entry source for tracking"),
    days: int = Query(default=7, ge=1, le=30, description="Number of days for availability"),
    slot_granularity_minutes: int = Query(default=30, ge=15, le=120, description="Slot granularity in minutes"),
    db: AsyncSession = Depends(get_session),
):
    """Get therapist detail with shop info and availability.

    Query Parameters:
        - shop_slug: Optional. Verify therapist belongs to this shop.
        - entry_source: Track where user came from (shop_page, search, direct).
        - days: Number of days to fetch availability (default 7).
        - slot_granularity_minutes: Granularity of slots (default 30).

    Error Codes:
        - therapist_not_found: Therapist ID does not exist.
        - shop_slug_mismatch: Therapist does not belong to specified shop.
    """
    # Try sample data first (for demo/development)
    sample_response = _get_sample_therapist_response(
        str(therapist_id),
        shop_slug,
        entry_source,
        days,
        slot_granularity_minutes,
    )
    if sample_response:
        return sample_response

    # Fetch therapist from database
    if shop_slug:
        result = await _fetch_therapist_by_shop_slug(db, therapist_id, shop_slug)
        if not result:
            # Check if therapist exists at all
            basic_result = await _fetch_therapist_with_profile(db, therapist_id)
            if not basic_result:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={
                        "message": "Therapist not found",
                        "reason_code": "therapist_not_found",
                    },
                )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "message": "Therapist does not belong to the specified shop",
                    "reason_code": "shop_slug_mismatch",
                },
            )
        therapist, profile = result
    else:
        result = await _fetch_therapist_with_profile(db, therapist_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "message": "Therapist not found",
                    "reason_code": "therapist_not_found",
                },
            )
        therapist, profile = result

    # Check if therapist is published
    if therapist.status != "published":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "Therapist not found",
                "reason_code": "therapist_not_found",
            },
        )

    # Build therapist info
    tags = TherapistTags(
        mood=None,  # Future: from therapist profile tags
        style=None,
        look=None,
        contact=None,
        hobby_tags=therapist.specialties,
    )

    therapist_info = TherapistInfo(
        id=str(therapist.id),
        name=therapist.name,
        age=profile.age,
        price_rank=_compute_price_rank(profile.price_min, profile.price_max),
        tags=tags,
        profile_text=therapist.biography,
        photos=therapist.photo_urls,
        badges=profile.ranking_badges,
    )

    # Build shop info
    shop_info = ShopInfo(
        id=str(profile.id),
        slug=profile.slug,
        name=profile.name,
        area=profile.area,
    )

    # Build availability
    slots = await _build_availability_slots(
        db,
        therapist_id,
        days,
        slot_granularity_minutes,
    )

    availability = AvailabilityInfo(
        slots=slots,
        phase="explore",
        window=AvailabilityWindow(
            days=days,
            slot_granularity_minutes=slot_granularity_minutes,
        ),
    )

    # Calculate recommended score based on entry_source context
    has_availability = len(slots) > 0
    recommended_score, breakdown = _compute_recommended_score(
        therapist, profile, entry_source, has_availability
    )

    return TherapistDetailResponse(
        therapist=therapist_info,
        shop=shop_info,
        availability=availability,
        recommended_score=recommended_score,
        breakdown=breakdown,
        entry_source=entry_source,
    )


# ---- Similar Therapists Helpers ----


def _normalize(value: float | None) -> float:
    """Normalize value to [0.0, 1.0] range."""
    if value is None:
        return 0.5
    return max(0.0, min(1.0, value))


def _match_score(target_val: str | None, candidate_val: str | None) -> float:
    """Compute match score between two tag values."""
    if not target_val or not candidate_val:
        return 0.5
    return 1.0 if target_val == candidate_val else 0.3


def _list_overlap(target: Sequence[str] | None, candidate: Sequence[str] | None) -> float:
    """Compute overlap score between two lists."""
    if not target or not candidate:
        return 0.5
    overlap = len(set(target) & set(candidate))
    if overlap == 0:
        return 0.3
    ratio = overlap / max(len(target), 1)
    return _normalize(ratio)


def _extract_tags(therapist: Any, profile: Any) -> dict[str, Any]:
    """Extract tag signals from therapist/profile."""
    hobby_fallback: Sequence[str] | None = None
    if getattr(therapist, "specialties", None):
        hobby_fallback = therapist.specialties
    elif getattr(profile, "body_tags", None):
        hobby_fallback = profile.body_tags

    return {
        "mood_tag": getattr(therapist, "mood_tag", None) or getattr(profile, "mood_tag", None),
        "talk_level": getattr(therapist, "talk_level", None) or getattr(profile, "talk_level", None),
        "style_tag": getattr(therapist, "style_tag", None) or getattr(profile, "style_tag", None),
        "look_type": getattr(therapist, "look_type", None) or getattr(profile, "look_type", None),
        "contact_style": getattr(therapist, "contact_style", None) or getattr(profile, "contact_style", None),
        "hobby_tags": getattr(therapist, "hobby_tags", None)
        or getattr(profile, "hobby_tags", None)
        or hobby_fallback,
    }


def _score_similarity(target: dict[str, Any], candidate: dict[str, Any]) -> float:
    """Compute similarity score between target and candidate therapist tags."""
    breakdown = {
        "mood": _match_score(target.get("mood_tag"), candidate.get("mood_tag")),
        "talk": _match_score(target.get("talk_level"), candidate.get("talk_level")),
        "style": _match_score(target.get("style_tag"), candidate.get("style_tag")),
        "look": _match_score(target.get("look_type"), candidate.get("look_type")),
        "contact": _match_score(target.get("contact_style"), candidate.get("contact_style")),
        "hobby": _list_overlap(target.get("hobby_tags"), candidate.get("hobby_tags")),
    }

    score = (
        0.25 * breakdown["mood"]
        + 0.2 * breakdown["talk"]
        + 0.2 * breakdown["style"]
        + 0.15 * breakdown["look"]
        + 0.1 * breakdown["contact"]
        + 0.1 * breakdown["hobby"]
    )

    return score


async def _get_base_therapist(db: AsyncSession, therapist_id: UUID) -> dict[str, Any]:
    """Fetch base therapist with tags for similarity comparison."""
    stmt = (
        select(Therapist, Profile)
        .join(Profile, Therapist.profile_id == Profile.id)
        .where(
            Therapist.id == therapist_id,
            Therapist.status == "published",
            Profile.status == "published",
        )
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Therapist not found", "reason_code": "therapist_not_found"},
        )

    therapist, profile = row
    tags = _extract_tags(therapist, profile)
    return {
        "therapist_id": str(therapist.id),
        "therapist_name": therapist.name,
        "photo_urls": therapist.photo_urls,
        "price_min": profile.price_min,
        "price_max": profile.price_max,
        **tags,
    }


async def _fetch_similar_pool(
    db: AsyncSession, exclude_id: UUID, limit: int
) -> list[dict[str, Any]]:
    """Fetch candidate therapists for similarity comparison."""
    stmt = (
        select(Therapist, Profile)
        .join(Profile, Therapist.profile_id == Profile.id)
        .where(
            Therapist.id != exclude_id,
            Therapist.status == "published",
            Profile.status == "published",
        )
        .order_by(Therapist.display_order)
        .limit(limit * 3)
    )
    result = await db.execute(stmt)
    rows = result.all()

    candidates: list[dict[str, Any]] = []
    for therapist, profile in rows:
        tags = _extract_tags(therapist, profile)
        candidates.append(
            {
                "therapist_id": str(therapist.id),
                "therapist_name": therapist.name,
                "photo_urls": therapist.photo_urls,
                "price_min": profile.price_min,
                "price_max": profile.price_max,
                **tags,
            }
        )
    return candidates


async def _check_today_availability(db: AsyncSession, therapist_id: UUID) -> bool:
    """Check if therapist has availability today."""
    today = date.today()
    now = datetime.now(timezone.utc)

    stmt = (
        select(TherapistShift)
        .where(
            TherapistShift.therapist_id == therapist_id,
            TherapistShift.date == today,
            TherapistShift.end_time > now.time(),
        )
    )
    result = await db.execute(stmt)
    return result.first() is not None


@router.get(
    "/{therapist_id}/similar",
    response_model=SimilarTherapistsResponse,
    status_code=status.HTTP_200_OK,
)
async def get_similar_therapists(
    therapist_id: UUID,
    limit: int = Query(default=6, ge=1, le=20, description="Number of similar therapists to return"),
    db: AsyncSession = Depends(get_session),
):
    """Get similar therapists based on tag similarity.

    Returns therapists similar to the given therapist, sorted by similarity score.
    Includes availability information for today.

    Query Parameters:
        - limit: Number of similar therapists to return (default 6, max 20).

    Error Codes:
        - therapist_not_found: Therapist ID does not exist or is not published.
    """
    # Check if this is a sample therapist - return other samples as similar
    therapist_id_str = str(therapist_id)
    if therapist_id_str in SAMPLE_THERAPISTS:
        similar_items: list[SimilarTherapistItem] = []
        for other_id, other_data in SAMPLE_THERAPISTS.items():
            if other_id != therapist_id_str:
                similar_items.append(
                    SimilarTherapistItem(
                        id=other_id,
                        name=other_data["name"],
                        photos=other_data.get("photos"),
                        tags=SimilarTherapistTags(
                            mood="癒し系",
                            style="ソフト",
                        ),
                        price_rank=_compute_price_rank(
                            other_data.get("price_min"),
                            other_data.get("price_max"),
                        ),
                        similarity_score=0.85,
                        available_today=True,
                    )
                )
        return SimilarTherapistsResponse(therapists=similar_items[:limit])

    # Get base therapist from database
    base = await _get_base_therapist(db, therapist_id)

    # Fetch candidate pool
    pool = await _fetch_similar_pool(db, therapist_id, limit)

    # Score and sort candidates
    scored_candidates: list[tuple[dict[str, Any], float]] = []
    for candidate in pool:
        score = _score_similarity(base, candidate)
        scored_candidates.append((candidate, score))

    scored_candidates.sort(key=lambda x: x[1], reverse=True)

    # Build response with availability check
    therapists: list[SimilarTherapistItem] = []
    for candidate, score in scored_candidates[:limit]:
        candidate_id = UUID(candidate["therapist_id"])
        available_today = await _check_today_availability(db, candidate_id)

        therapists.append(
            SimilarTherapistItem(
                id=candidate["therapist_id"],
                name=candidate["therapist_name"],
                photos=candidate.get("photo_urls"),
                tags=SimilarTherapistTags(
                    mood=candidate.get("mood_tag"),
                    style=candidate.get("style_tag"),
                ),
                price_rank=_compute_price_rank(
                    candidate.get("price_min"),
                    candidate.get("price_max"),
                ),
                similarity_score=score,
                available_today=available_today,
            )
        )

    return SimilarTherapistsResponse(therapists=therapists)
