"""Notification settings models."""

from __future__ import annotations

from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
import uuid
from datetime import datetime
from typing import Any, Optional, TYPE_CHECKING

from .base import Base, now_utc

if TYPE_CHECKING:
    from .profile import Profile
    from .user import User


class DashboardNotificationSetting(Base):
    """Dashboard notification settings model."""

    __tablename__ = "dashboard_notification_settings"

    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    trigger_status: Mapped[list[str]] = mapped_column(
        ARRAY(String(32)), nullable=False, default=list
    )
    channels: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    profile: Mapped["Profile"] = relationship(back_populates="notification_setting")
    updated_by_user: Mapped[Optional["User"]] = relationship(
        back_populates="notification_settings_updated"
    )
