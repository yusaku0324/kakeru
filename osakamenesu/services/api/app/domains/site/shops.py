from __future__ import annotations

from datetime import date
from uuid import UUID
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...schemas import ReviewCreateRequest
from ...utils.cache import shop_cache
from .services.shop.search_service import ShopSearchService
from .services.shop.diary_service import ShopDiaryService
from .services.shop_services import (
    ShopDetailAssembler,
    ShopAvailabilityService,
    ShopNotFoundError,
    AvailabilityNotFoundError,
    serialize_review,
    _prepare_aspect_scores,
    _collect_review_aspect_stats,
)
from .services.shop.review_service import ShopReviewService
from .services.shop.therapists_service import (
    ShopTherapistsService,
    ShopTherapistsResponse,
)

router = APIRouter(prefix="/api/v1/shops", tags=["shops"])

# Sample shop data for demo/development
SAMPLE_SHOPS: dict[str, dict] = {
    "sample-namba-resort": {
        "id": "sample-shop-id",
        "slug": "sample-namba-resort",
        "name": "アロマリゾート 難波本店",
        "area": "難波/日本橋",
        "address": "大阪府大阪市中央区難波1-1-1",
        "description": "大阪難波エリアで人気のメンズエステ。癒しの空間で極上のトリートメントをご提供します。",
        "phone": "06-1234-5678",
        "business_hours": "10:00 - 翌3:00",
        "price_min": 8000,
        "price_max": 20000,
        "photos": ["/images/demo-shop.svg"],
        "rating": 4.5,
        "review_count": 128,
        "tags": ["個室完備", "駅近", "深夜営業"],
        "therapists": [
            {
                "id": "11111111-1111-1111-8888-111111111111",
                "name": "葵",
                "age": 26,
                "photos": ["/images/demo-therapist-1.svg"],
                "tags": {"mood": "癒し系", "style": "ソフト"},
                "price_rank": 3,
                "available_today": True,
                "recommended_score": 0.52,
            },
            {
                "id": "22222222-2222-2222-8888-222222222222",
                "name": "凛",
                "age": 24,
                "photos": ["/images/demo-therapist-2.svg"],
                "tags": {"mood": "癒し系", "style": "ソフト"},
                "price_rank": 3,
                "available_today": True,
                "recommended_score": 0.52,
            },
        ],
        "staff": [
            {
                "id": "11111111-1111-1111-8888-111111111111",
                "name": "葵",
                "alias": None,
                "avatar_url": "/images/demo-therapist-1.svg",
                "headline": "丁寧なオイルトリートメントで人気のセラピスト",
                "rating": 4.8,
                "review_count": 42,
                "next_shift": None,
                "specialties": ["リンパ", "ホットストーン", "指名多数"],
                "is_pickup": None,
                "next_available_slot": None,
                "recommended_score": 0.52,
            },
            {
                "id": "22222222-2222-2222-8888-222222222222",
                "name": "凛",
                "alias": None,
                "avatar_url": "/images/demo-therapist-2.svg",
                "headline": "ストレッチと指圧を組み合わせた独自施術が評判",
                "rating": 4.6,
                "review_count": 35,
                "next_shift": None,
                "specialties": ["ストレッチ", "指圧", "ディープリンパ"],
                "is_pickup": None,
                "next_available_slot": None,
                "recommended_score": 0.52,
            },
        ],
    },
}


def _get_sample_shop_response(shop_id: str) -> dict | None:
    """Return sample shop data if slug matches known samples."""
    sample = SAMPLE_SHOPS.get(shop_id)
    if not sample:
        return None
    return sample


__all__ = (
    "router",
    "serialize_review",
    "_prepare_aspect_scores",
    "_collect_review_aspect_stats",
)


@router.get("")
async def search_shops(
    q: str | None = Query(default=None, description="Free text query"),
    area: str | None = Query(default=None, description="Area code filter"),
    station: str | None = Query(default=None, description="Nearest station filter"),
    category: str | None = Query(default=None, description="Service category"),
    service_tags: str | None = Query(
        default=None, description="Comma separated service tags"
    ),
    price_min: int | None = Query(default=None, ge=0),
    price_max: int | None = Query(default=None, ge=0),
    available_date: date | None = Query(
        default=None, description="Required availability date"
    ),
    open_now: bool | None = Query(default=None),
    today: bool | None = Query(default=None, description="Alias for open_now"),
    price_band: str | None = Query(
        default=None, description="Comma separated price band keys"
    ),
    ranking_badges_param: str | None = Query(
        default=None, description="Comma separated ranking badge keys"
    ),
    promotions_only: bool | None = Query(
        default=None, description="Filter shops with promotions"
    ),
    discounts_only: bool | None = Query(
        default=None, description="Filter shops with discounts"
    ),
    diaries_only: bool | None = Query(
        default=None, description="Filter shops with published diaries"
    ),
    bust_min: str | None = Query(
        default=None, description="Lower bound bust tag (A-Z)"
    ),
    bust_max: str | None = Query(
        default=None, description="Upper bound bust tag (A-Z)"
    ),
    age_min: int | None = Query(default=None, ge=0),
    age_max: int | None = Query(default=None, ge=0),
    height_min: int | None = Query(default=None, ge=0),
    height_max: int | None = Query(default=None, ge=0),
    hair_color: str | None = Query(default=None, description="Hair color tag"),
    hair_style: str | None = Query(default=None, description="Hair style tag"),
    body_shape: str | None = Query(default=None, description="Body shape tag"),
    sort: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=50),
    db: AsyncSession = Depends(get_session),
):
    service = ShopSearchService(db)
    return await service.search(
        q=q,
        area=area,
        station=station,
        category=category,
        service_tags=service_tags,
        price_min=price_min,
        price_max=price_max,
        available_date=available_date,
        open_now=open_now if open_now is not None else today,
        price_band=price_band,
        ranking_badges_param=ranking_badges_param,
        promotions_only=promotions_only,
        discounts_only=discounts_only,
        diaries_only=diaries_only,
        bust_min=bust_min,
        bust_max=bust_max,
        age_min=age_min,
        age_max=age_max,
        height_min=height_min,
        height_max=height_max,
        hair_color=hair_color,
        hair_style=hair_style,
        body_shape=body_shape,
        sort=sort,
        page=page,
        page_size=page_size,
    )


