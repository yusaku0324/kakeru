from __future__ import annotations

import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...models import Profile

logger = logging.getLogger(__name__)

router = APIRouter()


class ContactInfo(BaseModel):
    phone: str | None = None
    line_id: str | None = None
    website_url: str | None = None


class ShopPayload(BaseModel):
    name: str
    area: str | None = None
    url: str | None = Field(default=None, description="public website or landing page")
    # Extended fields
    price_min: int | None = Field(default=None, ge=0, description="Minimum price")
    price_max: int | None = Field(default=None, ge=0, description="Maximum price")
    nearest_station: str | None = Field(
        default=None, description="Nearest station name"
    )
    station_walk_minutes: int | None = Field(
        default=None, ge=0, description="Walk minutes from station"
    )
    photos: list[str] | None = Field(default=None, description="List of photo URLs")
    contact: ContactInfo | None = Field(default=None, description="Contact information")


def _serialize(shop: Profile) -> dict[str, Any]:
    contact = shop.contact_json or {}
    return {
        "id": str(shop.id),
        "name": shop.name,
        "area": shop.area,
        "status": shop.status,
        "buffer_minutes": shop.buffer_minutes,
        "url": contact.get("url"),
        "price_min": shop.price_min,
        "price_max": shop.price_max,
        "nearest_station": shop.nearest_station,
        "station_walk_minutes": shop.station_walk_minutes,
        "photos": shop.photos or [],
        "contact": {
            "phone": contact.get("phone"),
            "line_id": contact.get("line_id"),
            "website_url": contact.get("website_url"),
        }
        if any(contact.get(k) for k in ("phone", "line_id", "website_url"))
        else None,
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

    # Build contact_json from payload
    contact_json: dict[str, Any] | None = None
    if payload.url or payload.contact:
        contact_json = {}
        if payload.url:
            contact_json["url"] = payload.url
        if payload.contact:
            if payload.contact.phone:
                contact_json["phone"] = payload.contact.phone
            if payload.contact.line_id:
                contact_json["line_id"] = payload.contact.line_id
            if payload.contact.website_url:
                contact_json["website_url"] = payload.contact.website_url

    # Profile には price_min/price_max/bust_tag などの必須があるため最小限のデフォルトをセット
    shop = Profile(
        id=uuid4(),
        name=name,
        area=payload.area or "unspecified",
        price_min=payload.price_min or 0,
        price_max=payload.price_max or 0,
        bust_tag="unspecified",
        nearest_station=payload.nearest_station,
        station_walk_minutes=payload.station_walk_minutes,
        photos=payload.photos,
        contact_json=contact_json,
    )
    db.add(shop)
    await db.commit()
    await db.refresh(shop)
    return _serialize(shop)


class UpdateBufferMinutesPayload(BaseModel):
    buffer_minutes: int = Field(
        ge=0, le=120, description="Buffer minutes between reservations (0-120)"
    )

    @field_validator("buffer_minutes")
    @classmethod
    def validate_buffer_minutes(cls, v: int) -> int:
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
    db: AsyncSession = Depends(get_session),
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
