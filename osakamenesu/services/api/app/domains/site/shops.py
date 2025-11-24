from __future__ import annotations

from datetime import date
from uuid import UUID
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...schemas import ReviewCreateRequest
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

router = APIRouter(prefix="/api/v1/shops", tags=["shops"])

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
        open_now=open_now,
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
    assembler = ShopDetailAssembler(db)
    try:
        return await assembler.get_detail(shop_id)
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
    db: AsyncSession = Depends(get_session),
):
    service = ShopReviewService(db)
    try:
        return await service.list_reviews(shop_id, page=page, page_size=page_size)
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
