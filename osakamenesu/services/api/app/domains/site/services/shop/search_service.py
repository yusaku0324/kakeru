from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Set
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.meili import build_filter, search as meili_search
from app.schemas import FacetValue, ShopSearchResponse, ShopStaffPreview, ShopSummary
from app.utils.profiles import PRICE_BANDS
from .availability import get_next_available_slots, slots_have_open
from .shared import normalize_promotions, normalize_staff_uuid, safe_float, safe_int

logger = logging.getLogger(__name__)

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

BUST_ORDER = [chr(code) for code in range(ord("A"), ord("Z") + 1)]
STYLE_IGNORE_VALUES = {"指定なし", "すべて", "全て", "", None}


def _expand_bust_range(min_tag: str | None, max_tag: str | None) -> list[str] | None:
    if not min_tag and not max_tag:
        return None

    try:
        min_index = BUST_ORDER.index((min_tag or "A").upper())
    except ValueError:
        min_index = 0
    try:
        max_index = BUST_ORDER.index((max_tag or "Z").upper())
    except ValueError:
        max_index = len(BUST_ORDER) - 1

    if min_index > max_index:
        min_index, max_index = max_index, min_index

    return BUST_ORDER[min_index : max_index + 1]


def _normalize_style_filter(value: str | None) -> str | None:
    if value is None:
        return None
    candidate = value.strip()
    if candidate in STYLE_IGNORE_VALUES:
        return None
    return candidate


def _facet_label(name: str, value: str) -> str:
    if name == "price_band":
        return PRICE_BAND_LABELS.get(value, value)
    if name == "service_type":
        return SERVICE_TYPE_LABELS.get(value, value)
    if name in BOOLEAN_FACET_LABELS:
        return BOOLEAN_FACET_LABELS[name].get(value, value)
    if name == "today":
        return BOOLEAN_FACET_LABELS["today"].get(
            value, "本日空きあり" if value == "true" else value
        )
    return value


def _normalize_staff_preview(raw: Any) -> List[ShopStaffPreview]:
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
            specialties = [
                str(tag).strip() for tag in specialties_raw if str(tag).strip()
            ]
        else:
            specialties = []
        previews.append(
            ShopStaffPreview(
                id=(str(entry.get("id")).strip() or None)
                if entry.get("id") is not None
                else None,
                name=name,
                alias=(str(entry.get("alias")).strip() or None)
                if entry.get("alias") is not None
                else None,
                headline=(str(entry.get("headline")).strip() or None)
                if entry.get("headline") is not None
                else None,
                rating=safe_float(entry.get("rating")),
                review_count=safe_int(entry.get("review_count")),
                avatar_url=(str(entry.get("avatar_url")).strip() or None)
                if entry.get("avatar_url") is not None
                else None,
                specialties=specialties,
            )
        )
    return previews


def _doc_to_shop_summary(doc: Dict[str, Any]) -> ShopSummary:
    first_photo = None
    photos = doc.get("photos") or []
    if isinstance(photos, list) and photos:
        first_photo = photos[0]
    promotions_raw = doc.get("promotions")
    promotions = normalize_promotions(promotions_raw)
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
        next_available_at=None,
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


def _unix_to_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.fromtimestamp(float(value))
    except Exception:
        return None


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
        if slots_have_open(slots_json):
            eligible.add(profile_id)
    return [shop for shop in shops if shop.id in eligible]


async def _search_shops_impl(
    db: AsyncSession,
    *,
    q: str | None = None,
    area: str | None = None,
    station: str | None = None,
    category: str | None = None,
    service_tags: str | None = None,
    price_min: int | None = None,
    price_max: int | None = None,
    available_date: date | None = None,
    open_now: bool | None = None,
    price_band: str | None = None,
    ranking_badges_param: str | None = None,
    promotions_only: bool | None = None,
    discounts_only: bool | None = None,
    diaries_only: bool | None = None,
    bust_min: str | None = None,
    bust_max: str | None = None,
    age_min: int | None = None,
    age_max: int | None = None,
    height_min: int | None = None,
    height_max: int | None = None,
    hair_color: str | None = None,
    hair_style: str | None = None,
    body_shape: str | None = None,
    sort: str | None = None,
    page: int = 1,
    page_size: int = 12,
):
    base_body_tags = [
        tag.strip() for tag in (service_tags or "").split(",") if tag.strip()
    ]
    style_tags: list[str] = []
    for raw in (hair_color, hair_style, body_shape):
        normalized = _normalize_style_filter(raw)
        if normalized:
            style_tags.append(normalized)

    body_tags_combined: list[str] = []
    seen_tags: set[str] = set()
    for tag in base_body_tags + style_tags:
        if tag not in seen_tags:
            body_tags_combined.append(tag)
            seen_tags.add(tag)

    price_bands = [
        band.strip() for band in (price_band or "").split(",") if band.strip()
    ]
    ranking_badges = [
        badge.strip()
        for badge in (ranking_badges_param or "").split(",")
        if badge.strip()
    ]
    bust_tags = _expand_bust_range(bust_min, bust_max)

    age_min_value = age_min
    age_max_value = age_max
    if (
        isinstance(age_min_value, int)
        and isinstance(age_max_value, int)
        and age_min_value > age_max_value
    ):
        age_min_value, age_max_value = age_max_value, age_min_value

    height_min_value = height_min
    height_max_value = height_max
    if (
        isinstance(height_min_value, int)
        and isinstance(height_max_value, int)
        and height_min_value > height_max_value
    ):
        height_min_value, height_max_value = height_max_value, height_min_value

    filter_expr = build_filter(
        area,
        station,
        bust=None,
        service_type=category,
        body_tags=body_tags_combined or None,
        today=open_now,
        price_min=price_min,
        price_max=price_max,
        status="published",
        price_bands=price_bands or None,
        ranking_badges=ranking_badges or None,
        has_promotions=promotions_only,
        has_discounts=discounts_only,
        has_diaries=diaries_only,
        bust_tags=bust_tags,
        age_min=age_min_value,
        age_max=age_max_value,
        height_min=height_min_value,
        height_max=height_max_value,
    )
    sort_orders = (
        SORT_ALIASES.get((sort or "").lower()) or [sort] if sort else DEFAULT_SORT
    )

    params = {
        "q": q,
        "limit": page_size,
        "offset": (page - 1) * page_size,
        "sort": sort_orders,
        "filter": filter_expr or None,
        "facets": [
            "area",
            "nearest_station",
            "service_type",
            "price_band",
            "body_tags",
            "ranking_badges",
            "has_promotions",
            "has_discounts",
            "has_diaries",
            "today",
        ],
    }
    res = await meili_search("profiles", params)
    if isinstance(res, Exception):
        logger.exception("shop search failed")
        empty = ShopSearchResponse(
            page=page, page_size=page_size, total=0, results=[], facets={}
        )
        return empty.model_dump()
    hits = res.get("hits", [])
    results = [_doc_to_shop_summary(doc) for doc in hits]

    if available_date:
        results = await _filter_results_by_availability(db, results, available_date)

    if results:
        shop_slots, staff_slots = await get_next_available_slots(
            db, [shop.id for shop in results]
        )
        if shop_slots or staff_slots:
            for shop in results:
                slot = shop_slots.get(shop.id)
                if slot:
                    shop.next_available_slot = slot
                    if shop.next_available_at is None:
                        shop.next_available_at = slot.start_at
                if staff_slots and shop.staff_preview:
                    for member in shop.staff_preview:
                        staff_uuid = normalize_staff_uuid(member.id)
                        if not staff_uuid:
                            continue
                        staff_slot = staff_slots.get(staff_uuid)
                        if staff_slot:
                            member.next_available_slot = staff_slot
                            if member.next_available_at is None:
                                member.next_available_at = staff_slot.start_at

    selected_facets: Dict[str, Set[str]] = {}
    if area:
        selected_facets["area"] = {area}
    if station:
        selected_facets["nearest_station"] = {station}
    if category:
        selected_facets["service_type"] = {category}
    if body_tags_combined:
        selected_facets["body_tags"] = set(body_tags_combined)
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


class ShopSearchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def search(self, **params: Any) -> Dict[str, Any]:
        return await _search_shops_impl(self.db, **params)


__all__ = ["ShopSearchService"]
