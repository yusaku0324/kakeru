"""Review management endpoints for the dashboard domain."""

from __future__ import annotations

from http import HTTPStatus
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models
from ....db import get_session
from ....deps import require_dashboard_user
from ....schemas import ReviewItem, ReviewListResponse, ReviewModerationRequest
from ...site import shops as site_shops

router = APIRouter(prefix="/api/dashboard", tags=["dashboard-reviews"])


def _serialize_review(review: models.Review) -> ReviewItem:
    """Serialize a Review model to ReviewItem schema."""
    return site_shops.serialize_review(review)


async def _verify_shop_access(
    db: AsyncSession,
    profile_id: UUID,
    user: models.User,
) -> models.Profile:
    """Verify the user has access to the given shop profile."""
    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="shop not found")
    return profile


@router.get(
    "/shops/{profile_id}/reviews",
    response_model=ReviewListResponse,
)
async def list_shop_reviews(
    profile_id: UUID,
    status_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> ReviewListResponse:
    """List reviews for a specific shop with optional status filter."""
    await _verify_shop_access(db, profile_id, user)

    stmt = (
        select(models.Review)
        .where(models.Review.profile_id == profile_id)
        .order_by(models.Review.created_at.desc())
    )
    count_stmt = (
        select(func.count())
        .select_from(models.Review)
        .where(models.Review.profile_id == profile_id)
    )

    if status_filter:
        stmt = stmt.where(models.Review.status == status_filter)
        count_stmt = count_stmt.where(models.Review.status == status_filter)

    total = await db.scalar(count_stmt) or 0
    offset = (page - 1) * page_size
    reviews = await db.scalars(stmt.offset(offset).limit(page_size))

    return ReviewListResponse(
        total=int(total),
        items=[_serialize_review(r) for r in reviews],
    )


@router.get(
    "/shops/{profile_id}/reviews/stats",
    response_model=dict,
)
async def get_shop_review_stats(
    profile_id: UUID,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> dict:
    """Get review statistics for a shop."""
    await _verify_shop_access(db, profile_id, user)

    # Count by status
    status_counts = {}
    for status in ["pending", "published", "rejected"]:
        count = await db.scalar(
            select(func.count())
            .select_from(models.Review)
            .where(models.Review.profile_id == profile_id)
            .where(models.Review.status == status)
        )
        status_counts[status] = count or 0

    # Average score (published only)
    avg_score = await db.scalar(
        select(func.avg(models.Review.score))
        .where(models.Review.profile_id == profile_id)
        .where(models.Review.status == "published")
    )

    return {
        "total": sum(status_counts.values()),
        "pending": status_counts["pending"],
        "published": status_counts["published"],
        "rejected": status_counts["rejected"],
        "average_score": round(float(avg_score), 2) if avg_score else None,
    }


@router.get(
    "/shops/{profile_id}/reviews/{review_id}",
    response_model=ReviewItem,
)
async def get_shop_review(
    profile_id: UUID,
    review_id: UUID,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> ReviewItem:
    """Get a single review detail for a shop."""
    await _verify_shop_access(db, profile_id, user)

    review = await db.get(models.Review, review_id)
    if not review or review.profile_id != profile_id:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="review not found")

    return _serialize_review(review)


@router.put(
    "/shops/{profile_id}/reviews/{review_id}/status",
    response_model=ReviewItem,
)
async def update_shop_review_status(
    profile_id: UUID,
    review_id: UUID,
    payload: ReviewModerationRequest,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> ReviewItem:
    """Update the status of a review (moderate: approve/reject)."""
    await _verify_shop_access(db, profile_id, user)

    review = await db.get(models.Review, review_id)
    if not review or review.profile_id != profile_id:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="review not found")

    review.status = payload.status
    review.updated_at = models.now_utc()
    await db.commit()
    await db.refresh(review)

    return _serialize_review(review)
