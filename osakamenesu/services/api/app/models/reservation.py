"""GuestReservation model - the unified reservation model for all booking channels."""

from __future__ import annotations

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import (
    String,
    Text,
    Integer,
    DateTime,
    ForeignKey,
    Float,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime

from .base import (
    Base,
    GuestReservationStatus,
    now_utc,
)


class GuestReservation(Base):
    """Guest reservation model - unified reservation for all channels (web, phone, LINE)."""

    __tablename__ = "guest_reservations"
    __table_args__ = (
        # Composite indexes for common query patterns
        Index("ix_guest_reservations_therapist_start", "therapist_id", "start_at"),
        Index("ix_guest_reservations_shop_start", "shop_id", "start_at"),
        Index(
            "ix_guest_reservations_status_reserved_until", "status", "reserved_until"
        ),
        Index("ix_guest_reservations_user_start", "user_id", "start_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    shop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    therapist_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("therapists.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    start_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    planned_extension_minutes: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, server_default="0"
    )
    buffer_minutes: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, server_default="0"
    )
    reserved_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    idempotency_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(64), nullable=True)
    contact_info: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    guest_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        GuestReservationStatus, nullable=False, index=True, default="pending"
    )
    base_staff_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    channel: Mapped[str | None] = mapped_column(
        String(32), nullable=True, index=True, default="web"
    )
    customer_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    customer_email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )
