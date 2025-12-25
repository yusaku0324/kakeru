"""Push subscription model for PWA notifications."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Text,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import uuid

from .base import Base, now_utc

if TYPE_CHECKING:
    from .user import User


class PushSubscription(Base):
    """Push subscription model for storing PWA push notification subscriptions."""

    __tablename__ = "push_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    p256dh: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # Public key for encryption
    auth: Mapped[str] = mapped_column(Text, nullable=False)  # Auth secret
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="push_subscriptions")

    # Indexes
    __table_args__ = (
        Index("ix_push_subscriptions_user_id", "user_id"),
        Index("ix_push_subscriptions_endpoint", "endpoint"),
        Index("ix_push_subscriptions_user_active", "user_id", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<PushSubscription(id={self.id}, user_id={self.user_id}, active={self.is_active})>"
