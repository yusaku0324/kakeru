"""Content models (Diary, Availability, Outlink, Click, Consent)."""

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
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from .base import Base, StatusDiary, OutlinkKind, now_utc

if TYPE_CHECKING:
    from .profile import Profile


class Diary(Base):
    """Diary/blog entry model."""

    __tablename__ = "diaries"
    __table_args__ = (
        UniqueConstraint(
            "profile_id", "external_id", name="uq_diaries_profile_external"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    external_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(160))
    text: Mapped[str] = mapped_column(Text)
    photos: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    hashtags: Mapped[list[str] | None] = mapped_column(ARRAY(String(64)))
    status: Mapped[str] = mapped_column(StatusDiary, default="mod", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )

    profile: Mapped["Profile"] = relationship(back_populates="diaries")


class Availability(Base):
    """Availability slots model."""

    __tablename__ = "availabilities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    date: Mapped[datetime] = mapped_column(Date, index=True)
    slots_json: Mapped[dict | None] = mapped_column(JSONB)
    is_today: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class Outlink(Base):
    """External link tracking model."""

    __tablename__ = "outlinks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(OutlinkKind, index=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    target_url: Mapped[str] = mapped_column(Text)
    utm: Mapped[dict | None] = mapped_column(JSONB)


class Click(Base):
    """Click tracking model."""

    __tablename__ = "clicks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    outlink_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlinks.id", ondelete="CASCADE"), index=True
    )
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, index=True
    )
    referer: Mapped[str | None] = mapped_column(Text)
    ua: Mapped[str | None] = mapped_column(Text)
    ip_hash: Mapped[str | None] = mapped_column(String(128), index=True)


class Consent(Base):
    """User consent tracking model."""

    __tablename__ = "consents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    doc_version: Mapped[str] = mapped_column(String(40))
    agreed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc
    )
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(Text)
