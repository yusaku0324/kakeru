from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, Iterable, List, Set
from uuid import UUID

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.meili import build_filter, search as meili_search
from app.schemas import (
    FacetValue,
    NextAvailableSlot,
    ShopSearchResponse,
    ShopStaffPreview,
    ShopSummary,
)
from app.utils.datetime import JST, now_jst
from app.utils.profiles import PRICE_BANDS
from .availability import slots_have_open
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
        # Parse today_available
        today_available_raw = entry.get("today_available")
        today_available = None
        if today_available_raw is not None:
            if isinstance(today_available_raw, bool):
                today_available = today_available_raw
            elif isinstance(today_available_raw, str):
                today_available = today_available_raw.lower() in ("true", "1", "yes")
        # Parse next_available_at
        next_available_at_raw = entry.get("next_available_at")
        next_available_at = None
        if next_available_at_raw is not None:
            if isinstance(next_available_at_raw, datetime):
                next_available_at = next_available_at_raw
            elif isinstance(next_available_at_raw, str):
                try:
                    next_available_at = datetime.fromisoformat(
                        next_available_at_raw.replace("Z", "+00:00")
                    )
                except (ValueError, TypeError):
                    pass
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
                today_available=today_available,
                next_available_at=next_available_at,
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


def _compute_price_band(price_min: int | None) -> str | None:
    """Compute price band from minimum price."""
    if price_min is None:
        return None
    # Price bands based on PRICE_BANDS constant
    if price_min < 5000:
        return "budget"
    elif price_min < 10000:
        return "economy"
    elif price_min < 15000:
        return "standard"
    elif price_min < 20000:
        return "premium"
    else:
        return "luxury"


async def _derive_next_availability_from_slots_sot(
    db: AsyncSession,
    therapist_ids: Iterable[UUID],
    *,
    lookahead_days: int = 14,
) -> dict[UUID, tuple[bool, NextAvailableSlot | None]]:
    """Derive today_available / next_available_slot from the guest availability SoT.

    Contract:
    - If next_available_slot is not None, it must correspond to the earliest slot returned by
      `/api/guest/therapists/{id}/availability_slots` within the lookahead range.
    - If there is no availability in the lookahead range, next_available_slot must be None and
      next_available_at must be null in responses (no stale cache leakage).
    """
    # Import locally to keep module deps minimal and make it easy to monkeypatch in unit tests.
    from app.domains.site import therapist_availability as sot

    unique_ids = list(dict.fromkeys([tid for tid in therapist_ids if tid is not None]))
    if not unique_ids:
        return {}

    today = now_jst().date()
    end_date = today + timedelta(days=lookahead_days)

    # 1) buffer_minutes per therapist (Profile.buffer_minutes). Missing => 0.
    buffer_stmt = (
        select(models.Therapist.id, models.Profile.buffer_minutes)
        .join(models.Profile, models.Profile.id == models.Therapist.profile_id)
        .where(models.Therapist.id.in_(unique_ids))
    )
    buffer_rows = (await db.execute(buffer_stmt)).all()
    buffer_by_therapist: dict[UUID, int] = {
        therapist_id: int(buffer_minutes or 0)
        for therapist_id, buffer_minutes in buffer_rows
    }

    # 2) shifts (by therapist/date)
    shifts_stmt = (
        select(models.TherapistShift)
        .where(models.TherapistShift.therapist_id.in_(unique_ids))
        .where(models.TherapistShift.availability_status == "available")
        .where(models.TherapistShift.date >= today)
        .where(models.TherapistShift.date <= end_date)
    )
    shifts = list((await db.execute(shifts_stmt)).scalars().all())
    shifts_by_therapist: dict[UUID, dict[date, list[models.TherapistShift]]] = (
        defaultdict(lambda: defaultdict(list))
    )
    for shift in shifts:
        shifts_by_therapist[shift.therapist_id][shift.date].append(shift)

    # 3) reservations (by therapist)
    range_start = datetime.combine(today, time.min).replace(tzinfo=JST)
    range_end = datetime.combine(end_date, time.min).replace(tzinfo=JST) + timedelta(
        days=1
    )
    reservations_stmt = select(models.GuestReservation).where(
        models.GuestReservation.therapist_id.in_(unique_ids),
        models.GuestReservation.status.in_(sot.ACTIVE_RESERVATION_STATUSES),
        models.GuestReservation.start_at < range_end,
        models.GuestReservation.end_at > range_start,
    )
    reservations = list((await db.execute(reservations_stmt)).scalars().all())
    reservations_by_therapist: dict[UUID, list[models.GuestReservation]] = defaultdict(
        list
    )
    for reservation in reservations:
        reservations_by_therapist[reservation.therapist_id].append(reservation)

    def reservations_for_date(
        therapist_id: UUID,
        target_date: date,
    ) -> list[models.GuestReservation]:
        day_start, day_end = sot._day_window(target_date)
        return [
            r
            for r in reservations_by_therapist.get(therapist_id, [])
            if r.start_at < day_end and r.end_at > day_start
        ]

    results: dict[UUID, tuple[bool, NextAvailableSlot | None]] = {}
    for therapist_id in unique_ids:
        today_available = False
        next_slot: NextAvailableSlot | None = None
        buffer_minutes = buffer_by_therapist.get(therapist_id, 0)

        current = today
        while current <= end_date:
            day_shifts = shifts_by_therapist.get(therapist_id, {}).get(current, [])
            day_reservations = reservations_for_date(therapist_id, current)

            open_intervals = sot._calculate_available_slots(
                day_shifts, day_reservations, buffer_minutes
            )
            day_intervals = (
                sot._filter_slots_by_date(open_intervals, current)
                if open_intervals
                else []
            )

            if current == today:
                today_available = bool(day_intervals)

            if next_slot is None and day_intervals:
                start_at, end_at = day_intervals[0]
                next_slot = NextAvailableSlot(
                    start_at=start_at,
                    end_at=end_at,
                    status="ok",
                )

            current += timedelta(days=1)

        results[therapist_id] = (today_available, next_slot)

    return results


def _profile_to_shop_summary(profile: models.Profile) -> ShopSummary:
    """Convert a Profile model to ShopSummary."""
    first_photo = None
    if profile.photos and len(profile.photos) > 0:
        first_photo = profile.photos[0]

    contact = profile.contact_json or {}
    promotions_raw = contact.get("promotions")
    promotions = normalize_promotions(promotions_raw)
    reviews = contact.get("reviews", {})
    rating = reviews.get("average_score") if isinstance(reviews, dict) else None
    review_count = reviews.get("review_count") if isinstance(reviews, dict) else None

    staff_preview = []
    staff_data = contact.get("staff", [])
    if isinstance(staff_data, list):
        for s in staff_data[:3]:
            if isinstance(s, dict) and s.get("name"):
                # Parse today_available
                today_available_raw = s.get("today_available")
                today_available = None
                if today_available_raw is not None:
                    if isinstance(today_available_raw, bool):
                        today_available = today_available_raw
                    elif isinstance(today_available_raw, str):
                        today_available = today_available_raw.lower() in (
                            "true",
                            "1",
                            "yes",
                        )
                # Parse next_available_at
                next_available_at_raw = s.get("next_available_at")
                next_available_at = None
                if next_available_at_raw is not None:
                    if isinstance(next_available_at_raw, datetime):
                        next_available_at = next_available_at_raw
                    elif isinstance(next_available_at_raw, str):
                        try:
                            next_available_at = datetime.fromisoformat(
                                next_available_at_raw.replace("Z", "+00:00")
                            )
                        except (ValueError, TypeError):
                            pass
                staff_preview.append(
                    ShopStaffPreview(
                        id=str(s.get("id")) if s.get("id") else None,
                        name=str(s.get("name")),
                        alias=str(s.get("alias")) if s.get("alias") else None,
                        headline=str(s.get("headline")) if s.get("headline") else None,
                        rating=safe_float(s.get("rating")),
                        review_count=safe_int(s.get("review_count")),
                        avatar_url=str(s.get("avatar_url"))
                        if s.get("avatar_url")
                        else None,
                        specialties=s.get("specialties", [])
                        if isinstance(s.get("specialties"), list)
                        else [],
                        today_available=today_available,
                        next_available_at=next_available_at,
                    )
                )

    # Safely get price_band from profile or compute from price_min
    price_band = getattr(profile, "price_band", None) or _compute_price_band(
        profile.price_min
    )
    discounts = getattr(profile, "discounts", None)

    return ShopSummary(
        id=profile.id,
        slug=profile.slug,
        name=profile.name,
        store_name=contact.get("store_name"),
        area=profile.area,
        area_name=profile.area,
        address=contact.get("address"),
        categories=[],
        service_tags=profile.body_tags or [],
        min_price=profile.price_min or 0,
        max_price=profile.price_max or 0,
        nearest_station=profile.nearest_station,
        station_line=profile.station_line,
        station_exit=profile.station_exit,
        station_walk_minutes=profile.station_walk_minutes,
        latitude=profile.latitude,
        longitude=profile.longitude,
        rating=rating,
        review_count=review_count,
        lead_image_url=first_photo,
        badges=profile.ranking_badges or [],
        today_available=None,
        next_available_at=None,
        distance_km=None,
        online_reservation=None,
        updated_at=profile.updated_at,
        ranking_reason=contact.get("ranking_reason"),
        promotions=promotions,
        price_band=price_band,
        price_band_label=PRICE_BAND_LABELS.get(price_band) if price_band else None,
        has_promotions=bool(promotions),
        has_discounts=bool(discounts),
        promotion_count=len(promotions) if promotions else 0,
        ranking_score=profile.ranking_weight,
        diary_count=None,
        has_diaries=None,
        staff_preview=staff_preview,
    )


