import logging
from typing import Any, Optional
from datetime import date
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .services.shop.search_service import ShopSearchService
from .therapist_availability import is_available
from ... import models
from ...db import get_session

router = APIRouter(prefix="/api/guest/matching", tags=["guest-matching"])
logger = logging.getLogger(__name__)

SIMILAR_DEFAULT_LIMIT = 8
SIMILAR_MAX_LIMIT = 20
SIMILAR_DEFAULT_MIN_SCORE = 0.4
AVAILABILITY_CHECK_LIMIT = 20
DEFAULT_BREAKDOWN = {
    "base_staff_similarity": 0.5,
    "tag_similarity": 0.5,
    "price_match": 0.5,
    "age_match": 0.5,
    "photo_similarity": 0.5,
    "availability_boost": 0.0,
}


class GuestMatchingRequest(BaseModel):
    area: Optional[str] = None
    date: Optional[str] = None
    time_from: str | None = None
    time_to: str | None = None
    budget_level: str | None = Field(default=None, pattern="^(low|mid|high)?$")
    mood_pref: dict[str, float] | None = None
    talk_pref: dict[str, float] | None = None
    style_pref: dict[str, float] | None = None
    look_pref: dict[str, float] | None = None
    free_text: str | None = None
    guest_token: str | None = None
    # v2 scoring options (optional)
    mood_tags: list[str] | None = None
    style_tags: list[str] | None = None
    look_types: list[str] | None = None
    contact_styles: list[str] | None = None
    hobby_tags: list[str] | None = None
    price_rank_min: int | None = None
    price_rank_max: int | None = None
    age_min: int | None = None
    age_max: int | None = None
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
    is_available: bool | None = None  # availability の簡易版（True/False/None）
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


def _normalize_score(value: float | None) -> float:
    if value is None:
        return 0.5
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
    """
    v1: サーバ側で簡易スコアリング（フロントの computeMatchingScore と同趣旨）。
    TODO: 検索rank/coreやプロファイルタグを取り込んで精度を上げる。
    """
    price_fit = _normalize_score(
        _compute_price_fit(payload.budget_level, candidate.get("price_level", None))
    )
    mood_fit = _compute_choice_fit(payload.mood_pref, candidate.get("mood_tag"))
    talk_fit = _compute_choice_fit(payload.talk_pref, candidate.get("talk_level"))
    style_fit = _compute_choice_fit(payload.style_pref, candidate.get("style_tag"))
    look_fit = _compute_choice_fit(payload.look_pref, candidate.get("look_type"))
    core_score = _normalize_score(0.6)  # TODO: search rank/core を反映する
    availability_score = _normalize_score(0.8 if candidate.get("slots") else 0.3)

    score = (
        0.4 * core_score
        + 0.15 * price_fit
        + 0.15 * mood_fit
        + 0.1 * talk_fit
        + 0.1 * style_fit
        + 0.05 * look_fit
        + 0.05 * availability_score
    )
    score = max(0.0, min(1.0, score))
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


# ---- Similar therapists (GET /api/guest/matching/similar) ----


def _jaccard(a: list[str] | None, b: list[str] | None) -> float:
    if not a or not b:
        return 0.0
    set_a, set_b = set(a), set(b)
    if not set_a or not set_b:
        return 0.0
    union = len(set_a | set_b)
    if union == 0:
        return 0.0
    return len(set_a & set_b) / union


def _combine_datetime(d: date | None, t: str | None) -> datetime | None:
    if not d or not t:
        return None
    try:
        hour, minute = map(int, t.split(":"))
        return datetime(
            d.year,
            d.month,
            d.day,
            hour,
            minute,
            tzinfo=datetime.now().astimezone().tzinfo,
        )
    except Exception:
        return None


def _resolve_phase(payload: GuestMatchingRequest, parsed_date: date | None) -> str:
    """Resolve phase with fallbacks based on date/time presence."""
    requested = payload.phase
    has_time_window = bool(parsed_date and payload.time_from and payload.time_to)

    if requested == "book" and not has_time_window:
        requested = "explore"
    if requested in {"explore", "narrow", "book"}:
        return requested

    if has_time_window:
        return "book"
    return "explore"


def _compute_tag_similarity(base: dict[str, Any], candidate: dict[str, Any]) -> float:
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

    hobby_score = _jaccard(
        base.get("hobby_tags") or [], candidate.get("hobby_tags") or []
    )
    tag_score += hobby_weight * hobby_score
    return max(0.0, min(1.0, tag_score))


