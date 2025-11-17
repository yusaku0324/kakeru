from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from types import SimpleNamespace
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union
from uuid import UUID
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .... import models
from ....schemas import (
    AvailabilityCalendar,
    ContactInfo,
    GeoLocation,
    HighlightedReview,
    MediaImage,
    NextAvailableSlot,
    REVIEW_ASPECT_KEYS,
    ReviewAspectScore,
    ReviewCreateRequest,
    ReviewItem,
    ReviewListResponse,
    ReviewSummary,
    ShopDetail,
    SocialLink,
    StaffSummary,
    DiarySnippet,
)
from ....utils.profiles import compute_review_summary, normalize_review_aspects
from ....utils.datetime import now_jst
from .shop.availability import (
    fetch_availability as _fetch_availability,
    get_next_available_slot as _get_next_available_slot,
)
from .shop.shared import (
    AvailabilityNotFoundError,
    ShopNotFoundError,
    normalize_promotions as _normalize_promotions,
    safe_int as _safe_int,
)

ShopId = Union[str, UUID]

__all__ = (
    "serialize_review",
    "_prepare_aspect_scores",
    "_collect_review_aspect_stats",
    "ShopDetailAssembler",
    "ShopAvailabilityService",
    "ShopReviewService",
    "ShopNotFoundError",
    "AvailabilityNotFoundError",
)


def serialize_review(review: models.Review) -> ReviewItem:
    aspects_raw = normalize_review_aspects(getattr(review, "aspect_scores", {}) or {})
    aspects = {
        key: ReviewAspectScore(**value)
        for key, value in aspects_raw.items()
        if isinstance(value, dict) and "score" in value
    }
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
        aspects=aspects,
    )


def _prepare_aspect_scores(raw: Any) -> Dict[str, Dict[str, Any]]:
    """Normalize user-supplied review aspect payload."""

    cleaned: Dict[str, Dict[str, Any]] = {}
    if not isinstance(raw, dict):
        return cleaned
    for key in REVIEW_ASPECT_KEYS:
        entry = raw.get(key)
        if not isinstance(entry, dict):
            continue
        score = _safe_int(entry.get("score"))
        if score is None:
            continue
        score = max(1, min(5, score))
        payload: Dict[str, Any] = {"score": score}
        note_raw = entry.get("note")
        if isinstance(note_raw, str):
            note = note_raw.strip()
            if note:
                payload["note"] = note
        cleaned[key] = payload
    return cleaned


def _collect_review_aspect_stats(
    items: Iterable[Any],
) -> tuple[Dict[str, float], Dict[str, int]]:
    totals: Dict[str, float] = defaultdict(float)
    counts: Dict[str, int] = defaultdict(int)
    for item in items:
        aspects = getattr(item, "aspects", None) or {}
        if not isinstance(aspects, dict):
            continue
        for key, value in aspects.items():
            score: Optional[int] = None
            if isinstance(value, ReviewAspectScore):
                score = value.score
            elif isinstance(value, dict):
                score = _safe_int(value.get("score"))
            if score is None:
                continue
            totals[key] += score
            counts[key] += 1
    averages = {
        key: round(totals[key] / counts[key], 1) for key in counts if counts[key]
    }
    return averages, counts


class ShopDetailAssembler:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_detail(self, shop_id: ShopId) -> ShopDetail:
        return await _get_shop_detail_impl(self.db, shop_id)


