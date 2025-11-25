from __future__ import annotations

"""Guest-facing matching helpers (similar therapists API)."""

from typing import Any, Sequence

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...models import Therapist, Profile

router = APIRouter(prefix="/api/guest/matching", tags=["guest-matching"])


# ---- Schemas ----


class SimilarBreakdown(BaseModel):
    mood: float
    talk: float
    style: float
    look: float
    contact: float
    hobby: float


class SimilarCandidate(BaseModel):
    therapist_id: str
    therapist_name: str
    profile_id: str
    profile_name: str
    score: float
    breakdown: SimilarBreakdown


class SimilarResponse(BaseModel):
    base_therapist: dict[str, Any]
    similar: list[SimilarCandidate]


# ---- Helpers ----


def _normalize(value: float | None) -> float:
    if value is None:
        return 0.5
    return max(0.0, min(1.0, value))


def _match_score(target_val: str | None, candidate_val: str | None) -> float:
    if not target_val or not candidate_val:
        return 0.5
    return 1.0 if target_val == candidate_val else 0.3


def _list_overlap(
    target: Sequence[str] | None, candidate: Sequence[str] | None
) -> float:
    if not target or not candidate:
        return 0.5
    overlap = len(set(target) & set(candidate))
    if overlap == 0:
        return 0.3
    ratio = overlap / max(len(target), 1)
    return _normalize(ratio)


def _score_similarity(
    target: dict[str, Any], candidate: dict[str, Any]
) -> dict[str, Any]:
    breakdown = {
        "mood": _match_score(target.get("mood_tag"), candidate.get("mood_tag")),
        "talk": _match_score(target.get("talk_level"), candidate.get("talk_level")),
        "style": _match_score(target.get("style_tag"), candidate.get("style_tag")),
        "look": _match_score(target.get("look_type"), candidate.get("look_type")),
        "contact": _match_score(
            target.get("contact_style"), candidate.get("contact_style")
        ),
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

    return {"score": score, "breakdown": breakdown}


async def _get_therapist(db: AsyncSession, therapist_id: str) -> dict[str, Any]:
    res = await db.execute(
        select(Therapist, Profile)
        .join(Profile, Therapist.profile_id == Profile.id)
        .where(Therapist.id == therapist_id)
    )
    row = res.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="therapist not found"
        )

    therapist, profile = row
    return {
        "therapist_id": str(therapist.id),
        "therapist_name": therapist.name,
        "profile_id": str(profile.id),
        "profile_name": profile.name,
        "mood_tag": getattr(therapist, "mood_tag", None),
        "talk_level": getattr(therapist, "talk_level", None),
        "style_tag": getattr(therapist, "style_tag", None),
        "look_type": getattr(therapist, "look_type", None),
        "contact_style": getattr(therapist, "contact_style", None),
        "hobby_tags": getattr(therapist, "hobby_tags", None),
    }


async def _fetch_pool(
    db: AsyncSession, exclude_id: str, limit: int
) -> list[dict[str, Any]]:
    res = await db.execute(
        select(Therapist, Profile)
        .join(Profile, Therapist.profile_id == Profile.id)
        .where(Therapist.id != exclude_id)
        .order_by(Therapist.display_order)
        .limit(limit * 3)
    )
    rows = res.all()
    candidates: list[dict[str, Any]] = []
    for therapist, profile in rows:
        candidates.append(
            {
                "therapist_id": str(therapist.id),
                "therapist_name": therapist.name,
                "profile_id": str(profile.id),
                "profile_name": profile.name,
                "mood_tag": getattr(therapist, "mood_tag", None),
                "talk_level": getattr(therapist, "talk_level", None),
                "style_tag": getattr(therapist, "style_tag", None),
                "look_type": getattr(therapist, "look_type", None),
                "contact_style": getattr(therapist, "contact_style", None),
                "hobby_tags": getattr(therapist, "hobby_tags", None),
            }
        )
    return candidates


# ---- Endpoint ----


@router.get("/similar", response_model=SimilarResponse)
async def similar_therapists(
    therapist_id: str = Query(..., description="Target therapist id"),
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_session),
) -> SimilarResponse:
    """Return therapists similar to the given therapist_id.

    Uses a simple tag-based similarity score aligned with the guest matching weights.
    """

    base = await _get_therapist(db, therapist_id)
    pool = await _fetch_pool(db, therapist_id, limit)

    scored: list[SimilarCandidate] = []
    for candidate in pool:
        sim = _score_similarity(base, candidate)
        scored.append(
            SimilarCandidate(
                therapist_id=candidate["therapist_id"],
                therapist_name=candidate["therapist_name"],
                profile_id=candidate["profile_id"],
                profile_name=candidate["profile_name"],
                score=sim["score"],
                breakdown=SimilarBreakdown(**sim["breakdown"]),
            )
        )

    scored_sorted = sorted(scored, key=lambda x: x.score, reverse=True)
    return SimilarResponse(base_therapist=base, similar=scored_sorted[:limit])
