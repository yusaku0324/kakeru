from __future__ import annotations

import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
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