@router.get("/{shop_id}")
async def get_shop_detail(shop_id: str, db: AsyncSession = Depends(get_session)):
    # Try sample data first (for demo/development)
    sample_response = _get_sample_shop_response(shop_id)
    if sample_response:
        return sample_response

    cache_key = f"shop_detail:{shop_id}"
    hit, cached = await shop_cache.get(cache_key)
    if hit:
        return cached

    assembler = ShopDetailAssembler(db)
    try:
        result = await assembler.get_detail(shop_id)
        # Cache the serialized result
        await shop_cache.set(cache_key, result.model_dump())
        return result
    except ShopNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{shop_id}/diaries")
async def list_shop_diaries(
    shop_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=6, ge=1, le=20),
    db: AsyncSession = Depends(get_session),
):
    service = ShopDiaryService(db)
    try:
        response = await service.list_diaries(shop_id, page=page, page_size=page_size)
    except ShopNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return response


@router.get("/{shop_id}/availability")
async def get_shop_availability(
    shop_id: UUID,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: AsyncSession = Depends(get_session),
):
    service = ShopAvailabilityService(db)
    try:
        return await service.get_availability(
            shop_id, date_from=date_from, date_to=date_to
        )
    except ShopNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AvailabilityNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{shop_id}/reviews")
async def list_shop_reviews(
    shop_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    sort_by: str = Query(default="newest", pattern="^(newest|highest|lowest)$"),
    db: AsyncSession = Depends(get_session),
):
    service = ShopReviewService(db)
    try:
        return await service.list_reviews(
            shop_id, page=page, page_size=page_size, sort_by=sort_by
        )
    except ShopNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{shop_id}/reviews", status_code=status.HTTP_201_CREATED)
async def create_shop_review(
    shop_id: UUID,
    payload: ReviewCreateRequest,
    db: AsyncSession = Depends(get_session),
):
    service = ShopReviewService(db)
    try:
        return await service.create_review(shop_id, payload)
    except ShopNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _get_sample_therapists_response(shop_slug: str) -> dict | None:
    """Return sample therapists data if slug matches known samples."""
    sample = SAMPLE_SHOPS.get(shop_slug)
    if not sample:
        return None
    # Use staff data which has more complete information
    staff = sample.get("staff", [])
    therapists = sample.get("therapists", [])
    # Build a lookup for additional therapist info (age, photos, etc.)
    therapist_lookup = {t["id"]: t for t in therapists}
    return {
        "shop_id": sample.get("id", "sample-shop-id"),
        "total": len(staff),
        "items": [
            {
                "id": s["id"],
                "name": s["name"],
                "alias": s.get("alias"),
                "age": therapist_lookup.get(s["id"], {}).get("age"),
                "headline": s.get("headline"),
                "avatar_url": s.get("avatar_url"),
                "photos": therapist_lookup.get(s["id"], {}).get(
                    "photos", [s["avatar_url"]] if s.get("avatar_url") else []
                ),
                "specialties": s.get("specialties", []),
                "tags": therapist_lookup.get(s["id"], {}).get("tags"),
                "price_rank": therapist_lookup.get(s["id"], {}).get("price_rank"),
                "today_available": therapist_lookup.get(s["id"], {}).get(
                    "available_today", False
                ),
                "next_available_at": None,
                "availability_slots": [],
                "recommended_score": s.get("recommended_score"),
                "rating": s.get("rating"),
                "review_count": s.get("review_count"),
            }
            for s in staff
        ],
    }


@router.get("/{shop_id}/therapists")
async def list_shop_therapists(
    shop_id: str,
    include_availability: bool = Query(
        default=True, description="Include availability slots"
    ),
    availability_days: int = Query(
        default=7, ge=1, le=30, description="Days of availability to fetch"
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_session),
):
    """List therapists for a shop with optional availability.

    Returns published therapists with their tags, photos, and availability slots.
    Useful for shop detail pages where users want to see available therapists.
    """
    # Try sample data first (for demo/development)
    sample_response = _get_sample_therapists_response(shop_id)
    if sample_response:
        return sample_response

    # Parse UUID
    try:
        shop_uuid = UUID(shop_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="shop not found") from None

    service = ShopTherapistsService(db)
    try:
        return await service.list_therapists(
            shop_uuid,
            include_availability=include_availability,
            availability_days=availability_days,
            page=page,
            page_size=page_size,
        )
    except ShopNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
