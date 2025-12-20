"""Review and Report models."""

from __future__ import annotations

from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy import (
    String,
    Text,
    Integer,
    DateTime,
    ForeignKey,
    Date,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime, date
from typing import Any, TYPE_CHECKING

from .base import Base, ReviewStatus, ReportTarget, ReportStatus, now_utc

if TYPE_CHECKING:
    from .profile import Profile


class Review(Base):
    """Shop review model."""

    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint(
            "profile_id", "external_id", name="uq_reviews_profile_external"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(
        ReviewStatus, default="pending", nullable=False, index=True
    )
    external_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    author_alias: Mapped[str | None] = mapped_column(String(80))
    visited_at: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )
    aspect_scores: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        server_default=text("'{}'::jsonb"),
        nullable=False,
    )

    profile: Mapped["Profile"] = relationship(back_populates="reviews")


class Report(Base):
    """Content report model."""

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    target_type: Mapped[str] = mapped_column(ReportTarget, index=True)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    reason: Mapped[str] = mapped_column(String(80))
    note: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(ReportStatus, default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc
    )
