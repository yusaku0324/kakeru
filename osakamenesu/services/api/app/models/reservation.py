"""Reservation and notification delivery models."""

from __future__ import annotations

from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy import (
    String,
    Text,
    Integer,
    DateTime,
    ForeignKey,
    Boolean,
    Float,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime
from typing import Any, TYPE_CHECKING

from .base import (
    Base,
    ReservationStatus,
    ReservationSlotStatus,
    GuestReservationStatus,
    now_utc,
)

if TYPE_CHECKING:
    from .user import User


class Reservation(Base):
    """Dashboard reservation model."""

    __tablename__ = "reservations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    shop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    staff_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    menu_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    channel: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    desired_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    desired_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        ReservationStatus, default="pending", index=True
    )
    marketing_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    customer_name: Mapped[str] = mapped_column(String(120))
    customer_phone: Mapped[str] = mapped_column(String(40))
    customer_email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    customer_line_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    customer_remark: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )
    reminder_scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    status_events: Mapped[list["ReservationStatusEvent"]] = relationship(
        back_populates="reservation",
        cascade="all, delete-orphan",
        order_by="ReservationStatusEvent.changed_at",
    )
    notification_deliveries: Mapped[list["ReservationNotificationDelivery"]] = (
        relationship(
            back_populates="reservation",
            cascade="all, delete-orphan",
            order_by="ReservationNotificationDelivery.created_at",
        )
    )
    user: Mapped["User | None"] = relationship(back_populates="reservations")
    preferred_slots: Mapped[list["ReservationPreferredSlot"]] = relationship(
        back_populates="reservation",
        cascade="all, delete-orphan",
        order_by="ReservationPreferredSlot.desired_start",
    )


class ReservationStatusEvent(Base):
    """Reservation status change event model."""

    __tablename__ = "reservation_status_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reservations.id", ondelete="CASCADE"),
        index=True,
    )
    status: Mapped[str] = mapped_column(ReservationStatus, nullable=False, index=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False, index=True
    )
    changed_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    note: Mapped[str | None] = mapped_column(Text)

    reservation: Mapped["Reservation"] = relationship(back_populates="status_events")


class ReservationPreferredSlot(Base):
    """Reservation preferred time slot model."""

    __tablename__ = "reservation_preferred_slots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reservations.id", ondelete="CASCADE"),
        index=True,
    )
    desired_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    desired_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    status: Mapped[str] = mapped_column(
        ReservationSlotStatus, nullable=False, default="open", index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )

    reservation: Mapped["Reservation"] = relationship(back_populates="preferred_slots")


class ReservationNotificationChannelOption(Base):
    """Notification channel option model."""

    __tablename__ = "reservation_notification_channels"

    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)

    deliveries: Mapped[list["ReservationNotificationDelivery"]] = relationship(
        back_populates="channel_option"
    )


class ReservationNotificationStatusOption(Base):
    """Notification status option model."""

    __tablename__ = "reservation_notification_statuses"

    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)

    deliveries: Mapped[list["ReservationNotificationDelivery"]] = relationship(
        back_populates="status_option"
    )


class ReservationNotificationAttemptStatusOption(Base):
    """Notification attempt status option model."""

    __tablename__ = "reservation_notification_attempt_statuses"

    key: Mapped[str] = mapped_column(String(16), primary_key=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)

    attempts: Mapped[list["ReservationNotificationAttempt"]] = relationship(
        back_populates="status_option"
    )


class ReservationNotificationDelivery(Base):
    """Notification delivery model."""

    __tablename__ = "reservation_notification_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reservations.id", ondelete="CASCADE"),
        index=True,
    )
    channel: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("reservation_notification_channels.key", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("reservation_notification_statuses.key", ondelete="RESTRICT"),
        default="pending",
        nullable=False,
        index=True,
    )
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_attempt_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=now_utc, index=True
    )
    last_attempt_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )
    channel_option: Mapped["ReservationNotificationChannelOption"] = relationship(
        back_populates="deliveries"
    )
    status_option: Mapped["ReservationNotificationStatusOption"] = relationship(
        back_populates="deliveries"
    )

    reservation: Mapped["Reservation"] = relationship(
        back_populates="notification_deliveries"
    )
    attempts: Mapped[list["ReservationNotificationAttempt"]] = relationship(
        back_populates="delivery",
        cascade="all, delete-orphan",
        order_by="ReservationNotificationAttempt.attempted_at",
    )


class ReservationNotificationAttempt(Base):
    """Notification delivery attempt model."""

    __tablename__ = "reservation_notification_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    delivery_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reservation_notification_deliveries.id", ondelete="CASCADE"),
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(16),
        ForeignKey(
            "reservation_notification_attempt_statuses.key", ondelete="RESTRICT"
        ),
        nullable=False,
        index=True,
    )
    response_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False, index=True
    )
    status_option: Mapped["ReservationNotificationAttemptStatusOption"] = relationship(
        back_populates="attempts"
    )

    delivery: Mapped["ReservationNotificationDelivery"] = relationship(
        back_populates="attempts"
    )


class GuestReservation(Base):
    """Guest reservation model."""

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
