"""Schemas for shop manager management."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr


class ShopManagerItem(BaseModel):
    """A single shop manager."""

    id: UUID
    user_id: UUID
    email: str
    display_name: str | None
    role: Literal["owner", "manager", "staff"]
    created_at: datetime


class ShopManagerListResponse(BaseModel):
    """Response for listing shop managers."""

    managers: list[ShopManagerItem]


class AddShopManagerRequest(BaseModel):
    """Request to add a new shop manager."""

    email: EmailStr
    role: Literal["owner", "manager", "staff"] = "staff"


class AddShopManagerResponse(BaseModel):
    """Response after adding a shop manager."""

    id: UUID
    user_id: UUID
    email: str
    display_name: str | None
    role: str
    created_at: datetime
    user_created: bool  # True if user was newly created


class UpdateShopManagerRequest(BaseModel):
    """Request to update a shop manager's role."""

    role: Literal["owner", "manager", "staff"]


class UpdateShopManagerResponse(BaseModel):
    """Response after updating a shop manager."""

    id: UUID
    user_id: UUID
    email: str
    display_name: str | None
    role: str


class DeleteShopManagerResponse(BaseModel):
    """Response after deleting a shop manager."""

    deleted: bool
    message: str