def _compute_price_score(base_rank: int | None, candidate_rank: int | None) -> float:
    if base_rank is None or candidate_rank is None:
        return 0.5
    diff = abs(base_rank - candidate_rank)
    return max(0.0, 1.0 - diff * 0.4)


def _compute_age_score(base_age: int | None, candidate_age: int | None) -> float:
    if base_age is None or candidate_age is None:
        return 0.5
    diff = abs(base_age - candidate_age)
    return max(0.0, 1.0 - diff / 15.0)


def _compute_similar_scores(
    base: dict[str, Any], candidate: dict[str, Any]
) -> dict[str, float]:
    """Compute tag/price/age similarity and final score (0..1).

    photo_similarity mirrors tag_similarity for v1 so we can swap in embeddings later
    without changing the response shape.
    """
    tag_similarity = _compute_tag_similarity(base, candidate)
    price_score = _compute_price_score(
        base.get("price_rank"), candidate.get("price_rank")
    )
    age_score = _compute_age_score(base.get("age"), candidate.get("age"))
    photo_similarity = (
        tag_similarity  # v1: tag proxy, future: replace with embedding score
    )

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


# ---- v2 search scoring (photo-heavy) ----


def _score_photo_similarity(
    base: dict[str, Any] | None, candidate: dict[str, Any]
) -> float:
    """
    Placeholder embedding similarity.
    - If base or candidate lacks embeddings, return neutral 0.5.
    - If embeddings exist, compute cosine similarity and clip to 0..1 (negatives -> 0).
    """
    base_vec = (
        base.get("photo_embedding")
        if isinstance(base, dict)
        else getattr(base, "photo_embedding", None)
        if base
        else None
    )
    cand_vec = (
        candidate.get("photo_embedding")
        if isinstance(candidate, dict)
        else getattr(candidate, "photo_embedding", None)
    )
    if not base_vec or not cand_vec:
        return 0.5
    try:
        import math

        dot = sum(float(a) * float(b) for a, b in zip(base_vec, cand_vec))
        norm_base = math.sqrt(sum(float(a) ** 2 for a in base_vec))
        norm_cand = math.sqrt(sum(float(b) ** 2 for b in cand_vec))
        if norm_base == 0 or norm_cand == 0:
            return 0.5
        cos = dot / (norm_base * norm_cand)
        return max(0.0, min(1.0, cos))
    except Exception:
        return 0.5


def _score_tags_v2(payload: GuestMatchingRequest, candidate: dict[str, Any]) -> float:
    weights = {
        "mood_tag": 0.25,
        "style_tag": 0.20,
        "look_type": 0.30,
        "contact_style": 0.10,
    }
    hobby_weight = 0.15

    def _single(list_pref: list[str] | None, value: str | None) -> float:
        if not list_pref:
            return 0.5
        if not value:
            return 0.0
        return 1.0 if value in list_pref else 0.0

    mood_score = _single(payload.mood_tags, candidate.get("mood_tag"))
    style_score = _single(payload.style_tags, candidate.get("style_tag"))
    look_score = _single(payload.look_types, candidate.get("look_type"))
    contact_score = _single(payload.contact_styles, candidate.get("contact_style"))

    q_hobby = payload.hobby_tags or []
    c_hobby = candidate.get("hobby_tags") or []
    if not q_hobby:
        hobby_score = 0.5
    elif not c_hobby:
        hobby_score = 0.0
    else:
        hobby_score = _jaccard(q_hobby, c_hobby)

    tag_score = (
        weights["mood_tag"] * mood_score
        + weights["style_tag"] * style_score
        + weights["look_type"] * look_score
        + weights["contact_style"] * contact_score
        + hobby_weight * hobby_score
    )
    return max(0.0, min(1.0, tag_score))


def _score_price_v2(payload: GuestMatchingRequest, candidate: dict[str, Any]) -> float:
    min_rank = payload.price_rank_min
    max_rank = payload.price_rank_max
    cand = candidate.get("price_rank")
    if min_rank is None or max_rank is None or cand is None:
        return 0.5
    try:
        ideal = (float(min_rank) + float(max_rank)) / 2.0
        diff = abs(float(cand) - ideal)
    except Exception:
        return 0.5
    return max(0.0, 1.0 - diff * 0.4)


