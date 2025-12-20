"""Profile (Shop) model."""

from __future__ import annotations

from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy import String, Text, Integer, DateTime, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
import uuid
from datetime import datetime
from typing import Any, TYPE_CHECKING

from .base import Base, StatusProfile, ServiceType, now_utc

if TYPE_CHECKING:
    from .content import Diary
    from .review import Review
    from .favorite import UserFavorite
    from .notification import DashboardNotificationSetting
    from .therapist import Therapist
    from .user import ShopManager


class Profile(Base):
    """Shop profile model."""

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    slug: Mapped[str | None] = mapped_column(
        String(160), unique=True, index=True, nullable=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    area: Mapped[str] = mapped_column(String(80), index=True)
    price_min: Mapped[int] = mapped_column(Integer, index=True)
    price_max: Mapped[int] = mapped_column(Integer, index=True)
    bust_tag: Mapped[str] = mapped_column(String(16), index=True)
    service_type: Mapped[str] = mapped_column(ServiceType, default="store", index=True)
    nearest_station: Mapped[str | None] = mapped_column(
        String(80), nullable=True, index=True
    )
    station_line: Mapped[str | None] = mapped_column(
        String(80), nullable=True, index=True
    )
    station_exit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    station_walk_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    height_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    body_tags: Mapped[list[str] | None] = mapped_column(ARRAY(String(64)))
    photos: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    contact_json: Mapped[dict | None] = mapped_column(JSONB)
    discounts: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
    ranking_badges: Mapped[list[str] | None] = mapped_column(ARRAY(String(32)))
    ranking_weight: Mapped[int | None] = mapped_column(Integer, index=True)
    buffer_minutes: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, server_default="0"
    )
    room_count: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
        server_default="1",
        comment="Max number of overlapping active guest reservations allowed per shop",
    )
    default_slot_duration_minutes: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Default slot duration in minutes (60, 90, 120, etc)",
    )
    status: Mapped[str] = mapped_column(StatusProfile, default="draft", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    diaries: Mapped[list["Diary"]] = relationship(
        back_populates="profile", cascade="all,delete-orphan"
    )
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )
    favorites: Mapped[list["UserFavorite"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )
    notification_setting: Mapped["DashboardNotificationSetting"] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
        uselist=False,
    )
    therapists: Mapped[list["Therapist"]] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
        order_by="Therapist.display_order",
    )
    managers: Mapped[list["ShopManager"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )
