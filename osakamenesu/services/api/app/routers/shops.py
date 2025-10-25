from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone, date
from types import SimpleNamespace
from typing import Any, Dict, Iterable, List, Set
from uuid import UUID
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..db import get_session
from ..meili import search as meili_search, build_filter
from ..schemas import (
    AvailabilityCalendar,
    AvailabilityDay,
    AvailabilitySlot,
    ContactInfo,
    FacetValue,
    GeoLocation,
    HighlightedReview,
    MediaImage,
    MenuItem,
    Promotion,
    ReviewCreateRequest,
    REVIEW_ASPECT_KEYS,
    ReviewAspectScore,
    ReviewItem,
    ReviewListResponse,
    ReviewSummary,
    ShopStaffPreview,
    ShopDetail,
    ShopSearchResponse,
    ShopSummary,
    SocialLink,
    StaffSummary,
    DiarySnippet,
    DiaryItem,
    DiaryListResponse,
)
from ..utils.profiles import (
    build_profile_doc,
    infer_store_name,
    compute_review_summary,
    PRICE_BANDS,
    normalize_review_aspects,
)


logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/v1/shops", tags=["shops"])

__all__ = ("router", "serialize_review", "_prepare_aspect_scores")

PRICE_BAND_LABELS: Dict[str, str] = {key: label for key, *_rest, label in PRICE_BANDS}
PRICE_BAND_LABELS.setdefault("unknown", "価格未設定")
SERVICE_TYPE_LABELS: Dict[str, str] = {
    "store": "店舗型",
    "dispatch": "出張型",
}
BOOLEAN_FACET_LABELS: Dict[str, Dict[str, str]] = {
    "today": {"true": "本日空きあり"},
    "has_promotions": {"true": "割引・特典あり"},
    "has_discounts": {"true": "割引掲載あり"},
}

DEFAULT_SORT = ["ranking_score:desc", "review_score:desc", "updated_at:desc"]
SORT_ALIASES: Dict[str, List[str]] = {
    "recommended": DEFAULT_SORT,
    "rank": DEFAULT_SORT,
    "price_asc": ["price_min:asc"],
    "price_desc": ["price_min:desc"],
    "price_high": ["price_max:desc"],
    "rating": ["review_score:desc", "review_count:desc"],
    "new": ["updated_at:desc"],
    "updated": ["updated_at:desc"],
}


def serialize_review(review: models.Review) -> ReviewItem:
    aspects_raw = normalize_review_aspects(getattr(review, "aspect_scores", {}))
    aspects = {key: {k: v for k, v in value.items() if v is not None} for key, value in aspects_raw.items()}
    return ReviewItem(
        id=review.id,
        profile_id=review.profile_id,
        status=review.status,
        score=review.score,
        title=review.title,
        body=review.body,
        author_alias=review.author_alias,
        visited_at=review.visited_at,
        created_at=review.created_at,
        updated_at=review.updated_at,
        aspects={key: ReviewAspectScore(**value) for key, value in aspects_raw.items()},
    )


def _collect_review_aspect_stats(items: Iterable[ReviewItem]) -> tuple[Dict[str, float], Dict[str, int]]:
    aspect_scores: Dict[str, List[int]] = defaultdict(list)
    for item in items:
        for key, data in (item.aspects or {}).items():
            score: int | float | None = None
            if isinstance(data, ReviewAspectScore):
                score = data.score
            elif isinstance(data, dict):
                raw = data.get("score")
                if isinstance(raw, (int, float)):
                    score = raw
            if isinstance(score, (int, float)):
                aspect_scores[key].append(int(score))

    aspect_averages = {
        key: round(sum(values) / len(values), 1) for key, values in aspect_scores.items() if values
    }
    aspect_counts = {key: len(values) for key, values in aspect_scores.items() if values}
    return aspect_averages, aspect_counts


async def _collect_shop_review_aspect_stats(db: AsyncSession, profile_id: UUID) -> tuple[Dict[str, float], Dict[str, int]]:
    stmt = (
        select(models.Review.aspect_scores)
        .where(models.Review.profile_id == profile_id, models.Review.status == 'published')
    )
    result = await db.scalars(stmt)
    items = [
        SimpleNamespace(aspects=normalize_review_aspects(raw or {}))
        for raw in result
    ]
    return _collect_review_aspect_stats(items)


