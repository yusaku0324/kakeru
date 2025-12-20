"""Similar therapists matching logic."""

from typing import Any, Sequence
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ....models import Profile, Therapist, TherapistShift
from ....utils.datetime import now_jst


def normalize(value: float | None) -> float:
    """Normalize value to [0.0, 1.0] range."""
    if value is None:
        return 0.5
    return max(0.0, min(1.0, value))


def match_score(target_val: str | None, candidate_val: str | None) -> float:
    """Compute match score between two tag values."""
    if not target_val or not candidate_val:
        return 0.5
    return 1.0 if target_val == candidate_val else 0.3


def list_overlap(
    target: Sequence[str] | None, candidate: Sequence[str] | None
) -> float:
    """Compute overlap score between two lists."""
    if not target or not candidate:
        return 0.5
    overlap = len(set(target) & set(candidate))
    if overlap == 0:
        return 0.3
    ratio = overlap / max(len(target), 1)
    return normalize(ratio)


def extract_tags(therapist: Any, profile: Any) -> dict[str, Any]:
    """Extract tag signals from therapist/profile."""
    hobby_fallback: Sequence[str] | None = None
    if getattr(therapist, "specialties", None):
        hobby_fallback = therapist.specialties
    elif getattr(profile, "body_tags", None):
        hobby_fallback = profile.body_tags

    return {
        "mood_tag": getattr(therapist, "mood_tag", None)
        or getattr(profile, "mood_tag", None),
        "talk_level": getattr(therapist, "talk_level", None)
        or getattr(profile, "talk_level", None),
        "style_tag": getattr(therapist, "style_tag", None)
        or getattr(profile, "style_tag", None),
        "look_type": getattr(therapist, "look_type", None)
        or getattr(profile, "look_type", None),
        "contact_style": getattr(therapist, "contact_style", None)
        or getattr(profile, "contact_style", None),
        "hobby_tags": getattr(therapist, "hobby_tags", None)
        or getattr(profile, "hobby_tags", None)
        or hobby_fallback,
    }


def score_similarity(target: dict[str, Any], candidate: dict[str, Any]) -> float:
    """Compute similarity score between target and candidate therapist tags."""
    breakdown = {
        "mood": match_score(target.get("mood_tag"), candidate.get("mood_tag")),
        "talk": match_score(target.get("talk_level"), candidate.get("talk_level")),
        "style": match_score(target.get("style_tag"), candidate.get("style_tag")),
        "look": match_score(target.get("look_type"), candidate.get("look_type")),
        "contact": match_score(
            target.get("contact_style"), candidate.get("contact_style")
        ),
        "hobby": list_overlap(target.get("hobby_tags"), candidate.get("hobby_tags")),
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


async def get_base_therapist(db: AsyncSession, therapist_id: UUID) -> dict[str, Any]:
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
            detail={
                "message": "Therapist not found",
                "reason_code": "therapist_not_found",
            },
        )

    therapist, profile = row
    tags = extract_tags(therapist, profile)
    return {
        "therapist_id": str(therapist.id),
        "therapist_name": therapist.name,
        "photo_urls": therapist.photo_urls,
        "price_min": profile.price_min,
        "price_max": profile.price_max,
        **tags,
    }


async def fetch_similar_pool(
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
        tags = extract_tags(therapist, profile)
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


async def check_today_availability(db: AsyncSession, therapist_id: UUID) -> bool:
    """Check if therapist has availability today."""
    now = now_jst()
    today = now.date()

    stmt = select(TherapistShift).where(
        TherapistShift.therapist_id == therapist_id,
        TherapistShift.date == today,
        TherapistShift.end_time > now.time(),
    )
    result = await db.execute(stmt)
    return result.first() is not None
