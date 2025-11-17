from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ... import models
from ...db import get_session
from ...deps import require_site_user
from ...schemas import (
    FavoriteCreate,
    FavoriteItem,
    TherapistFavoriteCreate,
    TherapistFavoriteItem,
)
from .service import FavoritesService

router = APIRouter(prefix="/api/favorites", tags=["favorites"])

_service = FavoritesService()


def _handle_favorites_error(error: FavoritesService.Error):
    raise HTTPException(status_code=error.status_code, detail=error.detail)


@router.get("", response_model=list[FavoriteItem])
async def list_favorites(
    user: models.User = Depends(require_site_user),
    db: AsyncSession = Depends(get_session),
):
    return await _service.list_favorites(user=user, db=db)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=FavoriteItem)
async def add_favorite(
    payload: FavoriteCreate,
    user: models.User = Depends(require_site_user),
    db: AsyncSession = Depends(get_session),
):
    try:
        return await _service.add_favorite(payload=payload, user=user, db=db)
    except FavoritesService.Error as error:
        _handle_favorites_error(error)


@router.delete("/{shop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    shop_id: UUID,
    user: models.User = Depends(require_site_user),
    db: AsyncSession = Depends(get_session),
):
    await _service.remove_favorite(shop_id=shop_id, user=user, db=db)
    return None


@router.get("/therapists", response_model=list[TherapistFavoriteItem])
async def list_therapist_favorites(
    user: models.User = Depends(require_site_user),
    db: AsyncSession = Depends(get_session),
):
    return await _service.list_therapist_favorites(user=user, db=db)


@router.post(
    "/therapists",
    status_code=status.HTTP_201_CREATED,
    response_model=TherapistFavoriteItem,
)
async def add_therapist_favorite(
    payload: TherapistFavoriteCreate,
    user: models.User = Depends(require_site_user),
    db: AsyncSession = Depends(get_session),
):
    try:
        return await _service.add_therapist_favorite(payload=payload, user=user, db=db)
    except FavoritesService.Error as error:
        _handle_favorites_error(error)


@router.delete("/therapists/{therapist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_therapist_favorite(
    therapist_id: UUID,
    user: models.User = Depends(require_site_user),
    db: AsyncSession = Depends(get_session),
):
    await _service.remove_therapist_favorite(
        therapist_id=therapist_id, user=user, db=db
    )
    return None


__all__ = [
    "router",
    "FavoritesService",
    "list_favorites",
    "add_favorite",
    "remove_favorite",
    "list_therapist_favorites",
    "add_therapist_favorite",
    "remove_therapist_favorite",
]
