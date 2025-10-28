from __future__ import annotations

from collections import defaultdict
from typing import Optional, Iterable, Tuple, Any, List, Dict, Union, overload
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..schemas import REVIEW_ASPECT_KEYS

PRICE_BANDS: list[tuple[str, int, int | None, str]] = [
    ("under_10k", 0, 10000, "〜1万円"),
    ("10k_14k", 10000, 14000, "1.0〜1.4万円"),
    ("14k_18k", 14000, 18000, "1.4〜1.8万円"),
    ("18k_22k", 18000, 22000, "1.8〜2.2万円"),
    ("22k_plus", 22000, None, "2.2万円以上"),
]


def _compute_price_band(min_price: Optional[int], max_price: Optional[int]) -> tuple[str, str]:
    if min_price is None and max_price is None:
        return "unknown", "価格未設定"
    # prefer min price for banding; fall back to max if min missing
    base = min_price if (min_price is not None and min_price > 0) else max_price or 0
    for key, lower, upper, label in PRICE_BANDS:
        if upper is None and base >= lower:
            return key, label
        if lower <= base < (upper or lower):
            return key, label
    return PRICE_BANDS[0][0], PRICE_BANDS[0][3]


def _compute_ranking_score(
    profile: models.Profile,
    *,
    today: bool,
    review_score: Optional[float],
    review_count: Optional[int],
    promotions: list[dict[str, Any]],
    tag_score: float,
    ctr7d: float,
) -> float:
    base_weight = float(profile.ranking_weight or 0) * 10.0
    rating_boost = (review_score or 0.0) * 20.0
    review_boost = float(min(review_count or 0, 50))
    promotion_boost = 15.0 if promotions else 0.0
    today_boost = 10.0 if today else 0.0
    ctr_boost = min(max(ctr7d, 0.0) * 100.0, 40.0)
    tag_boost = min(max(tag_score, 0.0) * 10.0, 20.0)
    return base_weight + rating_boost + review_boost + promotion_boost + today_boost + ctr_boost + tag_boost


def _count_published_diaries(profile: models.Profile, contact_json: dict) -> int:
    try:
        diaries = getattr(profile, "diaries", []) or []
        published = [d for d in diaries if getattr(d, "status", None) == 'published']
        if published:
            return len(published)
    except Exception:
        pass

    raw = contact_json.get("diaries")
    if isinstance(raw, list):
        return len([entry for entry in raw if isinstance(entry, dict)])
    return 0

def _normalize_text(value: Any) -> Optional[str]:
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed or None
    if value is None:
        return None
    candidate = str(value).strip()
    return candidate or None


