from __future__ import annotations

import logging
from typing import List
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ... import models
from ...schemas import (
    FavoriteCreate,
    FavoriteItem,
    TherapistFavoriteCreate,
    TherapistFavoriteItem,
)

PLAYWRIGHT_SEED_SHOP_SLUG = "playwright-seed-shop"
SAMPLE_THERAPISTS: dict[UUID, dict[str, str]] = {
    UUID("11111111-1111-1111-8888-111111111111"): {
        "name": "葵",
        "alias": "指名No.1",
        "headline": "丁寧な接客で人気のトップセラピストです。",
        "specialties": ["ホットストーン", "ディープリンパ"],
    },
    UUID("22222222-2222-2222-8888-222222222222"): {
        "name": "凛",
        "alias": "新人",
        "headline": "ストレッチと指圧の組み合わせが得意です。",
        "specialties": ["ストレッチ", "ストーン"],
    },
}

logger = logging.getLogger("app.site.favorites")


class FavoritesService:
    """Business logic for site favorites routes."""

    class Error(Exception):
        def __init__(self, status_code: int, detail: str) -> None:
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    async def list_favorites(
        self, *, user: models.User, db: AsyncSession
    ) -> List[FavoriteItem]:
        stmt = (
            select(models.UserFavorite)
            .where(models.UserFavorite.user_id == user.id)
            .order_by(models.UserFavorite.created_at.desc())
        )
        result = await db.execute(stmt)
        favorites = result.scalars().all()
        return [
            FavoriteItem(shop_id=f.shop_id, created_at=f.created_at) for f in favorites
        ]

    async def add_favorite(
        self,
        *,
        payload: FavoriteCreate,
        user: models.User,
        db: AsyncSession,
    ) -> FavoriteItem:
        profile = await db.get(models.Profile, payload.shop_id)
        if not profile:
            raise FavoritesService.Error(404, "shop_not_found")

        favorite = models.UserFavorite(user_id=user.id, shop_id=payload.shop_id)
        db.add(favorite)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            stmt = select(models.UserFavorite).where(
                models.UserFavorite.user_id == user.id,
                models.UserFavorite.shop_id == payload.shop_id,
            )
            result = await db.execute(stmt)
            favorite = result.scalar_one()
        else:
            await db.refresh(favorite)

        return FavoriteItem(shop_id=favorite.shop_id, created_at=favorite.created_at)

    async def remove_favorite(
        self, *, shop_id: UUID, user: models.User, db: AsyncSession
    ) -> None:
        stmt = delete(models.UserFavorite).where(
            models.UserFavorite.user_id == user.id,
            models.UserFavorite.shop_id == shop_id,
        )
        await db.execute(stmt)
        await db.commit()

    async def list_therapist_favorites(
        self,
        *,
        user: models.User,
        db: AsyncSession,
    ) -> List[TherapistFavoriteItem]:
        stmt = (
            select(models.UserTherapistFavorite)
            .where(models.UserTherapistFavorite.user_id == user.id)
            .order_by(models.UserTherapistFavorite.created_at.desc())
        )
        result = await db.execute(stmt)
        favorites = result.scalars().all()
        if not favorites:
            return []

        therapist_ids = {favorite.therapist_id for favorite in favorites}
        therapist_stmt = select(models.Therapist.id, models.Therapist.profile_id).where(
            models.Therapist.id.in_(therapist_ids)
        )
        therapist_result = await db.execute(therapist_stmt)
        therapist_map = {row.id: row.profile_id for row in therapist_result.all()}

        items: list[TherapistFavoriteItem] = []
        for favorite in favorites:
            shop_id = therapist_map.get(favorite.therapist_id)
            if shop_id is None:
                continue
            items.append(
                TherapistFavoriteItem(
                    therapist_id=favorite.therapist_id,
                    shop_id=shop_id,
                    created_at=favorite.created_at,
                )
            )
        return items

    async def add_therapist_favorite(
        self,
        *,
        payload: TherapistFavoriteCreate,
        user: models.User,
        db: AsyncSession,
    ) -> TherapistFavoriteItem:
        therapist = await db.get(models.Therapist, payload.therapist_id)
        if therapist is None:
            logger.info(
                "therapist %s not found; attempting sample bootstrap",
                payload.therapist_id,
            )
            therapist = await self._ensure_sample_therapist(payload.therapist_id, db)
        if not therapist:
            logger.warning("therapist %s missing; returning 404", payload.therapist_id)
            raise FavoritesService.Error(404, "therapist_not_found")

        favorite = models.UserTherapistFavorite(
            user_id=user.id, therapist_id=payload.therapist_id
        )
        db.add(favorite)

        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            stmt = select(models.UserTherapistFavorite).where(
                models.UserTherapistFavorite.user_id == user.id,
                models.UserTherapistFavorite.therapist_id == payload.therapist_id,
            )
            result = await db.execute(stmt)
            favorite = result.scalar_one()
        else:
            await db.refresh(favorite)

        item = TherapistFavoriteItem(
            therapist_id=favorite.therapist_id,
            shop_id=therapist.profile_id,
            created_at=favorite.created_at,
        )
        logger.info("user %s favorited therapist %s", user.id, favorite.therapist_id)
        return item

    async def _ensure_sample_therapist(
        self,
        therapist_id: UUID,
        db: AsyncSession,
    ) -> models.Therapist | None:
        sample = SAMPLE_THERAPISTS.get(therapist_id)
        if not sample:
            return None

        result = await db.execute(
            select(models.Profile).where(
                models.Profile.slug == PLAYWRIGHT_SEED_SHOP_SLUG
            )
        )
        profile = result.scalar_one_or_none()
        if not profile:
            logger.warning(
                "sample therapist %s requested but seed shop missing", therapist_id
            )
            return None

        existing = await db.execute(
            select(models.Therapist).where(models.Therapist.id == therapist_id)
        )
        therapist = existing.scalar_one_or_none()
        if therapist:
            return therapist

        therapist = models.Therapist(
            id=therapist_id,
            profile_id=profile.id,
            name=sample["name"],
            alias=sample.get("alias"),
            headline=sample.get("headline"),
            specialties=list(sample.get("specialties") or []),
            status="published",
            is_booking_enabled=True,
            display_order=0,
        )
        db.add(therapist)
        await db.commit()
        await db.refresh(therapist)
        logger.info(
            "bootstrapped sample therapist %s for profile %s", therapist_id, profile.id
        )
        return therapist

    async def remove_therapist_favorite(
        self,
        *,
        therapist_id: UUID,
        user: models.User,
        db: AsyncSession,
    ) -> None:
        stmt = delete(models.UserTherapistFavorite).where(
            models.UserTherapistFavorite.user_id == user.id,
            models.UserTherapistFavorite.therapist_id == therapist_id,
        )
        await db.execute(stmt)
        await db.commit()


__all__ = ["FavoritesService"]
