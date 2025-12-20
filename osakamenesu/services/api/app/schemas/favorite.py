"""Favorite schemas."""

from .base import BaseModel, UUID, datetime


class FavoriteItem(BaseModel):
    shop_id: UUID
    created_at: datetime


class FavoriteCreate(BaseModel):
    shop_id: UUID


class TherapistFavoriteItem(BaseModel):
    therapist_id: UUID
    shop_id: UUID
    created_at: datetime


class TherapistFavoriteCreate(BaseModel):
    therapist_id: UUID