def _score_age_v2(payload: GuestMatchingRequest, candidate: dict[str, Any]) -> float:
    min_age = payload.age_min
    max_age = payload.age_max
    cand_age = candidate.get("age")
    if min_age is None or max_age is None or cand_age is None:
        return 0.5
    try:
        ideal = (float(min_age) + float(max_age)) / 2.0
        diff = abs(float(cand_age) - ideal)
    except Exception:
        return 0.5
    return max(0.0, 1.0 - diff / 15.0)


def _aggregate_score(bd: dict[str, float]) -> float:
    """Aggregate breakdown dict into final score, clamped to 0..1."""
    score = (
        0.35 * bd.get("base_staff_similarity", 0.5)
        + 0.25 * bd.get("tag_similarity", 0.5)
        + 0.15 * bd.get("price_match", 0.5)
        + 0.10 * bd.get("age_match", 0.5)
        + 0.10 * bd.get("photo_similarity", 0.5)
        + 0.05 * bd.get("availability_boost", 0.0)
    )
    return max(0.0, min(1.0, score))


def _normalize_breakdown(raw: dict[str, Any] | None) -> dict[str, float]:
    """Convert legacy breakdown (core/priceFit/...) to the new shape or fill defaults."""
    if not raw:
        return DEFAULT_BREAKDOWN.copy()
    if {
        "base_staff_similarity",
        "tag_similarity",
        "price_match",
        "age_match",
        "photo_similarity",
        "availability_boost",
    }.issubset(raw.keys()):
        # already new shape
        return {**DEFAULT_BREAKDOWN, **raw}

    # legacy keys fallback
    return {
        "base_staff_similarity": raw.get("core", 0.5),
        "tag_similarity": raw.get("moodFit", 0.5),
        "price_match": raw.get("priceFit", 0.5),
        "age_match": raw.get("lookFit", 0.5),
        "photo_similarity": raw.get("styleFit", 0.5),
        "availability_boost": raw.get("availability", 0.0),
    }


def _score_candidate_v2(
    payload: GuestMatchingRequest,
    candidate: dict[str, Any],
    base: dict[str, Any] | None,
    availability_boost: float = 0.0,
) -> dict[str, float]:
    tag_similarity = _score_tags_v2(payload, candidate)
    price_match = _score_price_v2(payload, candidate)
    age_match = _score_age_v2(payload, candidate)
    photo_similarity = _score_photo_similarity(base, candidate)

    base_staff_similarity = photo_similarity if base else 0.5

    bd = {
        "base_staff_similarity": base_staff_similarity,
        "tag_similarity": tag_similarity,
        "price_match": price_match,
        "age_match": age_match,
        "photo_similarity": photo_similarity,
        "availability_boost": availability_boost,
    }
    score = _aggregate_score(bd)
    bd["score"] = score
    return bd


def _is_available(candidate: dict[str, Any]) -> bool:
    if candidate.get("is_available_now") is False:
        return False
    slots = candidate.get("slots")
    if isinstance(slots, list) and slots:
        return True
    return True


async def _get_base_staff(db: AsyncSession | None, staff_id: str) -> dict[str, Any]:
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
    photo_embedding = getattr(profile, "photo_embedding", None) or getattr(
        therapist, "photo_embedding", None
    )
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


async def _fetch_similar_candidates(
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
            "photo_embedding": getattr(profile, "photo_embedding", None)
            or getattr(therapist, "photo_embedding", None),
            "is_available_now": bool(getattr(therapist, "is_booking_enabled", True)),
        }
        if exclude_unavailable and not _is_available(cand):
            continue
        candidates.append(cand)
    return candidates


def _map_shop_to_candidate(shop: Any) -> dict[str, Any]:
    """
    ShopSearchService の結果をプレーンな candidate dict に変換する。

    search 結果が dict の場合と ORM オブジェクトの場合の両方に対応する。
    - staff_preview があれば先頭スタッフを仮に推薦対象とする（暫定）
    - next_available_slot / staff_preview.next_available_slot を slots に反映
    """

    def getter(obj: Any, key: str, default: Any = None) -> Any:
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    staff = None
    staff_preview = getter(shop, "staff_preview", None) or []
    if staff_preview:
        staff = next((s for s in staff_preview if getter(s, "name", None)), None)

    therapist_id = getter(staff, "id", None) or getter(shop, "id", None)
    therapist_name = getter(staff, "name", None) or getter(shop, "name", "")

    slot = None
    staff_slot = getter(staff, "next_available_slot", None)
    shop_slot = getter(shop, "next_available_slot", None)
    slot = staff_slot or shop_slot

    slots: list[dict[str, Any]] = []
    if slot:
        slots.append(
            {
                "start_at": getter(slot, "start_at", None),
                "end_at": getter(slot, "end_at", None),
            }
        )

    photos = getter(staff, "photos", None) or getter(shop, "photo_urls", None) or []
    photo_embedding = getter(staff, "photo_embedding", None) or getter(
        shop, "photo_embedding", None
    )

    return {
        "therapist_id": str(therapist_id or ""),
        "therapist_name": therapist_name or "",
        "shop_id": str(getter(shop, "id", "")),
        "shop_name": getter(shop, "name", "") or "",
        "price_rank": getter(shop, "ranking_weight", None),
        "price_level": getter(shop, "price_band", None),
        "mood_tag": getter(staff, "mood_tag", None) or getter(shop, "mood_tag", None),
        "talk_level": getter(staff, "talk_level", None)
        or getter(shop, "talk_level", None),
        "style_tag": getter(staff, "style_tag", None)
        or getter(shop, "style_tag", None),
        "look_type": getter(staff, "look_type", None)
        or getter(shop, "look_type", None),
        "contact_style": getter(staff, "contact_style", None)
        or getter(shop, "contact_style", None),
        "hobby_tags": getter(staff, "hobby_tags", None)
        or getter(shop, "hobby_tags", None)
        or [],
        "age": getter(staff, "age", None) or getter(shop, "age", None),
        "photo_url": (photos or [None])[0],
        "photo_embedding": photo_embedding,
        "slots": slots,
    }


async def _log_matching(
    db: AsyncSession,
    payload: GuestMatchingRequest,
    top_matches: list[MatchingCandidate],
    other_candidates: list[MatchingCandidate],
    guest_token: str | None = None,
    phase: str | None = None,
    step_index: int | None = None,
    entry_source: str | None = None,
) -> None:
    """
    Best-effort logging of matching input and candidates.
    Must not break the main flow.
    """
    try:
        if not db or not hasattr(db, "add"):
            return
        log = models.GuestMatchLog(
            guest_token=guest_token,
            area=getattr(payload, "area", None),
            date=getattr(payload, "date", None),
            budget_level=getattr(payload, "budget_level", None),
            mood_pref=getattr(payload, "mood_pref", None),
            talk_pref=getattr(payload, "talk_pref", None),
            style_pref=getattr(payload, "style_pref", None),
            look_pref=getattr(payload, "look_pref", None),
            free_text=getattr(payload, "free_text", None),
            phase=phase,
            step_index=step_index,
            entry_source=entry_source,
            top_matches=[c.model_dump() for c in top_matches],
            other_candidates=[c.model_dump() for c in other_candidates],
            selected_therapist_id=None,
            selected_shop_id=None,
            selected_slot=None,
        )
        db.add(log)
        await db.commit()
    except Exception as exc:  # pragma: no cover - best effort
        await db.rollback()
        logger.warning("guest_matching_log_failed: %s", exc)