def _collect_staff_specialties(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    cleaned: list[str] = []
    for entry in raw:
        normalized = _normalize_text(entry)
        if normalized:
            cleaned.append(normalized)
    return cleaned



def _build_staff_preview(profile: models.Profile, contact_json: dict[str, Any]) -> list[dict[str, Any]]:
    """Serialize staff preview with therapist UUIDs when available."""
    therapists: list[models.Therapist] = []
    try:
        cached = profile.__dict__.get('therapists')
        if cached:
            therapists = list(cached or [])
    except Exception:
        therapists = []

    published = [t for t in therapists if getattr(t, 'status', None) == 'published']
    therapist_by_id: dict[str, models.Therapist] = {str(t.id): t for t in published}
    therapist_by_name: dict[str, list[models.Therapist]] = defaultdict(list)
    for therapist in published:
        key = (_normalize_text(therapist.name) or '').casefold()
        if key:
            therapist_by_name[key].append(therapist)

    raw_staff = contact_json.get('staff') if isinstance(contact_json, dict) else None
    contact_entries: list[dict[str, Any]] = []
    if isinstance(raw_staff, list):
        contact_entries = [entry for entry in raw_staff if isinstance(entry, dict)]

    preview: list[dict[str, Any]] = []
    used_ids: set[str] = set()

    for entry in contact_entries:
        name = _normalize_text(entry.get('name') or entry.get('staff_name'))
        if not name:
            continue
        alias = _normalize_text(entry.get('alias'))
        headline = _normalize_text(entry.get('headline'))
        avatar_url = _normalize_text(entry.get('avatar_url') or entry.get('photo_url') or entry.get('image'))
        rating = _safe_float(entry.get('rating'))
        review_count = _safe_int(entry.get('review_count'))
        specialties = _collect_staff_specialties(entry.get('specialties'))

        raw_id = entry.get('id')
        therapist_id = _normalize_text(raw_id) if raw_id is not None else None
        matched: Optional[models.Therapist] = None
        if therapist_id and therapist_id in therapist_by_id:
            matched = therapist_by_id[therapist_id]
        else:
            key = name.casefold()
            candidates = therapist_by_name.get(key, [])
            matched = next((candidate for candidate in candidates if str(candidate.id) not in used_ids), None)

        if matched:
            therapist_id = str(matched.id)
            used_ids.add(therapist_id)

        preview.append(
            {
                'id': therapist_id,
                'name': name,
                'alias': alias,
                'headline': headline,
                'rating': rating,
                'review_count': review_count,
                'avatar_url': avatar_url,
                'specialties': specialties,
            }
        )

    unmatched = [t for t in published if str(t.id) not in used_ids]
    for therapist in unmatched:
        specialties = _collect_staff_specialties(list(getattr(therapist, 'specialties', []) or []))
        photo_urls = list(getattr(therapist, 'photo_urls', []) or [])
        preview.append(
            {
                'id': str(therapist.id),
                'name': therapist.name,
                'alias': _normalize_text(therapist.alias),
                'headline': _normalize_text(therapist.headline),
                'rating': None,
                'review_count': None,
                'avatar_url': _normalize_text(photo_urls[0]) if photo_urls else None,
                'specialties': specialties,
            }
        )

    return preview


def _safe_int(v: object) -> Optional[int]:
    try:
        if v is None:
            return None
        return int(v)  # type: ignore[arg-type]
    except Exception:
        return None


def _safe_float(v: object) -> Optional[float]:
    try:
        if v is None:
            return None
        return float(v)  # type: ignore[arg-type]
    except Exception:
        return None


def normalize_review_aspects(raw: Any) -> dict[str, dict[str, Any]]:
    normalized: dict[str, dict[str, Any]] = {}
    if not isinstance(raw, dict):
        return normalized
    for key in REVIEW_ASPECT_KEYS:
        entry = raw.get(key)
        if not isinstance(entry, dict):
            continue
        score = _safe_int(entry.get("score") or entry.get("rating"))
        if score is None or score < 1 or score > 5:
            continue
        note_raw = entry.get("note") or entry.get("comment") or entry.get("text")
        note = None
        if isinstance(note_raw, str):
            note = note_raw.strip() or None
        normalized[key] = {"score": int(score), "note": note}
    return normalized


def _calculate_aspect_stats(score_map: Dict[str, list[int]]) -> tuple[dict[str, float], dict[str, int]]:
    averages: dict[str, float] = {}
    counts: dict[str, int] = {}
    for key, scores in score_map.items():
        valid = [s for s in scores if isinstance(s, (int, float))]
        if not valid:
            continue
        counts[key] = len(valid)
        averages[key] = round(sum(valid) / len(valid), 1)
    return averages, counts


def _extract_review_stats(
    reviews: Any,
) -> tuple[Optional[float], Optional[int], list[dict[str, Any]], dict[str, float], dict[str, int]]:
    average: Optional[float] = None
    count: Optional[int] = None
    items: list[dict[str, Any]] = []
    aspect_scores: Dict[str, list[int]] = defaultdict(list)

    if isinstance(reviews, dict):
        average = _safe_float(reviews.get("average_score") or reviews.get("score"))
        count = _safe_int(reviews.get("review_count") or reviews.get("count"))
        raw_items = reviews.get("highlighted") or reviews.get("reviews") or reviews.get("items")
        if isinstance(raw_items, list):
            items = [x for x in raw_items if isinstance(x, dict)]
    elif isinstance(reviews, list):
        items = [x for x in reviews if isinstance(x, dict)]

    if average is None and items:
        scores = [_safe_float(item.get("score") or item.get("rating")) for item in items]
        scores = [s for s in scores if s is not None]
        if scores:
            average = round(sum(scores) / len(scores), 1)

    if count is None and items:
        count = len(items)

    for item in items:
        normalized = normalize_review_aspects(item.get("aspects"))
        for key, entry in normalized.items():
            score = _safe_int(entry.get("score"))
            if score is None:
                continue
            aspect_scores[key].append(score)

    aspect_averages, aspect_counts = _calculate_aspect_stats(aspect_scores)
    return average, count, items, aspect_averages, aspect_counts


def _published_reviews(profile: models.Profile) -> list[models.Review]:
    try:
        reviews = list(getattr(profile, "reviews", []) or [])
    except Exception:
        return []
    return [r for r in reviews if getattr(r, "status", None) == 'published']


def _review_highlights(reviews: list[models.Review], limit: int = 3) -> list[dict[str, Any]]:
    sorted_reviews = sorted(
        reviews,
        key=lambda r: (r.visited_at or r.created_at, r.created_at),
        reverse=True,
    )[:limit]
    highlights: list[dict[str, Any]] = []
    for review in sorted_reviews:
        highlights.append(
            {
                "review_id": str(review.id),
                "title": review.title or review.body[:40],
                "body": review.body,
                "score": review.score,
                "visited_at": review.visited_at.isoformat() if review.visited_at else None,
                "author_alias": review.author_alias,
                "aspects": normalize_review_aspects(getattr(review, "aspect_scores", {})),
            }
        )
    return highlights


@overload
def compute_review_summary(
    profile: models.Profile,
    fallback_reviews: Any = None,
    *,
    highlight_limit: int = 3,
    include_aspects: Literal[True],
) -> tuple[Optional[float], Optional[int], list[dict[str, Any]], dict[str, float], dict[str, int]]:
    ...


@overload
def compute_review_summary(
    profile: models.Profile,
    fallback_reviews: Any = None,
    *,
    highlight_limit: int = 3,
    include_aspects: Literal[False] = False,
) -> tuple[Optional[float], Optional[int], list[dict[str, Any]]]:
    ...


def compute_review_summary(
    profile: models.Profile,
    fallback_reviews: Any = None,
    *,
    highlight_limit: int = 3,
    include_aspects: bool = False,
) -> Union[
    tuple[Optional[float], Optional[int], list[dict[str, Any]]],
    tuple[Optional[float], Optional[int], list[dict[str, Any]], dict[str, float], dict[str, int]],
]:
    published_reviews = _published_reviews(profile)
    if published_reviews:
        average = round(sum(r.score for r in published_reviews) / len(published_reviews), 1)
        count = len(published_reviews)
        highlights = _review_highlights(published_reviews, limit=highlight_limit)
        aspect_scores: Dict[str, list[int]] = defaultdict(list)
        for review in published_reviews:
            normalized = normalize_review_aspects(getattr(review, "aspect_scores", {}))
            for key, entry in normalized.items():
                score = _safe_int(entry.get("score"))
                if score is None:
                    continue
                aspect_scores[key].append(score)
        aspect_averages, aspect_counts = _calculate_aspect_stats(aspect_scores)
        if include_aspects:
            return average, count, highlights, aspect_averages, aspect_counts
        return average, count, highlights

    average, count, fallback_items, aspect_averages, aspect_counts = _extract_review_stats(fallback_reviews)
    highlights = fallback_items[:highlight_limit]
    if include_aspects:
        return average, count, highlights, aspect_averages, aspect_counts
    return average, count, highlights


def infer_height_age(profile: models.Profile) -> Tuple[Optional[int], Optional[int]]:
    """Prefer DB columns; fall back to contact_json integers.

    Returns (height_cm, age).
    """
    height_cm = getattr(profile, "height_cm", None)
    age = getattr(profile, "age", None)
    if height_cm is None or age is None:
        try:
            cj = profile.contact_json or {}
        except Exception:
            cj = {}
        if height_cm is None:
            height_cm = _safe_int(cj.get("height_cm"))
        if age is None:
            age = _safe_int(cj.get("age"))
    return height_cm, age


def infer_store_name(
    profile: models.Profile,
    outlinks: Optional[Iterable[models.Outlink]] = None,
) -> Optional[str]:
    """Determine store name.

    Priority:
    1) profile.contact_json.store_name
    2) domain from a 'web' outlink in provided outlinks
    3) domain from profile.contact_json.web
    """
    store_name: Optional[str] = None
    try:
        cj = profile.contact_json or {}
        store_name = cj.get("store_name")
    except Exception:
        store_name = None

    if store_name:
        return store_name

    # Try provided outlinks
    if outlinks:
        try:
            web = next((o for o in outlinks if getattr(o, "kind", None) == "web"), None)
        except Exception:
            web = None
        if web and getattr(web, "target_url", None):
            try:
                from urllib.parse import urlparse

                host = urlparse(web.target_url).hostname
                if host:
                    return host
            except Exception:
                pass

    # Fallback to contact_json.web
    try:
        from urllib.parse import urlparse

        cj = profile.contact_json or {}
        if isinstance(cj.get("web"), str):
            host = urlparse(cj["web"]).hostname
            if host:
                return host
    except Exception:
        pass

    return None


def build_profile_doc(
    profile: models.Profile,
    *,
    today: bool = False,
    tag_score: float = 0.0,
    ctr7d: float = 0.0,
    outlinks: Optional[Iterable[models.Outlink]] = None,
) -> dict:
    """Build a search document for Meilisearch based on a Profile model.

    Centralizes field normalization and derived attributes.
    """
    height_cm, age = infer_height_age(profile)
    store_name = infer_store_name(profile, outlinks)
    try:
        contact_json = profile.contact_json or {}
    except Exception:
        contact_json = {}

    promotions: list[dict[str, Any]] = []
    for source in (profile.discounts or [], contact_json.get("promotions")):
        if not isinstance(source, list):
            continue
        for entry in source:
            if not isinstance(entry, dict):
                continue
            label = entry.get("label") or entry.get("title")
            if not label:
                continue
            promotions.append(
                {
                    "label": label,
                    "description": entry.get("description") or entry.get("detail"),
                    "expires_at": entry.get("expires_at") or entry.get("until"),
                    "highlight": entry.get("highlight"),
                }
            )

    price_band_key, price_band_label = _compute_price_band(profile.price_min, profile.price_max)

    (
        review_score,
        review_count,
        review_highlights,
        review_aspect_averages,
        review_aspect_counts,
    ) = compute_review_summary(
        profile,
        contact_json.get("reviews"),
        highlight_limit=3,
        include_aspects=True,
    )
    ranking_reason = contact_json.get("ranking_reason") or contact_json.get("ranking_message")
    ranking_score = _compute_ranking_score(
        profile,
        today=today,
        review_score=review_score,
        review_count=review_count,
        promotions=promotions,
        tag_score=tag_score,
        ctr7d=ctr7d,
    )
    has_discounts = bool(profile.discounts)
    has_promotions = bool(promotions)
    diary_count = _count_published_diaries(profile, contact_json)
    staff_preview = _build_staff_preview(profile, contact_json)
    return {
        "id": str(profile.id),
        "slug": profile.slug,
        "name": profile.name,
        "area": profile.area,
        "nearest_station": profile.nearest_station,
        "station_line": profile.station_line,
        "station_exit": profile.station_exit,
        "station_walk_minutes": profile.station_walk_minutes,
        "latitude": profile.latitude,
        "longitude": profile.longitude,
        "price_min": profile.price_min,
        "price_max": profile.price_max,
        "bust_tag": profile.bust_tag,
        "service_type": profile.service_type,
        "store_name": store_name,
        "body_tags": profile.body_tags or [],
        "height_cm": height_cm,
        "age": age,
        "photos": profile.photos or [],
        "discounts": profile.discounts or [],
        "ranking_badges": profile.ranking_badges or [],
        "ranking_weight": profile.ranking_weight,
        "status": profile.status,
        "today": today,
        "tag_score": tag_score,
        "ctr7d": ctr7d,
        "updated_at": int((profile.updated_at or profile.created_at).timestamp()),
        "promotions": promotions,
        "review_score": review_score,
        "review_count": review_count,
        "review_highlights": review_highlights,
        "review_aspect_averages": review_aspect_averages,
        "review_aspect_counts": review_aspect_counts,
        "ranking_reason": ranking_reason,
        "staff_preview": staff_preview,
        "price_band": price_band_key,
        "price_band_label": price_band_label,
        "has_promotions": has_promotions,
        "has_discounts": has_discounts,
        "promotion_count": len(promotions),
        "ranking_score": ranking_score,
        "diary_count": diary_count,
        "has_diaries": diary_count > 0,
    }
