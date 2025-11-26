from __future__ import annotations

import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
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

    class Config:
        populate_by_name = True


def _serialize(th: Therapist) -> dict[str, Any]:
    return {
        "id": str(th.id),
        "name": th.name,
        "profile_id": str(th.profile_id),
        "headline": th.headline,
        "status": th.status,
        "photo_urls": th.photo_urls or [],
        "tags": th.specialties or [],
        "created_at": th.created_at.isoformat() if th.created_at else None,
        "updated_at": th.updated_at.isoformat() if th.updated_at else None,
    }


@router.get("/api/admin/therapists")
async def list_therapists(
    shop_id: UUID | None = Query(default=None, alias="shop_id"),
    db: AsyncSession = Depends(get_session),
):
    stmt = select(Therapist)
    if shop_id:
        stmt = stmt.where(Therapist.profile_id == shop_id)
    res = await db.execute(stmt.order_by(Therapist.created_at.desc()))
    items = res.scalars().all()
    return {"items": [_serialize(t) for t in items]}


@router.post("/api/admin/therapists", status_code=status.HTTP_201_CREATED)
async def create_therapist(payload: TherapistPayload, db: AsyncSession = Depends(get_session)):
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
    )
    db.add(th)
    await db.commit()
    await db.refresh(th)
    return _serialize(th)

