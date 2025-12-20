"""Scoring functions for therapist recommendations."""

from typing import Any

from .schemas import BreakdownInfo


def compute_price_rank(min_price: int | None, max_price: int | None) -> int | None:
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


def compute_recommended_score(
    therapist: Any,
    profile: Any,
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