def _prepare_aspect_scores(aspects: Any) -> dict[str, Any]:
    if not aspects:
        return {}

    result: dict[str, Any] = {}
    items = None
    if isinstance(aspects, dict):
        items = aspects.items()
    else:
        try:
            items = aspects.items()
        except AttributeError:
            return {}

    for key, raw in items:
        if key not in REVIEW_ASPECT_KEYS:
            continue
        if isinstance(raw, ReviewAspectScore):
            data = raw.model_dump(exclude_none=True)
        else:
            normalized = normalize_review_aspects({key: raw} if isinstance(raw, dict) else {})
            data = normalized.get(key)
        if not data:
            continue
        score = data.get("score")
        if not isinstance(score, (int, float)):
            continue
        score_int = int(score)
        if score_int < 1 or score_int > 5:
            continue
        prepared = {"score": score_int}
        note = data.get("note")
        if isinstance(note, str) and note.strip():
            prepared["note"] = note.strip()
        result[key] = prepared
    return result


async def _count_published_diaries(db: AsyncSession, profile_id: UUID) -> int:
    stmt = (
        select(func.count())
        .select_from(models.Diary)
        .where(models.Diary.profile_id == profile_id, models.Diary.status == 'published')
    )
    result = await db.execute(stmt)
    return int(result.scalar_one())