class ShopAvailabilityService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_availability(
        self,
        shop_id: UUID,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> AvailabilityCalendar:
        return await _get_shop_availability_impl(
            self.db,
            shop_id=shop_id,
            date_from=date_from,
            date_to=date_to,
        )


class ShopReviewService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_reviews(
        self,
        shop_id: UUID,
        *,
        page: int = 1,
        page_size: int = 10,
    ) -> ReviewListResponse:
        return await _list_shop_reviews_impl(
            self.db,
            shop_id=shop_id,
            page=page,
            page_size=page_size,
        )

    async def create_review(
        self,
        shop_id: UUID,
        payload: ReviewCreateRequest,
    ) -> ReviewItem:
        return await _create_shop_review_impl(self.db, shop_id=shop_id, payload=payload)


async def _collect_shop_review_aspect_stats(
    db: AsyncSession,
    profile_id: UUID,
) -> tuple[Dict[str, float], Dict[str, int]]:
    stmt = select(models.Review.aspect_scores).where(
        models.Review.profile_id == profile_id,
        models.Review.status == "published",
    )
    result = await db.scalars(stmt)
    items = [
        SimpleNamespace(aspects=normalize_review_aspects(raw or {})) for raw in result
    ]
    return _collect_review_aspect_stats(items)


async def _list_shop_reviews_impl(
    db: AsyncSession,
    *,
    shop_id: UUID,
    page: int,
    page_size: int,
) -> ReviewListResponse:
    await _ensure_shop_exists(db, shop_id)
    offset = max(page - 1, 0) * page_size
    base_query = (
        select(models.Review)
        .where(
            models.Review.profile_id == shop_id,
            models.Review.status == "published",
        )
        .order_by(models.Review.created_at.desc())
    )
    result = await db.execute(base_query.offset(offset).limit(page_size))
    reviews = result.scalars().all()

    count_stmt = (
        select(func.count())
        .select_from(models.Review)
        .where(
            models.Review.profile_id == shop_id,
            models.Review.status == "published",
        )
    )
    total = await db.scalar(count_stmt)
    averages, aspect_counts = await _collect_shop_review_aspect_stats(db, shop_id)
    return ReviewListResponse(
        total=total or 0,
        items=[serialize_review(review) for review in reviews],
        aspect_averages=averages,
        aspect_counts=aspect_counts,
    )


async def _create_shop_review_impl(
    db: AsyncSession,
    *,
    shop_id: UUID,
    payload: ReviewCreateRequest,
) -> ReviewItem:
    await _ensure_shop_exists(db, shop_id)
    review = models.Review(
        id=uuid.uuid4(),
        profile_id=shop_id,
        status="pending",
        score=payload.score,
        title=payload.title,
        body=payload.body,
        author_alias=payload.author_alias,
        visited_at=payload.visited_at,
        aspect_scores=_prepare_aspect_scores(payload.aspects or {}),
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return serialize_review(review)


async def _get_shop_detail_impl(
    db: AsyncSession,
    shop_id: ShopId,
    *,
    today: date | None = None,
) -> ShopDetail:
    profile = await _load_profile(db, shop_id)
    if profile is None:
        raise ShopNotFoundError("shop not found")

    reference_day = today or now_jst().date()

    contact_info = _build_contact_info(profile)
    location = GeoLocation(
        address=getattr(profile, "address", None),
        latitude=profile.latitude,
        longitude=profile.longitude,
        nearest_station=profile.nearest_station,
        station_line=profile.station_line,
        station_exit=profile.station_exit,
        station_walk_minutes=profile.station_walk_minutes,
    )

    photos: List[MediaImage] = []
    for idx, url in enumerate(profile.photos or []):
        if not url:
            continue
        photos.append(MediaImage(url=url, order=idx))

    diary_entries = [
        DiarySnippet(
            id=diary.id,
            title=diary.title,
            body=diary.text,
            photos=diary.photos or [],
            hashtags=diary.hashtags or [],
            published_at=diary.created_at,
        )
        for diary in getattr(profile, "diaries", [])
        if getattr(diary, "status", "draft") == "published"
    ]

    raw_summary = compute_review_summary(profile, include_aspects=True)
    if len(raw_summary) == 5:
        avg_score, review_count, highlights, aspect_avgs, aspect_counts = raw_summary  # type: ignore[misc]
    else:
        avg_score, review_count, highlights = raw_summary  # type: ignore[misc]
        aspect_avgs, aspect_counts = {}, {}
    highlighted = [
        HighlightedReview(
            review_id=item.get("id"),
            title=item.get("title") or "",
            body=item.get("body") or "",
            score=item.get("score") or 0,
            visited_at=item.get("visited_at"),
            author_alias=item.get("author_alias"),
            aspects=item.get("aspects") or {},
        )
        for item in highlights
        if isinstance(item, dict)
    ]
    review_summary = ReviewSummary(
        average_score=avg_score,
        review_count=review_count,
        highlighted=highlighted,
        aspect_averages=aspect_avgs,
        aspect_counts=aspect_counts,
    )

    availability_calendar = await _fetch_availability(db, profile.id)
    today_available = False
    if availability_calendar and availability_calendar.days:
        today_available = any(
            day.date == reference_day
            and any(slot.status in {"open", None} for slot in day.slots)
            for day in availability_calendar.days
        )
    else:
        availability_calendar = None

    next_available_slot = await _get_next_available_slot(db, profile.id)
    next_available_at: Optional[datetime] = (
        next_available_slot.start_at if next_available_slot else None
    )

    promotions = _normalize_promotions(profile.discounts or [])
    has_promotions = bool(promotions)
    promotion_count = len(promotions)
    has_discounts = bool(profile.discounts)

    staff_members: List[StaffSummary] = []
    for therapist in getattr(profile, "therapists", []):
        if getattr(therapist, "status", "draft") != "published":
            continue
        avatar_url = None
        photo_list = getattr(therapist, "photo_urls", None) or []
        if photo_list:
            avatar_url = photo_list[0]
        staff_members.append(
            StaffSummary(
                id=therapist.id,
                name=therapist.name,
                alias=therapist.alias,
                avatar_url=avatar_url,
                headline=therapist.headline,
                rating=None,
                review_count=None,
                next_shift=None,
                specialties=therapist.specialties or [],
                is_pickup=None,
                next_available_slot=None,
            )
        )

    contact_json = getattr(profile, "contact_json", {}) or {}
    store_name = contact_json.get("store_name")
    area_name = contact_json.get("area_name")
    address = contact_json.get("address")

    detail = ShopDetail(
        id=profile.id,
        slug=profile.slug,
        name=profile.name,
        store_name=store_name,
        area=profile.area,
        area_name=area_name,
        address=address,
        categories=[],
        service_tags=list(profile.body_tags or []),
        min_price=profile.price_min,
        max_price=profile.price_max,
        nearest_station=profile.nearest_station,
        station_line=profile.station_line,
        station_exit=profile.station_exit,
        station_walk_minutes=profile.station_walk_minutes,
        latitude=profile.latitude,
        longitude=profile.longitude,
        rating=avg_score,
        review_count=review_count,
        lead_image_url=photos[0].url if photos else None,
        badges=profile.ranking_badges or [],
        today_available=today_available,
        next_available_at=next_available_at,
        next_available_slot=next_available_slot,
        distance_km=None,
        online_reservation=contact_json.get("online_reservation"),
        updated_at=profile.updated_at,
        ranking_reason=None,
        promotions=promotions,
        price_band=None,
        price_band_label=None,
        has_promotions=has_promotions,
        has_discounts=has_discounts,
        promotion_count=promotion_count,
        ranking_score=None,
        staff_preview=[],
        description=getattr(profile, "description", None),
        catch_copy=contact_json.get("catch_copy"),
        photos=photos,
        contact=contact_info,
        location=location,
        menus=[],
        staff=staff_members,
        availability_calendar=availability_calendar,
        reviews=review_summary,
        metadata={},
        diaries=diary_entries,
    )

    return detail


async def _get_shop_availability_impl(
    db: AsyncSession,
    shop_id: UUID,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> AvailabilityCalendar:
    await _ensure_shop_exists(db, shop_id)

    start = date_from or now_jst().date()
    end = date_to or start
    if end < start:
        end = start

    calendar = await _fetch_availability(
        db,
        shop_id=shop_id,
        start_date=start,
        end_date=end,
    )
    if not calendar or not calendar.days:
        raise AvailabilityNotFoundError("availability not found")
    return calendar


async def _load_profile(
    db: AsyncSession,
    identifier: ShopId,
) -> Optional[models.Profile]:
    resolved_uuid: Optional[UUID] = None
    slug: Optional[str] = None
    if isinstance(identifier, UUID):
        resolved_uuid = identifier
    else:
        try:
            resolved_uuid = UUID(str(identifier))
        except Exception:
            slug = str(identifier)

    stmt = (
        select(models.Profile)
        .options(
            selectinload(models.Profile.diaries),
            selectinload(models.Profile.reviews),
            selectinload(models.Profile.therapists),
        )
        .where(models.Profile.status == "published")
    )
    if resolved_uuid and slug:
        stmt = stmt.where(
            or_(models.Profile.id == resolved_uuid, models.Profile.slug == slug)
        )
    elif resolved_uuid:
        stmt = stmt.where(models.Profile.id == resolved_uuid)
    elif slug:
        stmt = stmt.where(models.Profile.slug == slug)
    else:
        return None

    result = await db.execute(stmt)
    return result.scalars().first()


def _build_contact_info(profile: models.Profile) -> Optional[ContactInfo]:
    raw = getattr(profile, "contact_json", None) or {}
    if not isinstance(raw, dict):
        raw = {}
    sns_entries: List[SocialLink] = []
    for entry in raw.get("sns", []) or []:
        if not isinstance(entry, dict):
            continue
        platform = entry.get("platform")
        url = entry.get("url")
        if not (platform and url):
            continue
        sns_entries.append(
            SocialLink(
                platform=str(platform),
                url=str(url),
                label=entry.get("label"),
            )
        )
    if not (
        raw.get("phone")
        or raw.get("line_id")
        or raw.get("website_url")
        or raw.get("reservation_form_url")
        or sns_entries
    ):
        return None
    return ContactInfo(
        phone=raw.get("phone"),
        line_id=raw.get("line_id"),
        website_url=raw.get("website_url"),
        reservation_form_url=raw.get("reservation_form_url"),
        sns=sns_entries,
    )


async def _ensure_shop_exists(
    db: AsyncSession,
    shop_id: UUID,
) -> models.Profile:
    profile = await db.get(models.Profile, shop_id)
    if profile is None or getattr(profile, "status", "draft") != "published":
        raise ShopNotFoundError("shop not found")
    return profile
