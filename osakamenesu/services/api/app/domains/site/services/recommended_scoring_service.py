"""Recommended scoring service aligned with frontend recommendedScore.ts.

This module provides Python implementations of the scoring functions used in
the frontend for computing recommended therapist rankings. The goal is to
ensure backend search results are ordered consistently with frontend
expectations.

Weights and formulas mirror src/matching/recommendedScore.ts.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence


def clamp01(value: float) -> float:
    """Clamp a value between 0 and 1."""
    return max(0.0, min(1.0, value))


# ---------------------------------------------------------------------------
# Type definitions
# ---------------------------------------------------------------------------


@dataclass
class GuestIntent:
    """Guest search intent / preferences."""

    area: str | None = None
    date: str | None = None
    time_from: str | None = None
    time_to: str | None = None
    price_min: int | None = None
    price_max: int | None = None
    shop_id: str | None = None
    visual_style_tags: list[str] | None = None
    conversation_preference: str | None = None  # 'talkative' | 'normal' | 'quiet'
    massage_pressure_preference: str | None = None  # 'soft' | 'medium' | 'strong'
    mood_preference_tags: list[str] | None = None
    raw_text: str = ""


@dataclass
class TherapistProfile:
    """Therapist profile with scoring-relevant fields."""

    therapist_id: str
    visual_style_tags: list[str] | None = None
    conversation_style: str | None = None  # 'talkative' | 'normal' | 'quiet'
    massage_pressure: str | None = None  # 'soft' | 'medium' | 'strong'
    mood_tags: list[str] | None = None
    total_bookings_30d: int = 0
    repeat_rate_30d: float = 0.0
    avg_review_score: float = 0.0
    price_tier: int = 1
    days_since_first_shift: int = 365
    utilization_7d: float = 0.0
    availability_score: float = 0.5


@dataclass
class ScoreBreakdown:
    """Breakdown of individual score components."""

    affinity: float
    popularity: float
    user_fit: float
    newcomer: float
    load_balance: float
    fairness: float
    availability_factor: float
    final: float


# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------


def normalize_bookings(total: int) -> float:
    """Normalize booking count to 0-1 scale.

    Uses saturation threshold of 100 bookings.
    """
    saturated = total / 100
    return clamp01(saturated)


def normalize_review(avg: float) -> float:
    """Normalize review score (1-5) to 0-1 scale."""
    return clamp01((avg - 1) / 4)


def normalize_price_tier(tier: int) -> float:
    """Normalize price tier (1-3) to 0-1 scale."""
    return clamp01((tier - 1) / 2)


# ---------------------------------------------------------------------------
# Tag matching
# ---------------------------------------------------------------------------


def compute_face_tag_match_score(
    user_tags: Sequence[str] | None,
    therapist_tags: Sequence[str] | None,
) -> float:
    """Compute visual style tag match score.

    Returns intersection / min(len(user), len(therapist)) or 0.5 if empty.
    """
    if not user_tags or not therapist_tags:
        return 0.5

    set_user = set(user_tags)
    set_therapist = set(therapist_tags)

    intersection_count = len(set_user & set_therapist)
    max_possible = min(len(set_user), len(set_therapist))

    if max_possible == 0:
        return 0.0

    return intersection_count / max_possible


def conversation_match_score(pref: str | None, actual: str | None) -> float:
    """Compute conversation style match score."""
    if not pref or not actual:
        return 0.5

    if pref == actual:
        return 1.0

    # Adjacent styles get partial credit
    adjacent_pairs = {
        ("talkative", "normal"),
        ("normal", "talkative"),
        ("quiet", "normal"),
        ("normal", "quiet"),
    }
    if (pref, actual) in adjacent_pairs:
        return 0.7

    return 0.3


def pressure_match_score(pref: str | None, actual: str | None) -> float:
    """Compute massage pressure match score."""
    if not pref or not actual:
        return 0.5

    if pref == actual:
        return 1.0

    # Adjacent pressures get partial credit
    adjacent_pairs = {
        ("soft", "medium"),
        ("medium", "soft"),
        ("medium", "strong"),
        ("strong", "medium"),
    }
    if (pref, actual) in adjacent_pairs:
        return 0.7

    return 0.3


def mood_match_score(
    pref_tags: Sequence[str] | None,
    actual_tags: Sequence[str] | None,
) -> float:
    """Compute mood tag match score."""
    if not pref_tags or not actual_tags:
        return 0.5

    pref_set = set(pref_tags)
    act_set = set(actual_tags)

    intersection = len(pref_set & act_set)
    max_possible = min(len(pref_set), len(act_set))

    if max_possible == 0:
        return 0.3

    raw = intersection / max_possible
    return 0.3 + 0.7 * raw


# ---------------------------------------------------------------------------
# Composite scores
# ---------------------------------------------------------------------------


def style_match_score(intent: GuestIntent, profile: TherapistProfile) -> float:
    """Compute style match score combining conversation, pressure, and mood."""
    conv = conversation_match_score(
        intent.conversation_preference,
        profile.conversation_style,
    )
    press = pressure_match_score(
        intent.massage_pressure_preference,
        profile.massage_pressure,
    )
    mood = mood_match_score(
        intent.mood_preference_tags,
        profile.mood_tags,
    )

    # Weights: conversation 0.4, pressure 0.3, mood 0.3
    return 0.4 * conv + 0.3 * press + 0.3 * mood


def affinity_score(intent: GuestIntent, profile: TherapistProfile) -> float:
    """Compute affinity score (look + style)."""
    look = compute_face_tag_match_score(
        intent.visual_style_tags,
        profile.visual_style_tags,
    )
    style = style_match_score(intent, profile)

    # 50/50 weight between look and style
    return 0.5 * look + 0.5 * style


def popularity_score(profile: TherapistProfile) -> float:
    """Compute popularity score from bookings, repeat rate, reviews, and price tier."""
    b = normalize_bookings(profile.total_bookings_30d)
    r = clamp01(profile.repeat_rate_30d)
    rev = normalize_review(profile.avg_review_score)
    tier = normalize_price_tier(profile.price_tier)

    raw = 0.4 * b + 0.3 * r + 0.2 * rev + 0.1 * tier
    return clamp01(raw) ** 0.5  # sqrt for smoother curve


def user_fit_score(intent: GuestIntent, profile: TherapistProfile) -> float:
    """Compute user fit score (affinity + popularity)."""
    aff = affinity_score(intent, profile)
    pop = popularity_score(profile)

    # Affinity 0.7, popularity 0.3
    return 0.7 * aff + 0.3 * pop


def newcomer_score(days_since_first_shift: int) -> float:
    """Compute newcomer boost score."""
    if days_since_first_shift <= 7:
        return 0.9
    if days_since_first_shift <= 30:
        return 0.6
    if days_since_first_shift <= 90:
        return 0.3
    return 0.1


def load_balance_score(utilization_7d: float) -> float:
    """Compute load balance score (inverse of utilization)."""
    return 1.0 - clamp01(utilization_7d)


def fairness_score(profile: TherapistProfile) -> float:
    """Compute fairness score (newcomer boost + load balance)."""
    newcomer = newcomer_score(profile.days_since_first_shift)
    load = load_balance_score(profile.utilization_7d)

    # 50/50 weight
    return 0.5 * newcomer + 0.5 * load


def availability_factor(availability_score: float) -> float:
    """Compute availability multiplier (0.9 to 1.05)."""
    a = clamp01(availability_score)
    min_factor = 0.9
    max_factor = 1.05

    return min_factor + (max_factor - min_factor) * a


def recommended_score(
    intent: GuestIntent,
    profile: TherapistProfile,
) -> float:
    """Compute final recommended score.

    This is the main scoring function that mirrors recommendedScore.ts.
    """
    user_fit = user_fit_score(intent, profile)
    fair = fairness_score(profile)
    avail_fac = availability_factor(profile.availability_score)

    # User fit 0.8, fairness 0.2
    base = 0.8 * user_fit + 0.2 * fair
    clamped_base = clamp01(base)

    return clamped_base * avail_fac


def recommended_score_with_breakdown(
    intent: GuestIntent,
    profile: TherapistProfile,
) -> ScoreBreakdown:
    """Compute recommended score with full breakdown for debugging/display."""
    aff = affinity_score(intent, profile)
    pop = popularity_score(profile)
    user_fit = 0.7 * aff + 0.3 * pop

    newcomer = newcomer_score(profile.days_since_first_shift)
    load = load_balance_score(profile.utilization_7d)
    fair = 0.5 * newcomer + 0.5 * load

    avail_fac = availability_factor(profile.availability_score)

    base = 0.8 * user_fit + 0.2 * fair
    final = clamp01(base) * avail_fac

    return ScoreBreakdown(
        affinity=aff,
        popularity=pop,
        user_fit=user_fit,
        newcomer=newcomer,
        load_balance=load,
        fairness=fair,
        availability_factor=avail_fac,
        final=final,
    )


# ---------------------------------------------------------------------------
# Legacy compatibility: _score_candidate adapter
# ---------------------------------------------------------------------------


def score_candidate_legacy(
    therapist_data: dict,
    guest_prefs: dict | None = None,
    *,
    core_score: float = 0.5,
    availability_score: float = 0.5,
) -> dict:
    """Score a therapist candidate using the new recommended scoring logic.

    This is a compatibility adapter that accepts dict inputs (as used by
    legacy code) and returns a dict with score and breakdown.

    Args:
        therapist_data: Dict with therapist profile fields
        guest_prefs: Dict with guest preferences
        core_score: Pre-computed core filter match score (area/time/price)
        availability_score: Pre-computed availability score (0-1)

    Returns:
        Dict with 'score' and 'breakdown' keys
    """
    guest_prefs = guest_prefs or {}

    intent = GuestIntent(
        area=guest_prefs.get("area"),
        visual_style_tags=guest_prefs.get("visual_style_tags")
        or guest_prefs.get("lookPref"),
        conversation_preference=guest_prefs.get("conversation_preference")
        or guest_prefs.get("talkPref"),
        massage_pressure_preference=guest_prefs.get("massage_pressure_preference"),
        mood_preference_tags=guest_prefs.get("mood_preference_tags")
        or guest_prefs.get("moodPref"),
    )

    profile = TherapistProfile(
        therapist_id=str(therapist_data.get("id", "")),
        visual_style_tags=therapist_data.get("visual_style_tags")
        or therapist_data.get("lookType"),
        conversation_style=therapist_data.get("conversation_style")
        or therapist_data.get("talkLevel"),
        massage_pressure=therapist_data.get("massage_pressure"),
        mood_tags=therapist_data.get("mood_tags") or therapist_data.get("moodTag"),
        total_bookings_30d=therapist_data.get("total_bookings_30d", 0),
        repeat_rate_30d=therapist_data.get("repeat_rate_30d", 0.0),
        avg_review_score=therapist_data.get("avg_review_score", 0.0),
        price_tier=therapist_data.get("price_tier", 1),
        days_since_first_shift=therapist_data.get("days_since_first_shift", 365),
        utilization_7d=therapist_data.get("utilization_7d", 0.0),
        availability_score=availability_score,
    )

    breakdown = recommended_score_with_breakdown(intent, profile)

    # Blend with legacy core_score for backward compatibility
    # core_score represents area/time/price filter match (0.4 weight in old system)
    # New recommended_score is based on style affinity + fairness
    # We combine them: 0.4 * core + 0.6 * recommended for smooth transition
    blended_score = 0.4 * clamp01(core_score) + 0.6 * breakdown.final

    return {
        "score": blended_score,
        "breakdown": {
            "core": core_score,
            "affinity": breakdown.affinity,
            "popularity": breakdown.popularity,
            "user_fit": breakdown.user_fit,
            "fairness": breakdown.fairness,
            "availability_factor": breakdown.availability_factor,
            "recommended": breakdown.final,
        },
    }


__all__ = [
    "GuestIntent",
    "TherapistProfile",
    "ScoreBreakdown",
    "clamp01",
    "recommended_score",
    "recommended_score_with_breakdown",
    "score_candidate_legacy",
    "affinity_score",
    "popularity_score",
    "fairness_score",
    "user_fit_score",
    "availability_factor",
]
