from __future__ import annotations

import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...deps import require_admin, audit_admin
from ...models import Therapist

logger = logging.getLogger(__name__)

router = APIRouter()


class TherapistPayload(BaseModel):
    shop_id: UUID = Field(alias="profile_id")
    name: str
    age: int | None = None
    photo_url: str | None = None
    tags: list[str] | None = Field(
        default=None, description="簡易タグ（specialties相当）"
    )
    # Matching tags
    mood_tag: str | None = Field(default=None, description="雰囲気タグ")
    style_tag: str | None = Field(default=None, description="施術スタイルタグ")
    look_type: str | None = Field(default=None, description="外見タイプタグ")
    contact_style: str | None = Field(default=None, description="接触スタイルタグ")
    talk_level: str | None = Field(default=None, description="会話レベルタグ")
    hobby_tags: list[str] | None = Field(default=None, description="趣味タグ")
    price_rank: int | None = Field(default=None, ge=1, le=5, description="価格帯 (1-5)")

    model_config = ConfigDict(populate_by_name=True)


def _serialize(th: Therapist) -> dict[str, Any]:
    return {
        "id": str(th.id),
        "name": th.name,
        "profile_id": str(th.profile_id),
        # Basic info
        "headline": th.headline,
        "biography": th.biography,
        "age": th.age,
        # Status & display
        "status": th.status,
        "is_booking_enabled": th.is_booking_enabled,
        "display_order": th.display_order,
        # Photos
        "photo_urls": th.photo_urls or [],
        "main_photo_index": th.main_photo_index,
        # Matching tags
        "tags": th.specialties or [],
        "mood_tag": th.mood_tag,
        "style_tag": th.style_tag,
        "look_type": th.look_type,
        "contact_style": th.contact_style,
        "talk_level": th.talk_level,
        "hobby_tags": th.hobby_tags or [],
        "price_rank": th.price_rank,
        # Timestamps
        "created_at": th.created_at.isoformat() if th.created_at else None,
        "updated_at": th.updated_at.isoformat() if th.updated_at else None,
        # Embedding info
        "has_embedding": th.photo_embedding is not None,
        "embedding_computed_at": th.photo_embedding_computed_at.isoformat()
        if th.photo_embedding_computed_at
        else None,
    }


