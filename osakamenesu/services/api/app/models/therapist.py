"""Therapist and TherapistShift models."""

from __future__ import annotations

from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy import (
    String,
    Text,
    Integer,
    DateTime,
    ForeignKey,
    Date,
    Boolean,
    Float,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
import uuid
from datetime import datetime, date
from typing import Any, TYPE_CHECKING

from .base import Base, TherapistStatus, TherapistShiftStatus, now_utc

if TYPE_CHECKING:
    from .profile import Profile
    from .favorite import UserTherapistFavorite


class Therapist(Base):
    """Therapist model."""

    __tablename__ = "therapists"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    alias: Mapped[str | None] = mapped_column(String(160), nullable=True)
    headline: Mapped[str | None] = mapped_column(String(255), nullable=True)
    biography: Mapped[str | None] = mapped_column(Text, nullable=True)
    specialties: Mapped[list[str] | None] = mapped_column(ARRAY(String(64)))
    qualifications: Mapped[list[str] | None] = mapped_column(ARRAY(String(128)))
    experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    photo_urls: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    photo_embedding: Mapped[list[float] | None] = mapped_column(
        ARRAY(Float),
        nullable=True,
        comment="Photo embedding vector for similarity matching",
    )
    photo_embedding_computed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When photo embedding was computed",
    )
    main_photo_index: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        server_default="0",
        comment="Index of photo used for embedding",
    )
    mood_tag: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        index=True,
        comment="Mood tag (e.g., gentle, energetic)",
    )
    style_tag: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        index=True,
        comment="Service style tag (e.g., soft, firm)",
    )
    look_type: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        index=True,
        comment="Appearance type (e.g., cute, elegant)",
    )
    contact_style: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        index=True,
        comment="Contact style (e.g., light, deep)",
    )
    talk_level: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        index=True,
        comment="Conversation level (e.g., chatty, quiet)",
    )
    hobby_tags: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(32)), nullable=True, comment="Hobby/interest tags"
    )
    price_rank: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="Price tier (1-5)"
    )
    age: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="Age for matching"
    )
    display_order: Mapped[int] = mapped_column(Integer, server_default="0", index=True)
    status: Mapped[str] = mapped_column(
        TherapistStatus, default="draft", nullable=False, index=True
    )
    is_booking_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    profile: Mapped["Profile"] = relationship(back_populates="therapists")
    favorited_by: Mapped[list["UserTherapistFavorite"]] = relationship(
        back_populates="therapist",
        cascade="all, delete-orphan",
    )


class TherapistShift(Base):
    """Therapist shift model."""

    __tablename__ = "therapist_shifts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    therapist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    shop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    break_slots: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSONB, nullable=True
    )
    availability_status: Mapped[str] = mapped_column(
        TherapistShiftStatus, nullable=False, default="available"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "therapist_id", "start_at", "end_at", name="uq_therapist_shifts_slot"
        ),
    )