@router.get("/search", response_model=MatchingResponse)
@router.post("/search", response_model=MatchingResponse)
async def guest_matching_search(
    payload: GuestMatchingRequest = Depends(), db: AsyncSession = Depends(get_session)
) -> MatchingResponse:
    """
    v1: 既存ショップ検索をラップし、簡易スコアリングして返却。
    現状はタグ不足のため雰囲気系タグは空（0.5のニュートラル）で計算。
    """
    if not payload.area or not payload.date:
        # 入力が欠けている場合は 422 ではなく空レスポンスで返す（フロントに優しく）
        return MatchingResponse(items=[], total=0)

    # date を安全にパース（失敗しても None で進める）
    parsed_date: date | None = None
    if isinstance(payload.date, date):
        parsed_date = payload.date
    elif isinstance(payload.date, str):
        try:
            parsed_date = datetime.fromisoformat(payload.date).date()
        except ValueError:
            parsed_date = None

    phase = _resolve_phase(payload, parsed_date)

    search_service = ShopSearchService(db)
    try:
        search_res = await search_service.search(
            area=payload.area,
            available_date=parsed_date,
            open_now=True,
            page=1,
            page_size=12,
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("matching_search_failed: %s", exc)
        # fail-soft: 500 を返さず空レスポンスで返す
        return MatchingResponse(items=[], total=0)

    # search_res is dict-like from ShopSearchService.search
    hits = search_res.get("results", []) if isinstance(search_res, dict) else []
    candidates_raw = [_map_shop_to_candidate(shop) for shop in hits]

    scored: list[MatchingCandidate] = []
    for c in candidates_raw:
        score = _score_candidate(payload, c)
        breakdown = _normalize_breakdown(c.get("__breakdown", {}))
        summary = (
            f"{c.get('shop_name', '')} のスタッフ候補です。条件に近い順に並べています。"
        )
        scored.append(
            MatchingCandidate(
                id=c["therapist_id"],
                therapist_id=c["therapist_id"],
                therapist_name=c["therapist_name"],
                shop_id=c["shop_id"],
                shop_name=c["shop_name"],
                score=score,
                breakdown=MatchingBreakdown(**breakdown),
                summary=summary,
                slots=c.get("slots", []),
                mood_tag=c.get("mood_tag"),
                style_tag=c.get("style_tag"),
                look_type=c.get("look_type"),
                talk_level=c.get("talk_level"),
                contact_style=c.get("contact_style"),
                hobby_tags=c.get("hobby_tags"),
            )
        )

    # v2 scoring (photo-heavy)
    base_ctx: dict[str, Any] | None = None
    if payload.base_staff_id:
        try:
            base_ctx = await _get_base_staff(db, payload.base_staff_id)
        except HTTPException as exc:
            raise exc
        except Exception:
            base_ctx = None

    v2_items: list[MatchingCandidate] = []
    for c in candidates_raw:
        # calculate v2 score; keep existing fields for compatibility
        bd = _score_candidate_v2(payload, c, base_ctx)
        score = bd.get("score", 0.0)
        photo_similarity = bd.get("photo_similarity", 0.5)
        breakdown = bd
        summary = (
            f"{c.get('shop_name', '')} のスタッフ候補です。条件に近い順に並べています。"
        )
        v2_items.append(
            MatchingCandidate(
                id=c["therapist_id"],
                therapist_id=c["therapist_id"],
                therapist_name=c["therapist_name"],
                shop_id=c["shop_id"],
                shop_name=c["shop_name"],
                score=score,
                breakdown=MatchingBreakdown(**breakdown),
                summary=summary,
                slots=c.get("slots", []),
                mood_tag=c.get("mood_tag"),
                style_tag=c.get("style_tag"),
                look_type=c.get("look_type"),
                talk_level=c.get("talk_level"),
                contact_style=c.get("contact_style"),
                hobby_tags=c.get("hobby_tags") or [],
                price_rank=c.get("price_rank"),
                age=c.get("age"),
                photo_url=c.get("photo_url"),
                photo_similarity=photo_similarity,
                is_available=None,
                availability=None,
            )
        )

    sort_value = (payload.sort or "recommended").lower()

    # availability annotation / filtering by phase
    has_time_window = bool(parsed_date and payload.time_from and payload.time_to)
    should_check_availability = (
        phase in {"narrow", "book"}
        and has_time_window
        and payload.time_from
        and payload.time_to
    )
    avail_start = (
        _combine_datetime(parsed_date, payload.time_from)
        if should_check_availability
        else None
    )
    avail_end = (
        _combine_datetime(parsed_date, payload.time_to)
        if should_check_availability
        else None
    )
    if (
        should_check_availability
        and avail_start
        and avail_end
        and avail_start < avail_end
    ):
        to_check = v2_items
        for cand in to_check:
            try:
                ok, debug = await is_available(
                    db, cand.therapist_id, avail_start, avail_end
                )
                reasons = debug.get("rejected_reasons") or []
            except Exception:
                ok = False
                reasons = ["internal_error"]
            cand.availability = {"is_available": ok, "rejected_reasons": reasons}
            if not ok and "internal_error" in reasons:
                cand.is_available = None
            else:
                cand.is_available = ok
            avail_boost = 1.0 if ok else 0.0
            bd = cand.breakdown.model_dump()
            bd["availability_boost"] = avail_boost
            cand.breakdown = MatchingBreakdown(**bd)
            cand.score = _aggregate_score(bd)

        if phase == "book":
            v2_items = [cand for cand in v2_items if cand.is_available is True]
    else:
        # availability is not considered (explore or insufficient time info)
        for cand in v2_items:
            cand.availability = {"is_available": None, "rejected_reasons": []}
            cand.is_available = None
            bd = cand.breakdown.model_dump()
            bd["availability_boost"] = 0.0
            cand.breakdown = MatchingBreakdown(**bd)
            cand.score = _aggregate_score(bd)

    if sort_value == "recommended":
        v2_items = sorted(
            v2_items,
            key=lambda x: (
                -(x.score or 0.0),
                0 if (x.is_available is True) else 1 if x.is_available is False else 2,
                x.therapist_id,
            ),
        )
    # honor limit/offset if provided
    offset = payload.offset or 0
    limit = payload.limit or 30
    sliced = v2_items[offset : offset + limit]

    log_phase = (
        payload.phase if payload.phase in {"explore", "narrow", "book"} else None
    )
    log_step = (
        payload.step_index if payload.step_index and payload.step_index >= 1 else None
    )
    log_entry_source = payload.entry_source or None

    try:
        await _log_matching(
            db,
            payload,
            sliced,
            [],
            guest_token=payload.guest_token,
            phase=log_phase,
            step_index=log_step,
            entry_source=log_entry_source,
        )
    except Exception:
        logger.debug("guest_matching_log_skip")
    return MatchingResponse(items=sliced, total=len(v2_items))


@router.get("/similar", response_model=SimilarResponse)
async def guest_matching_similar(
    staff_id: str = Query(
        default=None, description="Base staff/therapist id (alias: therapist_id)"
    ),
    therapist_id: str | None = Query(
        default=None, description="Deprecated alias for staff_id"
    ),
    limit: int = Query(
        SIMILAR_DEFAULT_LIMIT,
        ge=1,
        le=SIMILAR_MAX_LIMIT,
        description="Maximum similar candidates to return",
    ),
    shop_id: str | None = Query(
        default=None, description="If set, restricts search to this shop/profile"
    ),
    exclude_unavailable: bool = Query(
        default=True,
        description="Exclude therapists with no availability",
    ),
    min_score: float = Query(
        SIMILAR_DEFAULT_MIN_SCORE,
        ge=0.0,
        le=1.0,
        description="Drop candidates below this score",
    ),
    db: AsyncSession = Depends(get_session),
) -> SimilarResponse:
    base_id = staff_id or therapist_id
    if not base_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="staff_id_required"
        )
    staff_id = base_id

    base = await _get_base_staff(db, staff_id)
    pool = await _fetch_similar_candidates(
        db,
        base=base,
        shop_id=shop_id,
        exclude_unavailable=exclude_unavailable,
        limit=limit,
    )

    scored: list[dict[str, Any]] = []
    for cand in pool:
        if cand.get("id") == base.get("id"):
            continue
        available = _is_available(cand)
        if exclude_unavailable and not available:
            continue
        scores = _compute_similar_scores(base, cand)
        if scores["score"] < min_score:
            continue
        scored.append(
            {
                **cand,
                "score": scores["score"],
                "tag_similarity": scores["tag_similarity"],
                "photo_similarity": scores["photo_similarity"],
                "is_available_now": available,
            }
        )

    base_shop_id = base.get("shop_id")
    scored_sorted = sorted(
        scored,
        key=lambda c: (
            -c["score"],
            0 if c.get("shop_id") == base_shop_id else 1,
            c.get("id"),
        ),
    )
    limited = scored_sorted[:limit]
    items: list[SimilarTherapistItem] = []
    for c in limited:
        items.append(
            SimilarTherapistItem(
                id=c.get("id"),
                name=c.get("name"),
                age=c.get("age"),
                price_rank=c.get("price_rank"),
                mood_tag=c.get("mood_tag"),
                style_tag=c.get("style_tag"),
                look_type=c.get("look_type"),
                contact_style=c.get("contact_style"),
                hobby_tags=c.get("hobby_tags") or [],
                photo_url=c.get("photo_url"),
                is_available_now=c.get("is_available_now", True),
                score=c.get("score", 0.0),
                photo_similarity=c.get("photo_similarity", 0.0),
                tag_similarity=c.get("tag_similarity", 0.0),
            )
        )

    return SimilarResponse(base_staff_id=base.get("id", staff_id), items=items)
