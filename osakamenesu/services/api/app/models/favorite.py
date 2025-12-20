"""User favorites models."""

from __future__ import annotations

from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from .base import Base, now_utc

if TYPE_CHECKING:
    from .user import User
    from .profile import Profile
    from .therapist import Therapist


class UserFavorite(Base):
    """User shop favorite model."""

    __tablename__ = "user_favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "shop_id", name="uq_user_favorites_user_shop"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    shop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="favorites")
    profile: Mapped["Profile"] = relationship(back_populates="favorites")


class UserTherapistFavorite(Base):
    """User therapist favorite model."""

    __tablename__ = "user_therapist_favorites"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "therapist_id", name="uq_user_therapist_favorites_user_therapist"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    therapist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("therapists.id", ondelete="CASCADE"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="therapist_favorites")
    therapist: Mapped["Therapist"] = relationship(back_populates="favorited_by")
