from __future__ import annotations

from http import HTTPStatus
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models
from ....schemas import ReviewItem, ReviewListResponse, ReviewModerationRequest
from . import site_bridge
from .audit import AdminAuditContext, record_change
from .errors import AdminServiceError


class ReviewServiceError(AdminServiceError):
    """Domain-level exception for review moderation flows."""


async def list_reviews(
    *,
    db: AsyncSession,
    status_filter: Optional[str],
    page: int,
    page_size: int,
) -> ReviewListResponse:
    stmt = select(models.Review).order_by(models.Review.created_at.desc())
    count_stmt = select(func.count()).select_from(models.Review)
    if status_filter:
        stmt = stmt.where(models.Review.status == status_filter)
        count_stmt = count_stmt.where(models.Review.status == status_filter)

    total = await db.scalar(count_stmt) or 0
    offset = (page - 1) * page_size
    reviews = await db.scalars(stmt.offset(offset).limit(page_size))
    return ReviewListResponse(
        total=int(total), items=[site_bridge.serialize_review(r) for r in reviews]
    )


async def update_review_status(
    *,
    audit_context: AdminAuditContext | None,
    db: AsyncSession,
    review_id: UUID,
    payload: ReviewModerationRequest,
) -> ReviewItem:
    review = await db.get(models.Review, review_id)
    if not review:
        raise ReviewServiceError(HTTPStatus.NOT_FOUND, detail="review not found")

    before = site_bridge.serialize_review(review).model_dump()
    review.status = payload.status
    review.updated_at = models.now_utc()
    await db.commit()
    await db.refresh(review)

    serialized = site_bridge.serialize_review(review)
    await record_change(
        db,
        context=audit_context,
        target_type="review",
        target_id=review.id,
        action="moderate",
        before=before,
        after=serialized.model_dump(),
    )
    return serialized
