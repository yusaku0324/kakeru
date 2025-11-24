from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

router = APIRouter(prefix="/api/guest/matching", tags=["guest-matching"])


class GuestMatchingRequest(BaseModel):
    area: str
    date: date
    time_from: str | None = None
    time_to: str | None = None
    budget_level: str | None = Field(default=None, pattern="^(low|mid|high)?$")
    mood_pref: dict[str, float] | None = None
    talk_pref: dict[str, float] | None = None
    style_pref: dict[str, float] | None = None
    look_pref: dict[str, float] | None = None
    free_text: str | None = None

    @field_validator("area")
    @classmethod
    def validate_area(cls, v: str) -> str:
        if not v:
            raise ValueError("area is required")
        return v


class MatchingBreakdown(BaseModel):
    core: float
    priceFit: float
    moodFit: float
    talkFit: float
    styleFit: float
    lookFit: float
    availability: float


class MatchingCandidate(BaseModel):
    therapist_id: str
    therapist_name: str
    shop_id: str
    shop_name: str
    score: float
    breakdown: MatchingBreakdown
    summary: str | None = None
    slots: list[dict[str, Any]] = Field(default_factory=list)


class MatchingResponse(BaseModel):
    top_matches: list[MatchingCandidate]
    other_candidates: list[MatchingCandidate]


def _normalize_score(value: float | None) -> float:
    if value is None:
        return 0.0
    return max(0.0, min(1.0, value))


def _compute_price_fit(budget_level: str | None, therapist_price: str | None) -> float:
    if not budget_level or not therapist_price:
        return 0.5
    order = ["low", "mid", "high"]
    price_map = {"value": "low", "standard": "mid", "premium": "high"}
    guest_idx = order.index(budget_level) if budget_level in order else -1
    therapist_idx = (
        order.index(price_map[therapist_price]) if therapist_price in price_map else -1
    )
    if guest_idx < 0 or therapist_idx < 0:
        return 0.5
    diff = abs(guest_idx - therapist_idx)
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.6
    return 0.3


def _compute_choice_fit(pref: dict[str, float] | None, tag: str | None) -> float:
    if not pref or not tag:
        return 0.5
    return _normalize_score(pref.get(tag))


def _score_candidate(payload: GuestMatchingRequest, candidate: dict[str, Any]) -> float:
    # Lightweight, rule-based scoring aligned with frontend computeMatchingScore.
    price_fit = _compute_price_fit(
        payload.budget_level, candidate.get("price_level", None)
    )
    mood_fit = _compute_choice_fit(payload.mood_pref, candidate.get("mood_tag"))
    talk_fit = _compute_choice_fit(payload.talk_pref, candidate.get("talk_level"))
    style_fit = _compute_choice_fit(payload.style_pref, candidate.get("style_tag"))
    look_fit = _compute_choice_fit(payload.look_pref, candidate.get("look_type"))
    core_score = 0.6  # placeholder: real core score should come from search rank
    availability_score = 0.8 if candidate.get("slots") else 0.3

    score = (
        0.4 * core_score
        + 0.15 * price_fit
        + 0.15 * mood_fit
        + 0.1 * talk_fit
        + 0.1 * style_fit
        + 0.05 * look_fit
        + 0.05 * availability_score
    )
    candidate["__breakdown"] = {
        "core": core_score,
        "priceFit": price_fit,
        "moodFit": mood_fit,
        "talkFit": talk_fit,
        "styleFit": style_fit,
        "lookFit": look_fit,
        "availability": availability_score,
    }
    return score


def _build_sample_candidates() -> list[dict[str, Any]]:
    return [
        {
            "therapist_id": "t-101",
            "therapist_name": "ナツキ",
            "shop_id": "s-01",
            "shop_name": "ゆったりスパ本店",
            "price_level": "standard",
            "mood_tag": "calm",
            "talk_level": "quiet",
            "style_tag": "relax",
            "look_type": "natural",
            "slots": [
                {
                    "start_at": "2025-11-04T13:00:00+09:00",
                    "end_at": "2025-11-04T14:00:00+09:00",
                }
            ],
        },
        {
            "therapist_id": "t-202",
            "therapist_name": "ミホ",
            "shop_id": "s-02",
            "shop_name": "アロマテラス心斎橋",
            "price_level": "premium",
            "mood_tag": "mature",
            "talk_level": "normal",
            "style_tag": "strong",
            "look_type": "beauty",
            "slots": [],
        },
        {
            "therapist_id": "t-303",
            "therapist_name": "ユイ",
            "shop_id": "s-03",
            "shop_name": "リラクセ梅田",
            "price_level": "value",
            "mood_tag": "friendly",
            "talk_level": "talkative",
            "style_tag": "relax",
            "look_type": "cute",
            "slots": [
                {
                    "start_at": "2025-11-04T18:00:00+09:00",
                    "end_at": "2025-11-04T19:00:00+09:00",
                }
            ],
        },
    ]


@router.post("/search", response_model=MatchingResponse)
async def guest_matching_search(payload: GuestMatchingRequest) -> MatchingResponse:
    """
    v1: lightweight matching endpoint.
    現状は簡易的なサンプル候補に対するルールベーススコアリングのみ。
    将来的に既存検索ロジックの結果をスコアリングする形に差し替える。
    """
    if not payload.area or not payload.date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="area and date are required",
        )

    candidates = _build_sample_candidates()
    scored: list[MatchingCandidate] = []
    for c in candidates:
        score = _score_candidate(payload, c)
        breakdown = c.get("__breakdown", {})
        summary = (
            f"{c.get('shop_name', '')}所属。"
            f"{c.get('mood_tag', '')} な雰囲気で"
            f"{c.get('style_tag', '')} な施術が得意です。"
        )
        scored.append(
            MatchingCandidate(
                therapist_id=c["therapist_id"],
                therapist_name=c["therapist_name"],
                shop_id=c["shop_id"],
                shop_name=c["shop_name"],
                score=score,
                breakdown=MatchingBreakdown(**breakdown),
                summary=summary,
                slots=c.get("slots", []),
            )
        )

    scored_sorted = sorted(scored, key=lambda x: x.score, reverse=True)
    top = scored_sorted[:3]
    rest = scored_sorted[3:]
    return MatchingResponse(top_matches=top, other_candidates=rest)
