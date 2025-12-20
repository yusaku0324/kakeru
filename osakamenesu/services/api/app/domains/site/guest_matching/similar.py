"""Similar therapists functionality."""

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models
from .scoring import jaccard, score_photo_similarity, is_available_candidate


SIMILAR_DEFAULT_LIMIT = 8
SIMILAR_MAX_LIMIT = 20
SIMILAR_DEFAULT_MIN_SCORE = 0.4


def compute_tag_similarity(base: dict[str, Any], candidate: dict[str, Any]) -> float:
    weights = {
        "mood_tag": 0.30,
        "style_tag": 0.25,
        "look_type": 0.25,
        "contact_style": 0.10,
    }
    hobby_weight = 0.10

    def _single_score(key: str) -> float:
        base_val = base.get(key)
        cand_val = candidate.get(key)
        if base_val is None or cand_val is None:
            return 0.0
        return 1.0 if base_val == cand_val else 0.0

    tag_score = 0.0
    for key, weight in weights.items():
        tag_score += weight * _single_score(key)

    hobby_score = jaccard(
        base.get("hobby_tags") or [], candidate.get("hobby_tags") or []
    )
    tag_score += hobby_weight * hobby_score
    return max(0.0, min(1.0, tag_score))


def compute_price_score(base_rank: int | None, candidate_rank: int | None) -> float:
    if base_rank is None or candidate_rank is None:
        return 0.5
    diff = abs(base_rank - candidate_rank)
    return max(0.0, 1.0 - diff * 0.4)


def compute_age_score(base_age: int | None, candidate_age: int | None) -> float:
    if base_age is None or candidate_age is None:
        return 0.5
    diff = abs(base_age - candidate_age)
    return max(0.0, 1.0 - diff / 15.0)


def compute_similar_scores(
    base: dict[str, Any], candidate: dict[str, Any]
) -> dict[str, float]:
    """Compute tag/price/age/photo similarity and final score (0..1)."""
    tag_similarity = compute_tag_similarity(base, candidate)
    price_score = compute_price_score(
        base.get("price_rank"), candidate.get("price_rank")
    )
    age_score = compute_age_score(base.get("age"), candidate.get("age"))
    photo_similarity = score_photo_similarity(base, candidate)

    final_score = (
        0.6 * photo_similarity
        + 0.2 * tag_similarity
        + 0.1 * price_score
        + 0.1 * age_score
    )
    final_score = max(0.0, min(1.0, final_score))
    return {
        "score": final_score,
        "tag_similarity": tag_similarity,
        "photo_similarity": photo_similarity,
        "price_score": price_score,
        "age_score": age_score,
    }


async def get_base_staff(db: AsyncSession | None, staff_id: str) -> dict[str, Any]:
    """Fetch the base therapist; raise 404 if missing."""
    if not db or not hasattr(db, "execute"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="staff not found"
        )

    res = await db.execute(
        select(models.Therapist, models.Profile)
        .join(models.Profile, models.Therapist.profile_id == models.Profile.id)
        .where(
            models.Therapist.id == staff_id,
            models.Therapist.status == "published",
            models.Profile.status == "published",
        )
    )
    row = res.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="staff not found"
        )

    therapist, profile = row
    hobby_tags = (
        getattr(therapist, "specialties", None)
        or getattr(profile, "body_tags", None)
        or []
    )
    photo_url = None
    photos = getattr(profile, "photos", None) or getattr(therapist, "photo_urls", None)
    if photos:
        photo_url = photos[0]
    photo_embedding = getattr(therapist, "photo_embedding", None)
    return {
        "id": str(therapist.id),
        "name": therapist.name,
        "shop_id": str(getattr(therapist, "profile_id", "")),
        "age": getattr(profile, "age", None),
        "price_rank": getattr(profile, "ranking_weight", None),
        "mood_tag": getattr(therapist, "mood_tag", None),
        "style_tag": getattr(therapist, "style_tag", None),
        "look_type": getattr(therapist, "look_type", None),
        "contact_style": getattr(therapist, "contact_style", None),
        "hobby_tags": hobby_tags or [],
        "photo_url": photo_url,
        "photo_embedding": photo_embedding,
        "is_available_now": bool(getattr(therapist, "is_booking_enabled", True)),
    }


async def fetch_similar_candidates(
    db: AsyncSession | None,
    base: dict[str, Any],
    shop_id: str | None,
    exclude_unavailable: bool,
    limit: int,
) -> list[dict[str, Any]]:
    """Fetch candidate therapists (published) from DB, optionally scoped to a shop."""
    if not db:
        return []

    stmt = (
        select(models.Therapist, models.Profile)
        .join(models.Profile, models.Therapist.profile_id == models.Profile.id)
        .where(
            models.Therapist.status == "published",
            models.Profile.status == "published",
            models.Therapist.id != base.get("id"),
        )
    )
    if shop_id:
        stmt = stmt.where(models.Therapist.profile_id == shop_id)

    res = await db.execute(stmt.limit(limit * 5))
    candidates: list[dict[str, Any]] = []
    for therapist, profile in res.all():
        cand = {
            "id": str(therapist.id),
            "name": therapist.name,
            "shop_id": str(getattr(therapist, "profile_id", "")),
            "age": getattr(profile, "age", None),
            "price_rank": getattr(profile, "ranking_weight", None),
            "mood_tag": getattr(therapist, "mood_tag", None),
            "style_tag": getattr(therapist, "style_tag", None),
            "look_type": getattr(therapist, "look_type", None),
            "contact_style": getattr(therapist, "contact_style", None),
            "hobby_tags": getattr(therapist, "specialties", None)
            or getattr(profile, "body_tags", None)
            or [],
            "photo_url": (getattr(profile, "photos", None) or [None])[0],
            "photo_embedding": getattr(therapist, "photo_embedding", None),
            "is_available_now": bool(getattr(therapist, "is_booking_enabled", True)),
        }
        if exclude_unavailable and not is_available_candidate(cand):
            continue
        candidates.append(cand)
    return candidates
