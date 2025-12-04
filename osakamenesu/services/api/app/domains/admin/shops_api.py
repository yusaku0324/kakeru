from __future__ import annotations

import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...models import Profile

logger = logging.getLogger(__name__)

router = APIRouter()


class ShopPayload(BaseModel):
    name: str
    area: str | None = None
    url: str | None = Field(default=None, description="public website or landing page")


def _serialize(shop: Profile) -> dict[str, Any]:
    return {
        "id": str(shop.id),
        "name": shop.name,
        "area": shop.area,
        "status": shop.status,
        "buffer_minutes": shop.buffer_minutes,
        "url": (shop.contact_json or {}).get("url") if shop.contact_json else None,
        "created_at": shop.created_at.isoformat() if shop.created_at else None,
        "updated_at": shop.updated_at.isoformat() if shop.updated_at else None,
    }


@router.get("/api/admin/shops")
async def list_shops(db: AsyncSession = Depends(get_session)):
    res = await db.execute(select(Profile).order_by(Profile.created_at.desc()))
    items = res.scalars().all()
    return {"items": [_serialize(shop) for shop in items]}


@router.post("/api/admin/shops", status_code=status.HTTP_201_CREATED)
async def create_shop(payload: ShopPayload, db: AsyncSession = Depends(get_session)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name_required")
    # Profile には price_min/price_max/bust_tag などの必須があるため最小限のデフォルトをセット
    shop = Profile(
        id=uuid4(),
        name=name,
        area=payload.area or "unspecified",
        price_min=0,
        price_max=0,
        bust_tag="unspecified",
        contact_json={"url": payload.url} if payload.url else None,
    )
    db.add(shop)
    await db.commit()
    await db.refresh(shop)
    return _serialize(shop)


class UpdateBufferMinutesPayload(BaseModel):
    buffer_minutes: int = Field(ge=0, le=120, description="Buffer minutes between reservations (0-120)")

    @validator("buffer_minutes")
    def validate_buffer_minutes(cls, v):
        if v < 0 or v > 120:
            raise ValueError("Buffer minutes must be between 0 and 120")
        return v


@router.get("/api/admin/shops/{shop_id}")
async def get_shop(shop_id: UUID, db: AsyncSession = Depends(get_session)):
    """Get a specific shop by ID."""
    res = await db.execute(select(Profile).where(Profile.id == shop_id))
    shop = res.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="shop_not_found")
    return _serialize(shop)


@router.patch("/api/admin/shops/{shop_id}/buffer")
async def update_shop_buffer(
    shop_id: UUID,
    payload: UpdateBufferMinutesPayload,
    db: AsyncSession = Depends(get_session)
):
    """Update buffer minutes for a shop."""
    res = await db.execute(select(Profile).where(Profile.id == shop_id))
    shop = res.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="shop_not_found")

    shop.buffer_minutes = payload.buffer_minutes
    await db.commit()
    await db.refresh(shop)
    return {"message": "Buffer minutes updated", "buffer_minutes": shop.buffer_minutes}