async def _fetch_published_diaries(
    db: AsyncSession,
    profile_id: UUID,
    *,
    limit: int,
    offset: int,
) -> List[models.Diary]:
    stmt = (
        select(models.Diary)
        .where(models.Diary.profile_id == profile_id, models.Diary.status == 'published')
        .order_by(models.Diary.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


def _serialize_diary(diary: models.Diary) -> DiaryItem:
    photos = list(diary.photos or []) if isinstance(diary.photos, list) else []
    hashtags = list(diary.hashtags or []) if isinstance(diary.hashtags, list) else []
    return DiaryItem(
        id=diary.id,
        profile_id=diary.profile_id,
        title=diary.title,
        body=diary.text,
        photos=photos,
        hashtags=hashtags,
        created_at=diary.created_at,
    )


async def _fetch_published_reviews(
    db: AsyncSession,
    profile_id: UUID,
    *,
    limit: int | None = None,
    offset: int = 0,
) -> List[models.Review]:
    stmt = (
        select(models.Review)
        .where(models.Review.profile_id == profile_id, models.Review.status == 'published')
        .order_by(models.Review.visited_at.desc(), models.Review.created_at.desc())
        .offset(offset)
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    result = await db.scalars(stmt)
    return list(result)


async def _count_published_reviews(db: AsyncSession, profile_id: UUID) -> int:
    stmt = (
        select(func.count())
        .select_from(models.Review)
        .where(models.Review.profile_id == profile_id, models.Review.status == 'published')
    )
    result = await db.execute(stmt)
    return int(result.scalar_one())


def _unix_to_dt(ts: int | None) -> datetime | None:
    if ts is None:
        return None
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc)
    except Exception:
        return None


def _resolve_sort(sort: str | None) -> List[str]:
    if not sort:
        return DEFAULT_SORT
    if ":" in sort:
        return [sort]
    key = sort.lower()
    return SORT_ALIASES.get(key, DEFAULT_SORT)


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            try:
                if value.endswith('Z'):
                    return datetime.fromisoformat(value.replace('Z', '+00:00'))
            except Exception:
                return None
    return None


def _normalize_diary_entry(entry: Any) -> DiarySnippet | None:
    if not isinstance(entry, dict):
        return None
    body = entry.get("body") or entry.get("text")
    if body is None:
        return None
    title = entry.get("title") or entry.get("headline")
    photos_raw = entry.get("photos") or entry.get("images")
    photos = [str(p) for p in photos_raw if isinstance(p, (str, bytes))] if isinstance(photos_raw, list) else []
    hashtags_raw = entry.get("hashtags") or entry.get("tags")
    hashtags = [str(tag) for tag in hashtags_raw if isinstance(tag, (str, int))] if isinstance(hashtags_raw, list) else []
    published_at = _parse_datetime(entry.get("published_at") or entry.get("created_at") or entry.get("date"))
    diary_id = entry.get("id")
    snippet_id = None
    if diary_id:
        try:
            snippet_id = UUID(str(diary_id))
        except Exception:
            snippet_id = None
    return DiarySnippet(
        id=snippet_id,
        title=str(title) if title else None,
        body=str(body),
        photos=photos,
        hashtags=hashtags,
        published_at=published_at,
    )


def _diary_sort_key(snippet: DiarySnippet) -> float:
    if snippet.published_at is None:
        return 0.0
    try:
        return snippet.published_at.timestamp()
    except Exception:
        return 0.0


def _facet_label(name: str, value: str) -> str:
    if name == "price_band":
        return PRICE_BAND_LABELS.get(value, value)
    if name == "service_type":
        return SERVICE_TYPE_LABELS.get(value, value)
    if name in BOOLEAN_FACET_LABELS:
        return BOOLEAN_FACET_LABELS[name].get(value, value)
    if name == "today":
        return BOOLEAN_FACET_LABELS["today"].get(value, "本日空きあり" if value == "true" else value)
    return value


def _doc_to_shop_summary(doc: Dict[str, Any]) -> ShopSummary:
    first_photo = None
    photos = doc.get("photos") or []
    if isinstance(photos, list) and photos:
        first_photo = photos[0]
    promotions_raw = doc.get("promotions")
    promotions = _normalize_promotions(promotions_raw)
    review_score = doc.get("review_score")
    rating = review_score if review_score is not None else doc.get("rating")
    review_count = doc.get("review_count")
    return ShopSummary(
        id=UUID(doc["id"]),
        slug=doc.get("slug"),
        name=doc.get("name", ""),
        store_name=doc.get("store_name"),
        area=doc.get("area", ""),
        area_name=doc.get("area_name"),
        address=doc.get("address"),
        categories=list(doc.get("categories", []) or []),
        service_tags=list(doc.get("body_tags", []) or []),
        min_price=doc.get("price_min", 0) or 0,
        max_price=doc.get("price_max", 0) or 0,
        nearest_station=doc.get("nearest_station"),
        station_line=doc.get("station_line"),
        station_exit=doc.get("station_exit"),
        station_walk_minutes=doc.get("station_walk_minutes"),
        latitude=doc.get("latitude"),
        longitude=doc.get("longitude"),
        rating=rating,
        review_count=review_count,
        lead_image_url=first_photo,
        badges=list(doc.get("ranking_badges", []) or []),
        today_available=doc.get("today"),
        next_available_at=_unix_to_dt(doc.get("next_available_at")),
        distance_km=doc.get("distance_km"),
        online_reservation=doc.get("online_reservation"),
        updated_at=_unix_to_dt(doc.get("updated_at")),
        ranking_reason=doc.get("ranking_reason"),
        promotions=promotions,
        price_band=doc.get("price_band"),
        price_band_label=doc.get("price_band_label"),
        has_promotions=doc.get("has_promotions"),
        has_discounts=doc.get("has_discounts"),
        promotion_count=doc.get("promotion_count"),
        ranking_score=doc.get("ranking_score"),
        diary_count=doc.get("diary_count"),
        has_diaries=doc.get("has_diaries"),
        staff_preview=_normalize_staff_preview(doc.get("staff_preview")),
    )


def _build_facets(
    facet_distribution: Dict[str, Dict[str, int]] | None,
    selected: Dict[str, Set[str]] | None = None,
) -> Dict[str, List[FacetValue]]:
    if not facet_distribution:
        return {}
    response: Dict[str, List[FacetValue]] = {}
    selected = selected or {}
    for facet_name, values in facet_distribution.items():
        if not isinstance(values, dict):
            continue
        selected_values = selected.get(facet_name, set())
        response[facet_name] = [
            FacetValue(
                value=value_key,
                label=_facet_label(facet_name, value_key),
                count=count,
                selected=value_key in selected_values or None,
            )
            for value_key, count in values.items()
        ]
    return response


def _hydrate_contact(contact_json: Dict[str, Any] | None) -> ContactInfo | None:
    if not isinstance(contact_json, dict):
        return None
    sns_list = []
    raw_sns = contact_json.get("sns")
    if isinstance(raw_sns, list):
        for entry in raw_sns:
            if not isinstance(entry, dict):
                continue
            platform = entry.get("platform") or entry.get("name")
            url = entry.get("url")
            if not platform or not url:
                continue
            sns_list.append(SocialLink(platform=platform, url=url, label=entry.get("label")))
    return ContactInfo(
        phone=contact_json.get("phone"),
        line_id=contact_json.get("line_id") or contact_json.get("line"),
        website_url=contact_json.get("web") or contact_json.get("website_url"),
        reservation_form_url=contact_json.get("reservation_form_url"),
        sns=sns_list,
    )


def _hydrate_location(contact_json: Dict[str, Any] | None) -> GeoLocation | None:
    if not isinstance(contact_json, dict):
        return None
    lat = contact_json.get("latitude")
    lon = contact_json.get("longitude")
    nearest = contact_json.get("nearest_station") or contact_json.get("station")
    address = contact_json.get("address")
    if not any([lat, lon, nearest, address]):
        return None
    return GeoLocation(
        address=address,
        latitude=lat,
        longitude=lon,
        nearest_station=nearest,
    )


def _convert_slots(slots_json: Any) -> List[AvailabilitySlot]:
    slots: List[AvailabilitySlot] = []
    slot_items: Iterable[Any]
    if isinstance(slots_json, dict):
        slot_items = slots_json.get("slots") or slots_json.values()
    elif isinstance(slots_json, list):
        slot_items = slots_json
    else:
        slot_items = []
    for item in slot_items:
        if not isinstance(item, dict):
            continue
        start = item.get("start_at") or item.get("start")
        end = item.get("end_at") or item.get("end")
        status = item.get("status") or 'open'
        if not (start and end):
            continue
        try:
            start_dt = datetime.fromisoformat(start)
            end_dt = datetime.fromisoformat(end)
        except Exception:
            continue
        slots.append(
            AvailabilitySlot(
                start_at=start_dt,
                end_at=end_dt,
                status=status if status in {'open', 'tentative', 'blocked'} else 'open',
                staff_id=item.get("staff_id"),
                menu_id=item.get("menu_id"),
            )
        )
    return slots


def _slots_have_open(slots_json: Any) -> bool:
    if not slots_json:
        return False
    for slot in _convert_slots(slots_json):
        if slot.status == 'open' or slot.status is None:
            return True
    return False


def _uuid_from_seed(seed: str, value: str | None = None) -> UUID:
    if value:
        try:
            return UUID(value)
        except Exception:
            pass
    return uuid.uuid5(uuid.NAMESPACE_URL, seed)


def _normalize_menus(raw: Any, shop_id: UUID) -> List[MenuItem]:
    if not isinstance(raw, list):
        return []
    items: List[MenuItem] = []
    for idx, entry in enumerate(raw):
        if not isinstance(entry, dict):
            continue
        price = entry.get('price', 0)
        try:
            price_int = int(price)
        except Exception:
            price_int = 0
        menu_id = _uuid_from_seed(f"{shop_id}:menu:{entry.get('id') or entry.get('name') or idx}", entry.get('id'))
        items.append(MenuItem(
            id=menu_id,
            name=str(entry.get('name') or f"メニュー{idx + 1}"),
            description=entry.get('description'),
            duration_minutes=entry.get('duration_minutes') or entry.get('duration'),
            price=price_int,
            currency=entry.get('currency') or 'JPY',
            is_reservable_online=entry.get('is_reservable_online', True),
            tags=[str(tag) for tag in (entry.get('tags') or [])],
        ))
    return items


def _normalize_staff(raw: Any, shop_id: UUID) -> List[StaffSummary]:
    if not isinstance(raw, list):
        return []
    members: List[StaffSummary] = []
    for idx, entry in enumerate(raw):
        if not isinstance(entry, dict):
            continue
        staff_id = _uuid_from_seed(f"{shop_id}:staff:{entry.get('id') or entry.get('name') or idx}", entry.get('id'))
        members.append(StaffSummary(
            id=staff_id,
            name=str(entry.get('name') or f"スタッフ{idx + 1}"),
            alias=entry.get('alias'),
            avatar_url=entry.get('avatar_url'),
            headline=entry.get('headline'),
            rating=entry.get('rating'),
            review_count=entry.get('review_count'),
            specialties=[str(tag) for tag in (entry.get('specialties') or [])],
        ))
    return members


def _safe_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except Exception:
        return None


def _safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def _normalize_date_string(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return None


def _parse_review_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
            try:
                return datetime.strptime(value, fmt).date()
            except Exception:
                continue
        try:
            return datetime.fromisoformat(value).date()
        except Exception:
            return None
    return None


def _normalize_promotions(*sources: Any) -> List[Promotion]:
    promotions: List[Promotion] = []
    seen: Set[tuple[str, str | None, str | None]] = set()
    for source in sources:
        if not isinstance(source, list):
            continue
        for entry in source:
            if not isinstance(entry, dict):
                continue
            label_raw = entry.get("label") or entry.get("title") or entry.get("name")
            if not label_raw:
                continue
            label = str(label_raw).strip()
            if not label:
                continue
            description = entry.get("description") or entry.get("detail")
            expires_at = _normalize_date_string(entry.get("expires_at") or entry.get("until"))
            key = (label, description, expires_at)
            if key in seen:
                continue
            seen.add(key)
            promotions.append(
                Promotion(
                    label=label,
                    description=str(description) if description else None,
                    expires_at=expires_at,
                    highlight=entry.get("highlight"),
                )
            )
    return promotions


def _normalize_staff_preview(raw: Any) -> List[schemas.ShopStaffPreview]:
    previews: List[ShopStaffPreview] = []
    if not isinstance(raw, list):
        return previews
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        name_raw = entry.get("name")
        if not name_raw:
            continue
        name = str(name_raw).strip()
        if not name:
            continue
        specialties_raw = entry.get("specialties")
        if isinstance(specialties_raw, list):
            specialties = [str(tag).strip() for tag in specialties_raw if str(tag).strip()]
        else:
            specialties = []
        previews.append(
            ShopStaffPreview(
                id=(str(entry.get("id")).strip() or None) if entry.get("id") is not None else None,
                name=name,
                alias=(str(entry.get("alias")).strip() or None) if entry.get("alias") is not None else None,
                headline=(str(entry.get("headline")).strip() or None) if entry.get("headline") is not None else None,
                rating=_safe_float(entry.get("rating")),
                review_count=_safe_int(entry.get("review_count")),
                avatar_url=(str(entry.get("avatar_url")).strip() or None) if entry.get("avatar_url") is not None else None,
                specialties=specialties,
            )
        )
    return previews


def _normalize_reviews(
    raw: Any,
    aspect_averages: Dict[str, float] | None = None,
    aspect_counts: Dict[str, int] | None = None,
) -> ReviewSummary:
    if raw is None:
        return ReviewSummary()

    highlighted: List[HighlightedReview] = []
    average_score: float | None = None
    review_count: int | None = None
    items: List[dict[str, Any]] = []

    if isinstance(raw, dict):
        average_score = _safe_float(raw.get("average_score") or raw.get("score"))
        review_count = _safe_int(raw.get("review_count") or raw.get("count"))
        extra = raw.get("highlighted") or raw.get("reviews") or raw.get("items") or []
        if isinstance(extra, list):
            items = [x for x in extra if isinstance(x, dict)]
    elif isinstance(raw, list):
        items = [x for x in raw if isinstance(x, dict)]

    for entry in items:
        review_id_raw = entry.get("id") or entry.get("review_id")
        review_id: UUID | None = None
        if review_id_raw:
            try:
                review_id = UUID(str(review_id_raw))
            except Exception:
                review_id = None
        title = str(entry.get("title") or entry.get("headline") or entry.get("summary") or "口コミ")
        body = str(entry.get("body") or entry.get("text") or entry.get("comment") or "")
        score = _safe_int(entry.get("score") or entry.get("rating")) or 0
        visited_at = _parse_review_date(entry.get("visited_at") or entry.get("visited_on"))
        author_alias = entry.get("author_alias") or entry.get("author") or entry.get("user")
        aspects_raw = normalize_review_aspects(entry.get("aspects"))
        aspects = {key: ReviewAspectScore(**value) for key, value in aspects_raw.items()}
        highlighted.append(
            HighlightedReview(
                review_id=review_id,
                title=title,
                body=body,
                score=score,
                visited_at=visited_at,
                author_alias=str(author_alias) if author_alias else None,
                aspects=aspects,
            )
        )

    if average_score is None and highlighted:
        scores = [h.score for h in highlighted if isinstance(h.score, int)]
        if scores:
            average_score = round(sum(scores) / len(scores), 1)

    if review_count is None:
        review_count = len(highlighted) if highlighted else None

    # Aggregate fallback from raw payload if explicit aggregates not provided
    normalized_aspect_averages: Dict[str, float] = {}
    if aspect_averages:
        for key, value in aspect_averages.items():
            val = _safe_float(value)
            if val is not None:
                normalized_aspect_averages[key] = val
    elif isinstance(raw, dict):
        raw_avgs = raw.get("aspect_averages") or raw.get("aspectAvg")
        if isinstance(raw_avgs, dict):
            for key, value in raw_avgs.items():
                val = _safe_float(value)
                if val is not None:
                    normalized_aspect_averages[key] = val

    normalized_aspect_counts: Dict[str, int] = {}
    if aspect_counts:
        for key, value in aspect_counts.items():
            val = _safe_int(value)
            if val is not None:
                normalized_aspect_counts[key] = val
    elif isinstance(raw, dict):
        raw_counts = raw.get("aspect_counts") or raw.get("aspectCounts")
        if isinstance(raw_counts, dict):
            for key, value in raw_counts.items():
                val = _safe_int(value)
                if val is not None:
                    normalized_aspect_counts[key] = val

    return ReviewSummary(
        average_score=average_score,
        review_count=review_count,
        highlighted=highlighted,
        aspect_averages=normalized_aspect_averages,
        aspect_counts=normalized_aspect_counts,
    )

async def _fetch_availability(
    db: AsyncSession, shop_id: UUID, start_date: date | None = None, end_date: date | None = None
) -> AvailabilityCalendar | None:
    stmt = (
        select(models.Availability)
        .where(models.Availability.profile_id == shop_id)
        .order_by(models.Availability.date.asc())
    )
    if start_date:
        stmt = stmt.where(models.Availability.date >= start_date)
    if end_date:
        stmt = stmt.where(models.Availability.date <= end_date)

    result = await db.execute(stmt)
    records = list(result.scalars().all())
    if not records:
        return None

    days: List[AvailabilityDay] = []
    today = date.today()
    for record in records:
        slots = _convert_slots(record.slots_json)
        days.append(
            AvailabilityDay(
                date=record.date,
                is_today=record.date == today,
                slots=slots,
            )
        )
    return AvailabilityCalendar(
        shop_id=shop_id,
        generated_at=datetime.now(timezone.utc),
        days=days,
    )


async def _filter_results_by_availability(
    db: AsyncSession, shops: List[ShopSummary], target_date: date
) -> List[ShopSummary]:
    if not shops:
        return []
    shop_ids = [shop.id for shop in shops]
    stmt = (
        select(models.Availability.profile_id, models.Availability.slots_json)
        .where(models.Availability.profile_id.in_(shop_ids))
        .where(models.Availability.date == target_date)
    )
    res = await db.execute(stmt)
    rows = res.all()
    eligible: Set[UUID] = set()
    for profile_id, slots_json in rows:
        if _slots_have_open(slots_json):
            eligible.add(profile_id)
    return [shop for shop in shops if shop.id in eligible]


@router.get("")
async def search_shops(
    q: str | None = Query(default=None, description="Free text query"),
    area: str | None = Query(default=None, description="Area code filter"),
    station: str | None = Query(default=None, description="Nearest station filter"),
    category: str | None = Query(default=None, description="Service category"),
    service_tags: str | None = Query(default=None, description="Comma separated service tags"),
    price_min: int | None = Query(default=None, ge=0),
    price_max: int | None = Query(default=None, ge=0),
    available_date: date | None = Query(default=None, description="Required availability date"),
    open_now: bool | None = Query(default=None),
    price_band: str | None = Query(default=None, description="Comma separated price band keys"),
    ranking_badges_param: str | None = Query(default=None, description="Comma separated ranking badge keys"),
    promotions_only: bool | None = Query(default=None, description="Filter shops with promotions"),
    discounts_only: bool | None = Query(default=None, description="Filter shops with discounts"),
    diaries_only: bool | None = Query(default=None, description="Filter shops with published diaries"),
    sort: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=50),
    db: AsyncSession = Depends(get_session),
):
    # Map request filters to existing Meilisearch document structure
    body_tags = [tag.strip() for tag in (service_tags or "").split(",") if tag.strip()]
    price_bands = [band.strip() for band in (price_band or "").split(",") if band.strip()]
    ranking_badges = [badge.strip() for badge in (ranking_badges_param or "").split(",") if badge.strip()]
    filter_expr = build_filter(
        area,
        station,
        bust=None,
        service_type=category,
        body_tags=body_tags or None,
        today=open_now,
        price_min=price_min,
        price_max=price_max,
        status='published',
        price_bands=price_bands or None,
        ranking_badges=ranking_badges or None,
        has_promotions=promotions_only,
        has_discounts=discounts_only,
        has_diaries=diaries_only,
    )
    sort_expr = _resolve_sort(sort)
    try:
        res = meili_search(
            q,
            filter_expr,
            sort_expr,
            page,
            page_size,
            facets=[
                "area",
                "nearest_station",
                "station_line",
                "service_type",
                "body_tags",
                "today",
                "price_band",
                "ranking_badges",
                "has_promotions",
                "has_discounts",
                "has_diaries",
            ],
        )
    except Exception:
        logger.exception(
            "failed to query meilisearch",
            extra={
                "query": q,
                "filter": filter_expr,
                "sort": sort_expr,
                "page": page,
                "page_size": page_size,
            },
        )
        empty = ShopSearchResponse(
            page=page,
            page_size=page_size,
            total=0,
            results=[],
            facets={},
        ).model_dump()
        empty["_error"] = "search temporarily unavailable"
        return empty
    hits = res.get("hits", [])
    results = [_doc_to_shop_summary(doc) for doc in hits]

    if available_date:
        results = await _filter_results_by_availability(db, results, available_date)

    selected_facets: Dict[str, Set[str]] = {}
    if area:
        selected_facets["area"] = {area}
    if station:
        selected_facets["nearest_station"] = {station}
    if category:
        selected_facets["service_type"] = {category}
    if body_tags:
        selected_facets["body_tags"] = set(body_tags)
    if open_now is not None:
        selected_facets["today"] = {"true" if open_now else "false"}
    if price_bands:
        selected_facets["price_band"] = set(price_bands)
    if ranking_badges:
        selected_facets["ranking_badges"] = set(ranking_badges)
    if promotions_only is not None:
        selected_facets["has_promotions"] = {"true" if promotions_only else "false"}
    if discounts_only is not None:
        selected_facets["has_discounts"] = {"true" if discounts_only else "false"}
    if diaries_only is not None:
        selected_facets["has_diaries"] = {"true" if diaries_only else "false"}

    response = ShopSearchResponse(
        page=page,
        page_size=page_size,
        total=len(results) if available_date else res.get("estimatedTotalHits", 0),
        results=results,
        facets=_build_facets(res.get("facetDistribution"), selected_facets),
    )
    return response.model_dump()


@router.get("/{shop_id}")
async def get_shop_detail(shop_id: str, db: AsyncSession = Depends(get_session)):
    profile = None
    try:
        profile_uuid = uuid.UUID(shop_id)
    except ValueError:
        profile = await db.scalar(select(models.Profile).where(models.Profile.slug == shop_id))
        if not profile:
            profile = await db.scalar(select(models.Profile).where(models.Profile.name == shop_id))
    else:
        profile = await db.get(models.Profile, profile_uuid)

    if not profile:
        raise HTTPException(status_code=404, detail="shop not found")

    contact_data = profile.contact_json if isinstance(profile.contact_json, dict) else {}
    contact = _hydrate_contact(contact_data)
    location = _hydrate_location(contact_data)

    lead_image = profile.photos[0] if profile.photos else None
    doc = build_profile_doc(profile)
    menus = _normalize_menus(contact_data.get("menus"), profile.id)
    staff_members = _normalize_staff(contact_data.get("staff"), profile.id)
    service_tags = contact_data.get("service_tags") if isinstance(contact_data.get("service_tags"), list) else profile.body_tags or []
    promotions = _normalize_promotions(profile.discounts or [], contact_data.get("promotions"))
    try:
        await db.refresh(profile, attribute_names=["reviews", "diaries"])
    except Exception:
        await db.refresh(profile, attribute_names=["reviews"])
    (
        review_avg,
        review_count,
        review_highlights,
        review_aspect_averages,
        review_aspect_counts,
    ) = compute_review_summary(
        profile,
        contact_data.get("reviews"),
        highlight_limit=3,
        include_aspects=True,
    )
    review_summary = _normalize_reviews(
        review_highlights,
        aspect_averages=review_aspect_averages,
        aspect_counts=review_aspect_counts,
    )
    ranking_reason = contact_data.get("ranking_reason") or doc.get("ranking_reason")

    diary_snippets: List[DiarySnippet] = []
    try:
        for diary in getattr(profile, "diaries", []) or []:
            if getattr(diary, "status", None) != 'published':
                continue
            diary_snippets.append(
                DiarySnippet(
                    id=diary.id,
                    title=diary.title,
                    body=diary.text,
                    photos=list(diary.photos or []),
                    hashtags=list(diary.hashtags or []),
                    published_at=diary.created_at,
                )
            )
    except Exception:
        pass

    if not diary_snippets:
        raw_diaries = contact_data.get("diaries")
        if isinstance(raw_diaries, list):
            for entry in raw_diaries:
                snippet = _normalize_diary_entry(entry)
                if snippet:
                    diary_snippets.append(snippet)

    diary_snippets.sort(key=_diary_sort_key, reverse=True)
    diary_snippets = diary_snippets[:5]

    if review_avg is not None:
        review_summary.average_score = review_avg
    elif review_summary.average_score is None:
        review_summary.average_score = _safe_float(doc.get("review_score"))

    if review_count is not None:
        review_summary.review_count = review_count
    elif review_summary.review_count is None:
        review_summary.review_count = _safe_int(doc.get("review_count"))

    if not review_summary.aspect_averages:
        doc_aspect_averages = doc.get("review_aspect_averages")
        if isinstance(doc_aspect_averages, dict):
            review_summary.aspect_averages = {
                key: _safe_float(value)
                for key, value in doc_aspect_averages.items()
                if _safe_float(value) is not None
            }

    if not review_summary.aspect_counts:
        doc_aspect_counts = doc.get("review_aspect_counts")
        if isinstance(doc_aspect_counts, dict):
            review_summary.aspect_counts = {
                key: _safe_int(value) or 0 for key, value in doc_aspect_counts.items() if _safe_int(value) is not None
            }

    metadata = {"store_name": infer_store_name(profile)}
    if ranking_reason:
        metadata["ranking_reason"] = ranking_reason
    metadata["promotion_count"] = len(promotions)
    metadata["diary_count"] = doc.get("diary_count") or len(diary_snippets)

    shop_summary = ShopDetail(
        id=profile.id,
        slug=profile.slug,
        name=profile.name,
        area=profile.area,
        area_name=profile.area,
        address=contact_data.get("address"),
        categories=[],
        service_tags=service_tags,
        min_price=profile.price_min,
        max_price=profile.price_max,
        rating=review_summary.average_score,
        review_count=review_summary.review_count,
        lead_image_url=lead_image,
        badges=profile.ranking_badges or [],
        today_available=doc.get("today", False),
        next_available_at=None,
        distance_km=None,
        online_reservation=True if contact and contact.reservation_form_url else None,
        updated_at=_unix_to_dt(doc.get("updated_at")),
        description=contact_data.get("description"),
        catch_copy=contact_data.get("catch_copy"),
        photos=[MediaImage(url=photo) for photo in (profile.photos or [])],
        contact=contact,
        location=location,
        menus=menus,
        staff=staff_members,
        availability_calendar=None,
        reviews=review_summary,
        promotions=promotions,
        ranking_reason=str(ranking_reason) if ranking_reason else None,
        metadata=metadata,
        diary_count=doc.get("diary_count") or len(diary_snippets),
        has_diaries=(doc.get("diary_count") or len(diary_snippets)) > 0,
        diaries=diary_snippets,
    )

    availability = await _fetch_availability(db, profile.id)
    if availability:
        shop_summary.availability_calendar = availability

    return shop_summary.model_dump()


@router.get("/{shop_id}/diaries", response_model=DiaryListResponse)
async def list_shop_diaries(
    shop_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=6, ge=1, le=20),
    db: AsyncSession = Depends(get_session),
):
    profile = await db.get(models.Profile, shop_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop not found")

    total = await _count_published_diaries(db, shop_id)
    if total == 0:
        return DiaryListResponse(total=0, items=[])

    offset = (page - 1) * page_size
    diaries = await _fetch_published_diaries(db, shop_id, limit=page_size, offset=offset)
    items = [_serialize_diary(diary) for diary in diaries]
    return DiaryListResponse(total=total, items=items)


@router.get("/{shop_id}/availability")
async def get_shop_availability(
    shop_id: UUID,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: AsyncSession = Depends(get_session),
):
    profile = await db.get(models.Profile, shop_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop not found")

    availability = await _fetch_availability(db, shop_id, start_date=date_from, end_date=date_to)
    if not availability:
        raise HTTPException(status_code=404, detail="availability not found")
    return availability.model_dump()


@router.get("/{shop_id}/reviews", response_model=ReviewListResponse)
async def list_shop_reviews(
    shop_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_session),
):
    profile = await db.get(models.Profile, shop_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop not found")

    total = await _count_published_reviews(db, shop_id)
    offset = (page - 1) * page_size
    reviews = await _fetch_published_reviews(db, shop_id, limit=page_size, offset=offset)
    items = [serialize_review(r) for r in reviews]
    if total:
        aspect_averages, aspect_counts = await _collect_shop_review_aspect_stats(db, shop_id)
    else:
        aspect_averages, aspect_counts = {}, {}
    return ReviewListResponse(
        total=total,
        items=items,
        aspect_averages=aspect_averages,
        aspect_counts=aspect_counts,
    )


@router.post("/{shop_id}/reviews", response_model=ReviewItem, status_code=status.HTTP_201_CREATED)
async def create_shop_review(
    shop_id: UUID,
    payload: ReviewCreateRequest,
    db: AsyncSession = Depends(get_session),
):
    profile = await db.get(models.Profile, shop_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop not found")

    review = models.Review(
        profile_id=profile.id,
        score=payload.score,
        title=payload.title,
        body=payload.body,
        author_alias=payload.author_alias,
        visited_at=payload.visited_at,
        status='pending',
        aspect_scores=_prepare_aspect_scores(payload.aspects),
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return serialize_review(review)