async def _search_from_postgres(
    db: AsyncSession,
    *,
    q: str | None = None,
    area: str | None = None,
    price_min: int | None = None,
    price_max: int | None = None,
    category: str | None = None,
    page: int = 1,
    page_size: int = 12,
) -> tuple[List[ShopSummary], int]:
    """Fallback search using PostgreSQL when Meilisearch is unavailable."""
    stmt = select(models.Profile).where(models.Profile.status == "published")

    if q:
        search_term = f"%{q}%"
        stmt = stmt.where(
            or_(
                models.Profile.name.ilike(search_term),
                models.Profile.area.ilike(search_term),
            )
        )

    if area:
        stmt = stmt.where(models.Profile.area.ilike(f"%{area}%"))

    if price_min is not None:
        stmt = stmt.where(models.Profile.price_max >= price_min)

    if price_max is not None:
        stmt = stmt.where(models.Profile.price_min <= price_max)

    if category:
        stmt = stmt.where(models.Profile.service_type == category)

    # Get total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    # Apply pagination and ordering
    stmt = stmt.order_by(
        models.Profile.ranking_weight.desc().nulls_last(),
        models.Profile.updated_at.desc().nulls_last(),
    )
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    profiles = result.scalars().all()

    shops = [_profile_to_shop_summary(p) for p in profiles]
    return shops, total


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
    try:
        res = meili_search(
            q=params.get("q"),
            filter_expr=params.get("filter"),
            sort=params.get("sort"),
            page=page,
            page_size=page_size,
            facets=params.get("facets"),
        )
    except Exception as e:
        logger.warning("meili_search failed, falling back to PostgreSQL: %s", e)
        results, total = await _search_from_postgres(
            db,
            q=q,
            area=area,
            price_min=price_min,
            price_max=price_max,
            category=category,
            page=page,
            page_size=page_size,
        )
        res = None  # Fall through to availability processing below
    if res is not None and isinstance(res, Exception):
        logger.warning(
            "shop search returned error, falling back to PostgreSQL: %s", res
        )
        try:
            results, total = await _search_from_postgres(
                db,
                q=q,
                area=area,
                price_min=price_min,
                price_max=price_max,
                category=category,
                page=page,
                page_size=page_size,
            )
        except Exception as pg_error:
            logger.error("PostgreSQL fallback also failed: %s", pg_error)
            results, total = [], 0
        res = None  # Fall through to availability processing below

    # Process Meili results if we didn't fall back to PostgreSQL
    if res is not None:
        hits = res.get("hits", [])
        results = [_doc_to_shop_summary(doc) for doc in hits]
        total = res.get("estimatedTotalHits", len(results))

    if available_date:
        results = await _filter_results_by_availability(db, results, available_date)

    if results:
        staff_ids: list[UUID] = []
        for shop in results:
            for member in shop.staff_preview:
                staff_uuid = normalize_staff_uuid(member.id)
                if staff_uuid:
                    staff_ids.append(staff_uuid)

        # Single Source of Truth: guest availability (shifts + breaks + reservations + buffer).
        # Never leak stale cached `next_available_at` from the search index.
        staff_next_map = await _derive_next_availability_from_slots_sot(
            db, staff_ids, lookahead_days=14
        )

        for shop in results:
            shop_today_available = False
            shop_next_slot: NextAvailableSlot | None = None
            has_any_staff = False

            for member in shop.staff_preview:
                staff_uuid = normalize_staff_uuid(member.id)
                if not staff_uuid:
                    member.today_available = False
                    member.next_available_slot = None
                    member.next_available_at = None
                    continue

                has_any_staff = True
                today_available, next_slot = staff_next_map.get(
                    staff_uuid, (False, None)
                )
                member.today_available = today_available
                member.next_available_slot = next_slot
                member.next_available_at = next_slot.start_at if next_slot else None

                shop_today_available = shop_today_available or today_available
                if next_slot and (
                    shop_next_slot is None
                    or next_slot.start_at < shop_next_slot.start_at
                ):
                    shop_next_slot = next_slot

            if has_any_staff:
                shop.today_available = shop_today_available
                shop.next_available_slot = shop_next_slot
                shop.next_available_at = (
                    shop_next_slot.start_at if shop_next_slot else None
                )

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

    # Build response - handle both Meili and PostgreSQL fallback cases
    if res is not None:
        response_total = (
            len(results) if available_date else res.get("estimatedTotalHits", 0)
        )
        response_facets = _build_facets(res.get("facetDistribution"), selected_facets)
    else:
        response_total = total
        response_facets = {}

    response = ShopSearchResponse(
        page=page,
        page_size=page_size,
        total=response_total,
        results=results,
        facets=response_facets,
    )
    return response.model_dump()


class ShopSearchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def search(self, **params: Any) -> Dict[str, Any]:
        return await _search_shops_impl(self.db, **params)


__all__ = ["ShopSearchService"]
