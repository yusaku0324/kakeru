from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...schemas import ReviewItem, ReviewListResponse, ReviewModerationRequest
from .services import review_service

router = APIRouter()


@router.get("/api/admin/reviews", summary="List reviews", response_model=ReviewListResponse)
async def admin_list_reviews(
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_session),
):
    return await review_service.list_reviews(
        db=db,
        status_filter=status,
        page=page,
        page_size=page_size,
    )


@router.patch("/api/admin/reviews/{review_id}", summary="Update review status", response_model=ReviewItem)
async def admin_update_review_status(
    review_id: UUID,
    payload: ReviewModerationRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
):
    return await review_service.update_review_status(
        request=request,
        db=db,
        review_id=review_id,
        payload=payload,
    )
