"""Scoring utilities for guest matching."""

from typing import Any

from .schemas import GuestMatchingRequest
from ..services.recommended_scoring_service import (
    GuestIntent,
    TherapistProfile,
    recommended_score_with_breakdown,
)


DEFAULT_BREAKDOWN = {
    "base_staff_similarity": 0.5,
    "tag_similarity": 0.5,
    "price_match": 0.5,
    "age_match": 0.5,
    "photo_similarity": 0.5,
    "availability_boost": 0.0,
}


def normalize_score(value: float | None) -> float:
    if value is None:
        return 0.5
    return max(0.0, min(1.0, value))


def compute_price_fit(budget_level: str | None, therapist_price: str | None) -> float:
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


def compute_choice_fit(pref: dict[str, float] | None, tag: str | None) -> float:
    if not pref or not tag:
        return 0.5
    return normalize_score(pref.get(tag))


def compute_core_score(
    payload: GuestMatchingRequest, candidate: dict[str, Any]
) -> float:
    """Compute core score based on area/date/time matching and search rank."""
    score = 0.5

    if payload.area:
        candidate_area = candidate.get("area") or candidate.get("shop_area")
        if candidate_area and candidate_area.lower() == payload.area.lower():
            score += 0.2
        elif candidate_area:
            if payload.area.lower() in candidate_area.lower():
                score += 0.1

    search_rank = candidate.get("_search_rank") or candidate.get("search_rank")
    if search_rank is not None:
        rank_score = max(0.5, 1.0 - (search_rank - 1) * 0.025)
        score = (score + rank_score) / 2

    text_relevance = candidate.get("_text_relevance") or candidate.get("text_relevance")
    if text_relevance is not None:
        score = (score + normalize_score(text_relevance)) / 2

    return normalize_score(score)


def compute_availability_score(candidate: dict[str, Any]) -> float:
    """Compute availability score based on slot quality."""
    slots = candidate.get("slots") or []
    if not slots:
        return 0.2

    score = 0.5
    slot_count = len(slots)
    if slot_count >= 4:
        score += 0.3
    elif slot_count >= 2:
        score += 0.2
    elif slot_count >= 1:
        score += 0.1

    total_minutes = 0
    for slot in slots:
        duration = slot.get("duration_minutes") or slot.get("duration")
        if duration:
            total_minutes += int(duration)
    if total_minutes >= 180:
        score += 0.2
    elif total_minutes >= 60:
        score += 0.1

    return normalize_score(score)


def score_candidate(payload: GuestMatchingRequest, candidate: dict[str, Any]) -> float:
    """v1: Server-side scoring aligned with frontend computeMatchingScore."""
    price_fit = normalize_score(
        compute_price_fit(payload.budget_level, candidate.get("price_level", None))
    )
    mood_fit = compute_choice_fit(payload.mood_pref, candidate.get("mood_tag"))
    talk_fit = compute_choice_fit(payload.talk_pref, candidate.get("talk_level"))
    style_fit = compute_choice_fit(payload.style_pref, candidate.get("style_tag"))
    look_fit = compute_choice_fit(payload.look_pref, candidate.get("look_type"))
    core_score = compute_core_score(payload, candidate)
    availability_score = compute_availability_score(candidate)

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


# ---- Recommended scoring ----


def _map_talk_pref_to_conversation(talk_pref: dict[str, float] | None) -> str | None:
    if not talk_pref:
        return None
    max_key = max(talk_pref, key=talk_pref.get, default=None)
    if not max_key:
        return None
    mapping = {
        "quiet": "quiet",
        "normal": "normal",
        "chatty": "talkative",
        "talkative": "talkative",
    }
    return mapping.get(max_key.lower())


def _map_style_pref_to_pressure(style_pref: dict[str, float] | None) -> str | None:
    if not style_pref:
        return None
    max_key = max(style_pref, key=style_pref.get, default=None)
    if not max_key:
        return None
    mapping = {
        "soft": "soft",
        "light": "soft",
        "balanced": "medium",
        "medium": "medium",
        "firm": "strong",
        "strong": "strong",
    }
    return mapping.get(max_key.lower())


def _map_talk_level_to_conversation(talk_level: str | None) -> str | None:
    if not talk_level:
        return None
    mapping = {
        "quiet": "quiet",
        "moderate": "normal",
        "chatty": "talkative",
    }
    return mapping.get(talk_level.lower())


def _map_style_tag_to_pressure(style_tag: str | None) -> str | None:
    if not style_tag:
        return None
    mapping = {
        "soft": "soft",
        "balanced": "medium",
        "firm": "strong",
    }
    return mapping.get(style_tag.lower())


