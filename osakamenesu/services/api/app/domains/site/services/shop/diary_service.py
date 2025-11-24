from __future__ import annotations

from typing import List
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.schemas import DiaryItem, DiaryListResponse

from .shared import ShopNotFoundError


async def _count_published_diaries(db: AsyncSession, profile_id: UUID) -> int:
    stmt = (
        select(func.count())
        .select_from(models.Diary)
        .where(
            models.Diary.profile_id == profile_id, models.Diary.status == "published"
        )
    )
    result = await db.execute(stmt)
    return int(result.scalar_one())


async def _fetch_published_diaries(
    db: AsyncSession,
    profile_id: UUID,
    *,
    limit: int,
    offset: int,
) -> List[models.Diary]:
    stmt = (
        select(models.Diary)
        .where(
            models.Diary.profile_id == profile_id, models.Diary.status == "published"
        )
        .order_by(models.Diary.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


def _serialize_diary(diary: models.Diary) -> DiaryItem:
    photos = list(diary.photos or []) if isinstance(diary.photos, list) else []
    hashtags = list(diary.hashtags or []) if isinstance(diary.hashtags, list) else []
    return DiaryItem(
        id=diary.id,
        profile_id=diary.profile_id,
        title=diary.title,
        body=diary.text,
        photos=photos,
        hashtags=hashtags,
        created_at=diary.created_at,
    )


from .shared import ShopNotFoundError


class ShopDiaryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_diaries(
        self, shop_id: UUID, *, page: int = 1, page_size: int = 6
    ) -> DiaryListResponse:
        total = await _count_published_diaries(self.db, shop_id)
        if total == 0:
            return DiaryListResponse(total=0, items=[])
        offset = (page - 1) * page_size
        diaries = await _fetch_published_diaries(
            self.db, shop_id, limit=page_size, offset=offset
        )
        items = [_serialize_diary(diary) for diary in diaries]
        return DiaryListResponse(total=total, items=items)
