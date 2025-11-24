from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from .services.shop.search_service import ShopSearchService
from ...db import get_session

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
        order.index(price_map[therapist_price])
        if therapist_price in price_map
        else -1
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
    """
    v1: サーバ側で簡易スコアリング（フロントの computeMatchingScore と同趣旨）。
    TODO: 検索rank/coreやプロファイルタグを取り込んで精度を上げる。
    """
    price_fit = _compute_price_fit(
        payload.budget_level, candidate.get("price_level", None)
    )
    mood_fit = _compute_choice_fit(payload.mood_pref, candidate.get("mood_tag"))
    talk_fit = _compute_choice_fit(payload.talk_pref, candidate.get("talk_level"))
    style_fit = _compute_choice_fit(payload.style_pref, candidate.get("style_tag"))
    look_fit = _compute_choice_fit(payload.look_pref, candidate.get("look_type"))
    core_score = 0.6  # TODO: search rank/core を反映する
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


def _map_shop_to_candidate(shop: Any) -> dict[str, Any]:
    """
    ShopSearchService の結果をプレーンな candidate dict に変換する。
    - staff_preview があれば先頭スタッフを仮に推薦対象とする（暫定）
    - next_available_slot / staff_preview.next_available_slot を slots に反映
    """
    staff = None
    if getattr(shop, "staff_preview", None):
        staff = next((s for s in shop.staff_preview if getattr(s, "name", None)), None)
    therapist_id = getattr(staff, "id", None) or getattr(shop, "id", None)
    therapist_name = getattr(staff, "name", None) or getattr(shop, "name", "")

    slot = None
    if staff and getattr(staff, "next_available_slot", None):
        slot = staff.next_available_slot
    elif getattr(shop, "next_available_slot", None):
        slot = shop.next_available_slot

    slots = []
    if slot:
        slots.append(
            {
                "start_at": getattr(slot, "start_at", None),
                "end_at": getattr(slot, "end_at", None),
            }
        )

    return {
        "therapist_id": str(therapist_id or ""),
        "therapist_name": therapist_name or "",
        "shop_id": str(getattr(shop, "id", "")),
        "shop_name": getattr(shop, "name", "") or "",
        "price_level": getattr(shop, "price_band", None),
        "mood_tag": None,  # TODO: プロファイルタグ連携
        "talk_level": None,
        "style_tag": None,
        "look_type": None,
        "slots": slots,
    }


@router.post("/search", response_model=MatchingResponse)
async def guest_matching_search(
    payload: GuestMatchingRequest, db: AsyncSession = Depends(get_session)
) -> MatchingResponse:
    """
    v1: 既存ショップ検索をラップし、簡易スコアリングして返却。
    現状はタグ不足のため雰囲気系タグは空（0.5のニュートラル）で計算。
    """
    if not payload.area or not payload.date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="area and date are required",
        )

    search_service = ShopSearchService(db)
    try:
        search_res = await search_service.search(
            area=payload.area,
            available_date=payload.date,
            open_now=True,
            page=1,
            page_size=12,
        )
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="matching search failed",
        ) from exc

    # search_res is dict-like from ShopSearchService.search
    hits = search_res.get("results", []) if isinstance(search_res, dict) else []
    candidates_raw = [_map_shop_to_candidate(shop) for shop in hits]

    scored: list[MatchingCandidate] = []
    for c in candidates_raw:
        score = _score_candidate(payload, c)
        breakdown = c.get("__breakdown", {})
        summary = (
            f"{c.get('shop_name', '')} のスタッフ候補です。"
            "条件に近い順に並べています。"
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