def compute_recommended_score(
    payload: GuestMatchingRequest, candidate: dict[str, Any]
) -> tuple[float, dict[str, Any]]:
    """Compute recommended score using the new scoring service."""
    intent = GuestIntent(
        area=payload.area,
        date=payload.date,
        time_from=payload.time_from,
        time_to=payload.time_to,
        price_min=None,
        price_max=None,
        shop_id=None,
        visual_style_tags=payload.look_types,
        conversation_preference=_map_talk_pref_to_conversation(payload.talk_pref),
        massage_pressure_preference=_map_style_pref_to_pressure(payload.style_pref),
        mood_preference_tags=payload.mood_tags,
        raw_text=payload.free_text or "",
    )

    profile = TherapistProfile(
        therapist_id=str(candidate.get("therapist_id") or candidate.get("id") or ""),
        visual_style_tags=[candidate.get("look_type")]
        if candidate.get("look_type")
        else None,
        conversation_style=_map_talk_level_to_conversation(candidate.get("talk_level")),
        massage_pressure=_map_style_tag_to_pressure(candidate.get("style_tag")),
        mood_tags=[candidate.get("mood_tag")] if candidate.get("mood_tag") else None,
        total_bookings_30d=candidate.get("total_bookings_30d", 0),
        repeat_rate_30d=candidate.get("repeat_rate_30d", 0.0),
        avg_review_score=candidate.get("avg_review_score", 0.0),
        price_tier=candidate.get("price_rank") or 1,
        days_since_first_shift=candidate.get("days_since_first_shift", 365),
        utilization_7d=candidate.get("utilization_7d", 0.0),
        availability_score=compute_availability_score(candidate),
    )

    breakdown = recommended_score_with_breakdown(intent, profile)
    score = breakdown.final

    return score, {
        "affinity": breakdown.affinity,
        "popularity": breakdown.popularity,
        "user_fit": breakdown.user_fit,
        "newcomer": breakdown.newcomer,
        "load_balance": breakdown.load_balance,
        "fairness": breakdown.fairness,
        "availability_factor": breakdown.availability_factor,
        "recommended": breakdown.final,
    }


# ---- V2 scoring (photo-heavy) ----


def jaccard(a: list[str] | None, b: list[str] | None) -> float:
    if not a or not b:
        return 0.0
    set_a, set_b = set(a), set(b)
    if not set_a or not set_b:
        return 0.0
    union = len(set_a | set_b)
    if union == 0:
        return 0.0
    return len(set_a & set_b) / union


def score_photo_similarity(
    base: dict[str, Any] | None, candidate: dict[str, Any]
) -> float:
    """Compute photo similarity using embedding vectors."""
    try:
        from ..services.photo_embedding_service import PhotoEmbeddingService
    except ImportError:
        return 0.5

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

    similarity = PhotoEmbeddingService.compute_cosine_similarity(base_vec, cand_vec)
    if similarity < 0:
        return 0.0
    return similarity


def score_tags_v2(payload: GuestMatchingRequest, candidate: dict[str, Any]) -> float:
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
        hobby_score = jaccard(q_hobby, c_hobby)

    tag_score = (
        weights["mood_tag"] * mood_score
        + weights["style_tag"] * style_score
        + weights["look_type"] * look_score
        + weights["contact_style"] * contact_score
        + hobby_weight * hobby_score
    )
    return max(0.0, min(1.0, tag_score))


def score_price_v2(payload: GuestMatchingRequest, candidate: dict[str, Any]) -> float:
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


def score_age_v2(payload: GuestMatchingRequest, candidate: dict[str, Any]) -> float:
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


def aggregate_score(bd: dict[str, float]) -> float:
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


def normalize_breakdown(raw: dict[str, Any] | None) -> dict[str, float]:
    """Convert legacy breakdown to new shape or fill defaults."""
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
        return {**DEFAULT_BREAKDOWN, **raw}

    return {
        "base_staff_similarity": raw.get("core", 0.5),
        "tag_similarity": raw.get("moodFit", 0.5),
        "price_match": raw.get("priceFit", 0.5),
        "age_match": raw.get("lookFit", 0.5),
        "photo_similarity": raw.get("styleFit", 0.5),
        "availability_boost": raw.get("availability", 0.0),
    }


def score_candidate_v2(
    payload: GuestMatchingRequest,
    candidate: dict[str, Any],
    base: dict[str, Any] | None,
    availability_boost: float = 0.0,
) -> dict[str, float]:
    tag_similarity = score_tags_v2(payload, candidate)
    price_match = score_price_v2(payload, candidate)
    age_match = score_age_v2(payload, candidate)
    photo_similarity = score_photo_similarity(base, candidate)

    base_staff_similarity = photo_similarity if base else 0.5

    bd = {
        "base_staff_similarity": base_staff_similarity,
        "tag_similarity": tag_similarity,
        "price_match": price_match,
        "age_match": age_match,
        "photo_similarity": photo_similarity,
        "availability_boost": availability_boost,
    }
    score = aggregate_score(bd)
    bd["score"] = score
    return bd


def is_available_candidate(candidate: dict[str, Any]) -> bool:
    if candidate.get("is_available_now") is False:
        return False
    slots = candidate.get("slots")
    if isinstance(slots, list) and slots:
        return True
    return True
