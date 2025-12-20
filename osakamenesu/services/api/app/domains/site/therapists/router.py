"""API router for therapist detail endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....db import get_session
from .schemas import (
    TherapistTags,
    TherapistInfo,
    ShopInfo,
    AvailabilityInfo,
    AvailabilityWindow,
    TherapistDetailResponse,
    SimilarTherapistTags,
    SimilarTherapistItem,
    SimilarTherapistsResponse,
)
from .sample_data import get_sample_therapist_response, get_sample_similar_therapists
from .scoring import compute_price_rank, compute_recommended_score
from .similar import extract_tags, score_similarity

# Import parent package for testability (allows monkeypatching via domain.*)
from .. import therapists as _pkg


router = APIRouter(prefix="/api/v1/therapists", tags=["therapists"])


@router.get(
    "/{therapist_id}",
    response_model=TherapistDetailResponse,
    status_code=status.HTTP_200_OK,
)
async def get_therapist_detail(
    therapist_id: UUID,
    shop_slug: str | None = Query(
        default=None, description="Shop slug to verify affiliation"
    ),
    entry_source: str = Query(
        default="direct", description="Entry source for tracking"
    ),
    days: int = Query(
        default=7, ge=1, le=30, description="Number of days for availability"
    ),
    slot_granularity_minutes: int = Query(
        default=30, ge=15, le=120, description="Slot granularity in minutes"
    ),
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
    sample_response = get_sample_therapist_response(
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
        result = await _pkg._fetch_therapist_by_shop_slug(db, therapist_id, shop_slug)
        if not result:
            # Check if therapist exists at all
            basic_result = await _pkg._fetch_therapist_with_profile(db, therapist_id)
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
        result = await _pkg._fetch_therapist_with_profile(db, therapist_id)
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

    # Build therapist info - extract tags from therapist/profile
    extracted = extract_tags(therapist, profile)
    tags = TherapistTags(
        mood=extracted.get("mood_tag"),
        style=extracted.get("style_tag"),
        look=extracted.get("look_type"),
        contact=extracted.get("contact_style"),
        hobby_tags=extracted.get("hobby_tags"),
    )

    therapist_info = TherapistInfo(
        id=str(therapist.id),
        name=therapist.name,
        age=profile.age,
        price_rank=compute_price_rank(profile.price_min, profile.price_max),
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
    slots = await _pkg._build_availability_slots(
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
    recommended_score, breakdown = compute_recommended_score(
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


@router.get(
    "/{therapist_id}/similar",
    response_model=SimilarTherapistsResponse,
    status_code=status.HTTP_200_OK,
)
async def get_similar_therapists(
    therapist_id: UUID,
    limit: int = Query(
        default=6, ge=1, le=20, description="Number of similar therapists to return"
    ),
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
    sample_items = get_sample_similar_therapists(therapist_id_str, limit)
    if sample_items is not None:
        return SimilarTherapistsResponse(therapists=sample_items)

    # Get base therapist from database
    base = await _pkg._get_base_therapist(db, therapist_id)

    # Fetch candidate pool
    pool = await _pkg._fetch_similar_pool(db, therapist_id, limit)

    # Score and sort candidates
    scored_candidates: list[tuple[dict, float]] = []
    for candidate in pool:
        score = score_similarity(base, candidate)
        scored_candidates.append((candidate, score))

    scored_candidates.sort(key=lambda x: x[1], reverse=True)

    # Build response with availability check
    therapists: list[SimilarTherapistItem] = []
    for candidate, score in scored_candidates[:limit]:
        candidate_id = UUID(candidate["therapist_id"])
        available_today = await _pkg._check_today_availability(db, candidate_id)

        therapists.append(
            SimilarTherapistItem(
                id=candidate["therapist_id"],
                name=candidate["therapist_name"],
                photos=candidate.get("photo_urls"),
                tags=SimilarTherapistTags(
                    mood=candidate.get("mood_tag"),
                    style=candidate.get("style_tag"),
                ),
                price_rank=compute_price_rank(
                    candidate.get("price_min"),
                    candidate.get("price_max"),
                ),
                similarity_score=score,
                available_today=available_today,
            )
        )

    return SimilarTherapistsResponse(therapists=therapists)