@router.get("/api/admin/therapists")
async def list_therapists(
    shop_id: UUID | None = Query(default=None, alias="shop_id"),
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    stmt = select(Therapist)
    if shop_id:
        stmt = stmt.where(Therapist.profile_id == shop_id)
    res = await db.execute(stmt.order_by(Therapist.created_at.desc()))
    items = res.scalars().all()
    return {"items": [_serialize(t) for t in items]}


@router.post("/api/admin/therapists", status_code=status.HTTP_201_CREATED)
async def create_therapist(
    payload: TherapistPayload,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name_required")

    th = Therapist(
        id=uuid4(),
        name=name,
        profile_id=payload.shop_id,
        specialties=payload.tags or [],
        photo_urls=[payload.photo_url] if payload.photo_url else [],
        status="draft",
        # Matching tags
        mood_tag=payload.mood_tag,
        style_tag=payload.style_tag,
        look_type=payload.look_type,
        contact_style=payload.contact_style,
        talk_level=payload.talk_level,
        hobby_tags=payload.hobby_tags,
        price_rank=payload.price_rank,
        age=payload.age,
    )
    db.add(th)
    await db.commit()
    await db.refresh(th)
    return _serialize(th)


class TherapistUpdatePayload(BaseModel):
    """Payload for updating therapist fields."""

    # Basic info
    name: str | None = None
    headline: str | None = Field(default=None, description="見出し・キャッチコピー")
    biography: str | None = Field(default=None, description="略歴・自己紹介")
    age: int | None = None

    # Matching tags
    mood_tag: str | None = None
    style_tag: str | None = None
    look_type: str | None = None
    contact_style: str | None = None
    talk_level: str | None = None
    hobby_tags: list[str] | None = None
    price_rank: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] | None = Field(default=None, description="specialties")

    # Status & display
    status: str | None = Field(
        default=None,
        description="公開状態: draft(下書き), active(公開中), inactive(非公開)",
    )
    is_booking_enabled: bool | None = Field(
        default=None, description="予約受付を有効にするか"
    )
    display_order: int | None = Field(default=None, description="表示順序（小さい順）")

    # Photos
    photo_urls: list[str] | None = Field(default=None, description="写真URL配列")
    main_photo_index: int | None = Field(
        default=None, ge=0, description="メイン写真のインデックス"
    )


@router.patch("/api/admin/therapists/{therapist_id}")
async def update_therapist(
    therapist_id: UUID,
    payload: TherapistUpdatePayload,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    """Update therapist fields."""
    result = await db.execute(select(Therapist).where(Therapist.id == therapist_id))
    therapist = result.scalar_one_or_none()

    if not therapist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Therapist not found"
        )

    # Basic info
    if payload.name is not None:
        therapist.name = payload.name.strip()
    if payload.headline is not None:
        therapist.headline = payload.headline.strip() if payload.headline else None
    if payload.biography is not None:
        therapist.biography = payload.biography.strip() if payload.biography else None
    if payload.age is not None:
        therapist.age = payload.age

    # Matching tags
    if payload.mood_tag is not None:
        therapist.mood_tag = payload.mood_tag
    if payload.style_tag is not None:
        therapist.style_tag = payload.style_tag
    if payload.look_type is not None:
        therapist.look_type = payload.look_type
    if payload.contact_style is not None:
        therapist.contact_style = payload.contact_style
    if payload.talk_level is not None:
        therapist.talk_level = payload.talk_level
    if payload.hobby_tags is not None:
        therapist.hobby_tags = payload.hobby_tags
    if payload.price_rank is not None:
        therapist.price_rank = payload.price_rank
    if payload.tags is not None:
        therapist.specialties = payload.tags

    # Status & display
    if payload.status is not None:
        if payload.status not in ("draft", "published", "archived"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="status must be one of: draft, published, archived",
            )
        therapist.status = payload.status
    if payload.is_booking_enabled is not None:
        therapist.is_booking_enabled = payload.is_booking_enabled
    if payload.display_order is not None:
        therapist.display_order = payload.display_order

    # Photos
    if payload.photo_urls is not None:
        therapist.photo_urls = payload.photo_urls
    if payload.main_photo_index is not None:
        # Validate index is within bounds
        photo_count = len(therapist.photo_urls or [])
        if photo_count > 0 and payload.main_photo_index < photo_count:
            therapist.main_photo_index = payload.main_photo_index

    await db.commit()
    await db.refresh(therapist)
    return _serialize(therapist)


class EmbeddingGenerateRequest(BaseModel):
    therapist_ids: list[str] | None = Field(
        default=None,
        description="Specific therapist IDs to regenerate. If None, generates for all without embeddings.",
    )
    force: bool = Field(
        default=False, description="Force regeneration even if embeddings already exist"
    )


class EmbeddingGenerateResponse(BaseModel):
    processed: int
    success: int
    failed: int
    results: dict[str, bool]


@router.post("/api/admin/therapists/embeddings/generate")
async def generate_photo_embeddings(
    payload: EmbeddingGenerateRequest,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
) -> EmbeddingGenerateResponse:
    """Generate or regenerate photo embeddings for therapists.

    This endpoint allows administrators to generate embeddings for:
    - All therapists without embeddings (default)
    - Specific therapist IDs
    - Force regeneration of existing embeddings
    """
    from ...domains.site.services.photo_embedding_service import PhotoEmbeddingService

    service = PhotoEmbeddingService(db)

    # If specific IDs provided, process those
    if payload.therapist_ids:
        therapist_ids = payload.therapist_ids
        # If force is True, process all. Otherwise, filter to those needing computation
        if not payload.force:
            # バッチで再計算が必要かチェック（N+1回避）
            needs_update = await service.needs_recomputation_batch(therapist_ids)
            therapist_ids = [tid for tid, needs in needs_update.items() if needs]
    else:
        # Process all without embeddings (service handles this internally)
        therapist_ids = None

    # Process embeddings
    results = await service.compute_embeddings_batch(
        therapist_ids=therapist_ids,
        limit=100,  # Process max 100 at a time
    )

    # Count results
    processed = len(results)
    success = sum(1 for success in results.values() if success)
    failed = processed - success

    return EmbeddingGenerateResponse(
        processed=processed, success=success, failed=failed, results=results
    )


@router.get("/api/admin/therapists/{therapist_id}/embedding")
async def get_therapist_embedding_status(
    therapist_id: UUID,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    """Get embedding status for a specific therapist."""
    result = await db.execute(select(Therapist).where(Therapist.id == therapist_id))
    therapist = result.scalar_one_or_none()

    if not therapist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Therapist not found"
        )

    return {
        "therapist_id": str(therapist.id),
        "has_embedding": therapist.photo_embedding is not None,
        "embedding_computed_at": therapist.photo_embedding_computed_at.isoformat()
        if therapist.photo_embedding_computed_at
        else None,
        "main_photo_index": therapist.main_photo_index,
        "photo_urls": therapist.photo_urls or [],
        "embedding_dimensions": len(therapist.photo_embedding)
        if therapist.photo_embedding
        else 0,
    }


class BatchEmbeddingRequest(BaseModel):
    batch_size: int = Field(
        default=50, description="Number of therapists to process in each batch"
    )
    max_total: int | None = Field(
        default=None, description="Maximum total number to process"
    )


class BatchEmbeddingResponse(BaseModel):
    status: str
    message: str
    task_id: str | None = None


@router.post("/api/admin/therapists/embeddings/batch")
async def start_batch_embedding_computation(
    payload: BatchEmbeddingRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
) -> BatchEmbeddingResponse:
    """Start batch computation of photo embeddings in the background.

    This endpoint triggers a background task to compute embeddings for
    all therapists without embeddings. The task runs asynchronously.
    """
    from ...domains.async_tasks.photo_embeddings import PhotoEmbeddingTask

    # Generate a task ID for tracking
    task_id = str(uuid4())

    async def run_batch_task():
        """Background task to compute embeddings."""
        try:
            logger.info(f"Starting batch embedding task {task_id}")
            task = PhotoEmbeddingTask()
            stats = await task.compute_all_missing_embeddings(
                batch_size=payload.batch_size, max_total=payload.max_total
            )
            logger.info(f"Batch embedding task {task_id} completed: {stats}")
        except Exception as e:
            logger.error(f"Batch embedding task {task_id} failed: {e}")

    # Add the task to background tasks
    background_tasks.add_task(run_batch_task)

    return BatchEmbeddingResponse(
        status="started",
        message=f"Batch embedding computation started with task_id: {task_id}",
        task_id=task_id,
    )
