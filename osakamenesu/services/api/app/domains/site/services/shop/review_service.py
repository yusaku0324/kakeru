from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.schemas import (
    ReviewCreateRequest,
    ReviewItem,
    ReviewListResponse,
    ReviewSummary,
    ReviewAspectScore,
)
from app.utils.profiles import normalize_review_aspects
from app.review_notifications import send_review_notification

from ..shop_services import (
    _collect_shop_review_aspect_stats,
    _prepare_aspect_scores,
)
from .shared import ShopNotFoundError, parse_review_date, safe_float, safe_int


def _serialize_review(review: models.Review) -> ReviewItem:
    aspects_raw = normalize_review_aspects(getattr(review, "aspect_scores", {}))
    aspects = {key: ReviewAspectScore(**value) for key, value in aspects_raw.items()}
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


async def fetch_published_reviews(
    db: AsyncSession,
    *,
    shop_id: UUID,
    limit: int | None = None,
    offset: int = 0,
    sort_by: str = "newest",
) -> list[models.Review]:
    stmt = select(models.Review).where(
        models.Review.profile_id == shop_id, models.Review.status == "published"
    )

    if sort_by == "highest":
        stmt = stmt.order_by(
            models.Review.score.desc(), models.Review.created_at.desc()
        )
    elif sort_by == "lowest":
        stmt = stmt.order_by(models.Review.score.asc(), models.Review.created_at.desc())
    else:
        stmt = stmt.order_by(
            models.Review.visited_at.desc(), models.Review.created_at.desc()
        )

    stmt = stmt.offset(offset)
    if limit is not None:
        stmt = stmt.limit(limit)
    result = await db.scalars(stmt)
    return list(result)


async def count_published_reviews(db: AsyncSession, shop_id: UUID) -> int:
    stmt = (
        select(func.count())
        .select_from(models.Review)
        .where(models.Review.profile_id == shop_id, models.Review.status == "published")
    )
    result = await db.execute(stmt)
    return int(result.scalar_one())


def normalize_reviews(
    raw: object,
    aspect_averages: dict[str, float] | None = None,
    aspect_counts: dict[str, int] | None = None,
) -> ReviewSummary:
    """Normalize aggregated review payload coming from site sources."""

    if raw is None:
        return ReviewSummary()

    highlighted: list[ReviewItem] = []
    average_score: float | None = None
    review_count: int | None = None
    items: list[dict[str, object]] = []

    if isinstance(raw, dict):
        average_score = safe_float(raw.get("average_score") or raw.get("score"))
        review_count = safe_int(raw.get("review_count") or raw.get("count"))
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
        title = str(
            entry.get("title")
            or entry.get("headline")
            or entry.get("summary")
            or "口コミ"
        )
        body = str(entry.get("body") or entry.get("text") or entry.get("comment") or "")
        score = safe_int(entry.get("score") or entry.get("rating")) or 0
        visited_at = parse_review_date(
            entry.get("visited_at") or entry.get("visited_on")
        )
        author_alias = (
            entry.get("author_alias") or entry.get("author") or entry.get("user")
        )
        aspects_raw = normalize_review_aspects(entry.get("aspects"))
        aspects = {
            key: ReviewAspectScore(**value) for key, value in aspects_raw.items()
        }
        highlighted.append(
            ReviewItem(
                id=review_id,
                profile_id=None,
                status="published",
                score=score,
                title=title,
                body=body,
                author_alias=str(author_alias) if author_alias else None,
                visited_at=visited_at,
                created_at=None,
                updated_at=None,
                aspects=aspects,
            )
        )

    if average_score is None and highlighted:
        scores = [h.score for h in highlighted if isinstance(h.score, int)]
        if scores:
            average_score = round(sum(scores) / len(scores), 1)

    if review_count is None:
        review_count = len(highlighted) if highlighted else None

    normalized_aspect_averages: dict[str, float] = {}
    if aspect_averages:
        for key, value in aspect_averages.items():
            val = safe_float(value)
            if val is not None:
                normalized_aspect_averages[key] = val
    elif isinstance(raw, dict):
        raw_avgs = raw.get("aspect_averages") or raw.get("aspectAvg")
        if isinstance(raw_avgs, dict):
            for key, value in raw_avgs.items():
                val = safe_float(value)
                if val is not None:
                    normalized_aspect_averages[key] = val

    normalized_aspect_counts: dict[str, int] = {}
    if aspect_counts:
        for key, value in aspect_counts.items():
            val = safe_int(value)
            if val is not None:
                normalized_aspect_counts[key] = val
    elif isinstance(raw, dict):
        raw_counts = raw.get("aspect_counts") or raw.get("aspectCounts")
        if isinstance(raw_counts, dict):
            for key, value in raw_counts.items():
                val = safe_int(value)
                if val is not None:
                    normalized_aspect_counts[key] = val

    return ReviewSummary(
        average_score=average_score,
        review_count=review_count,
        highlighted=highlighted,
        aspect_averages=normalized_aspect_averages,
        aspect_counts=normalized_aspect_counts,
    )


class ShopReviewService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_reviews(
        self,
        shop_id: UUID,
        *,
        page: int = 1,
        page_size: int = 10,
        sort_by: str = "newest",
    ) -> ReviewListResponse:
        profile = await self.db.get(models.Profile, shop_id)
        if not profile:
            raise ShopNotFoundError("shop not found")

        total = await count_published_reviews(self.db, shop_id)
        offset = (page - 1) * page_size
        reviews = await fetch_published_reviews(
            self.db, shop_id=shop_id, limit=page_size, offset=offset, sort_by=sort_by
        )
        items = [_serialize_review(r) for r in reviews]
        aspect_averages, aspect_counts = {}, {}
        if total:
            aspect_averages, aspect_counts = await _collect_shop_review_aspect_stats(
                self.db, shop_id
            )
        return ReviewListResponse(
            total=total,
            items=items,
            aspect_averages=aspect_averages,
            aspect_counts=aspect_counts,
        )

    async def create_review(
        self, shop_id: UUID, payload: ReviewCreateRequest
    ) -> ReviewItem:
        profile = await self.db.get(models.Profile, shop_id)
        if not profile:
            raise ShopNotFoundError("shop not found")

        review = models.Review(
            profile_id=profile.id,
            score=payload.score,
            title=payload.title,
            body=payload.body,
            author_alias=payload.author_alias,
            visited_at=payload.visited_at,
            status="pending",
            aspect_scores=_prepare_aspect_scores(payload.aspects),
        )
        self.db.add(review)
        await self.db.commit()
        await self.db.refresh(review)

        try:
            await send_review_notification(self.db, review)
        except Exception:
            pass

        return _serialize_review(review)
