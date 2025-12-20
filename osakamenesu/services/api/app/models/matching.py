"""Guest matching log model."""

from __future__ import annotations

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Text, Integer, DateTime, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime, date
from typing import Any

from .base import Base, now_utc


class GuestMatchLog(Base):
    """Guest matching log for analytics / tuning."""

    __tablename__ = "guest_match_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    guest_token: Mapped[str | None] = mapped_column(
        String(128), nullable=True, index=True
    )
    area: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    budget_level: Mapped[str | None] = mapped_column(String(16), nullable=True)
    mood_pref: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    talk_pref: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    style_pref: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    look_pref: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    free_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    phase: Mapped[str | None] = mapped_column(String(32), nullable=True)
    step_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    entry_source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    top_matches: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSONB, nullable=True
    )
    other_candidates: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSONB, nullable=True
    )
    selected_therapist_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    selected_shop_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    selected_slot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False, index=True
    )
