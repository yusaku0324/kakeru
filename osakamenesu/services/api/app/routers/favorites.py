from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from .. import models
from ..db import get_session
from ..deps import require_site_user
from ..schemas import FavoriteCreate, FavoriteItem, TherapistFavoriteCreate, TherapistFavoriteItem

router = APIRouter(prefix="/api/favorites", tags=["favorites"])


@router.get("", response_model=list[FavoriteItem])
async def list_favorites(
    user: models.User = Depends(require_site_user),
    db: AsyncSession = Depends(get_session),
):
    stmt = (
        select(models.UserFavorite)
        .where(models.UserFavorite.user_id == user.id)
        .order_by(models.UserFavorite.created_at.desc())
    )
    result = await db.execute(stmt)
    favorites = result.scalars().all()
    return [FavoriteItem(shop_id=f.shop_id, created_at=f.created_at) for f in favorites]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=FavoriteItem)
async def add_favorite(
    payload: FavoriteCreate,
    user: models.User = Depends(require_site_user),
    db: AsyncSession = Depends(get_session),
):
    profile = await db.get(models.Profile, payload.shop_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop_not_found")

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


@router.delete("/{shop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    shop_id: UUID,
    user: models.User = Depends(require_site_user),
    db: AsyncSession = Depends(get_session),
):
    stmt = (
        delete(models.UserFavorite)
        .where(models.UserFavorite.user_id == user.id, models.UserFavorite.shop_id == shop_id)
    )
    await db.execute(stmt)
    await db.commit()
    return None


@router.get("/therapists", response_model=list[TherapistFavoriteItem])
async def list_therapist_favorites(
    user: models.User = Depends(require_site_user),
    db: AsyncSession = Depends(get_session),
):
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


@router.post("/therapists", status_code=status.HTTP_201_CREATED, response_model=TherapistFavoriteItem)
async def add_therapist_favorite(
    payload: TherapistFavoriteCreate,
    user: models.User = Depends(require_site_user),
    db: AsyncSession = Depends(get_session),
):
    therapist = await db.get(models.Therapist, payload.therapist_id)
    if not therapist:
        raise HTTPException(status_code=404, detail="therapist_not_found")

    shop_id = therapist.profile_id
    favorite = models.UserTherapistFavorite(user_id=user.id, therapist_id=payload.therapist_id)
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

    return TherapistFavoriteItem(
        therapist_id=favorite.therapist_id,
        shop_id=shop_id,
        created_at=favorite.created_at,
    )


@router.delete("/therapists/{therapist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_therapist_favorite(
    therapist_id: UUID,
    user: models.User = Depends(require_site_user),
    db: AsyncSession = Depends(get_session),
):
    stmt = (
        delete(models.UserTherapistFavorite).where(
            models.UserTherapistFavorite.user_id == user.id,
            models.UserTherapistFavorite.therapist_id == therapist_id,
        )
    )
    await db.execute(stmt)
    await db.commit()
    return None
