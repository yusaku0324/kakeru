from __future__ import annotations

from sqlalchemy.orm import declarative_base, relationship, Mapped, mapped_column
from sqlalchemy import (
    String,
    Text,
    Integer,
    Enum,
    DateTime,
    ForeignKey,
    Date,
    Boolean,
    UniqueConstraint,
    Float,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
import uuid
from datetime import datetime, date, UTC
from typing import Any, Optional


Base = declarative_base()


StatusProfile = Enum('draft', 'published', 'hidden', name='status_profile')
StatusDiary = Enum('mod', 'published', 'hidden', name='status_diary')
OutlinkKind = Enum('line', 'tel', 'web', name='outlink_kind')
ReportTarget = Enum('profile', 'diary', name='report_target')
ReportStatus = Enum('open', 'closed', name='report_status')
ReviewStatus = Enum('pending', 'published', 'rejected', name='review_status')
TherapistStatus = Enum('draft', 'published', 'archived', name='therapist_status')
# bust_tag はマイグレーション互換性のため VARCHAR で運用
ServiceType = Enum('store', 'dispatch', name='service_type')
ReservationStatus = Enum('pending', 'confirmed', 'declined', 'cancelled', 'expired', name='reservation_status')
ReservationSlotStatus = Enum('open', 'tentative', 'blocked', name='reservation_slot_status')
RESERVATION_NOTIFICATION_CHANNEL_KEYS = ('email', 'slack', 'line', 'log')
RESERVATION_NOTIFICATION_STATUS_KEYS = ('pending', 'in_progress', 'succeeded', 'failed', 'cancelled')
RESERVATION_NOTIFICATION_ATTEMPT_STATUS_KEYS = ('success', 'failure')


def now_utc() -> datetime:
    return datetime.now(UTC)


class Profile(Base):
    __tablename__ = 'profiles'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str | None] = mapped_column(String(160), unique=True, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    area: Mapped[str] = mapped_column(String(80), index=True)
    price_min: Mapped[int] = mapped_column(Integer, index=True)
    price_max: Mapped[int] = mapped_column(Integer, index=True)
    bust_tag: Mapped[str] = mapped_column(String(16), index=True)
    service_type: Mapped[str] = mapped_column(ServiceType, default='store', index=True)
    nearest_station: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    station_line: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    station_exit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    station_walk_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Optional stats
    height_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    body_tags: Mapped[list[str] | None] = mapped_column(ARRAY(String(64)))
    photos: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    contact_json: Mapped[dict | None] = mapped_column(JSONB)
    discounts: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
    ranking_badges: Mapped[list[str] | None] = mapped_column(ARRAY(String(32)))
    ranking_weight: Mapped[int | None] = mapped_column(Integer, index=True)
    status: Mapped[str] = mapped_column(StatusProfile, default='draft', index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    diaries: Mapped[list["Diary"]] = relationship(back_populates='profile', cascade='all,delete-orphan')
    reviews: Mapped[list["Review"]] = relationship(back_populates='profile', cascade='all, delete-orphan')
    favorites: Mapped[list[UserFavorite]] = relationship(back_populates='profile', cascade='all, delete-orphan')
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


class Therapist(Base):
    __tablename__ = 'therapists'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('profiles.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    alias: Mapped[str | None] = mapped_column(String(160), nullable=True)
    headline: Mapped[str | None] = mapped_column(String(255), nullable=True)
    biography: Mapped[str | None] = mapped_column(Text, nullable=True)
    specialties: Mapped[list[str] | None] = mapped_column(ARRAY(String(64)))
    qualifications: Mapped[list[str] | None] = mapped_column(ARRAY(String(128)))
    experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    photo_urls: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    display_order: Mapped[int] = mapped_column(Integer, server_default="0", index=True)
    status: Mapped[str] = mapped_column(TherapistStatus, default='draft', nullable=False, index=True)
    is_booking_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    profile: Mapped[Profile] = relationship(back_populates='therapists')
    favorited_by: Mapped[list["UserTherapistFavorite"]] = relationship(
        back_populates="therapist",
        cascade="all, delete-orphan",
    )


class User(Base):
    __tablename__ = 'users'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default='active')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    auth_tokens: Mapped[list[UserAuthToken]] = relationship(back_populates='user', cascade='all, delete-orphan')
    sessions: Mapped[list[UserSession]] = relationship(back_populates='user', cascade='all, delete-orphan')
    favorites: Mapped[list[UserFavorite]] = relationship(back_populates='user', cascade='all, delete-orphan')
    therapist_favorites: Mapped[list["UserTherapistFavorite"]] = relationship(
        back_populates='user',
        cascade='all, delete-orphan',
    )
    reservations: Mapped[list[Reservation]] = relationship(back_populates='user')
    notification_settings_updated: Mapped[list["DashboardNotificationSetting"]] = relationship(
        back_populates="updated_by_user"
    )


class UserAuthToken(Base):
    __tablename__ = 'user_auth_tokens'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(256), nullable=True)
    scope: Mapped[str] = mapped_column(String(32), default='dashboard', nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    user: Mapped[User] = relationship(back_populates='auth_tokens')




class GuestMatchLog(Base):
    """
    Guest matching log for analytics / tuning.
    Fields are optional to avoid impacting existing flows.
    """

    __tablename__ = 'guest_match_logs'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    guest_token: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    area: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    budget_level: Mapped[str | None] = mapped_column(String(16), nullable=True)
    mood_pref: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    talk_pref: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    style_pref: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    look_pref: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    free_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    top_matches: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    other_candidates: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    selected_therapist_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    selected_shop_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    selected_slot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)

class UserSession(Base):
    __tablename__ = 'user_sessions'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(256), nullable=True)
    scope: Mapped[str] = mapped_column(String(32), default='dashboard', nullable=False)

    user: Mapped[User] = relationship(back_populates='sessions')


class UserFavorite(Base):
    __tablename__ = 'user_favorites'
    __table_args__ = (UniqueConstraint('user_id', 'shop_id', name='uq_user_favorites_user_shop'),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), index=True)
    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('profiles.id', ondelete='CASCADE'), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    user: Mapped[User] = relationship(back_populates='favorites')
    profile: Mapped[Profile] = relationship(back_populates='favorites')


class UserTherapistFavorite(Base):
    __tablename__ = 'user_therapist_favorites'
    __table_args__ = (
        UniqueConstraint('user_id', 'therapist_id', name='uq_user_therapist_favorites_user_therapist'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        index=True,
    )
    therapist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('therapists.id', ondelete='CASCADE'),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    user: Mapped[User] = relationship(back_populates='therapist_favorites')
    therapist: Mapped[Therapist] = relationship(back_populates='favorited_by')


class Diary(Base):
    __tablename__ = 'diaries'
    __table_args__ = (
        UniqueConstraint('profile_id', 'external_id', name='uq_diaries_profile_external'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('profiles.id', ondelete='CASCADE'), index=True)
    external_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(160))
    text: Mapped[str] = mapped_column(Text)
    photos: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    hashtags: Mapped[list[str] | None] = mapped_column(ARRAY(String(64)))
    status: Mapped[str] = mapped_column(StatusDiary, default='mod', index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    profile: Mapped["Profile"] = relationship(back_populates='diaries')


class Availability(Base):
    __tablename__ = 'availabilities'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('profiles.id', ondelete='CASCADE'), index=True)
    date: Mapped[datetime] = mapped_column(Date, index=True)
    slots_json: Mapped[dict | None] = mapped_column(JSONB)
    is_today: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class Outlink(Base):
    __tablename__ = 'outlinks'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('profiles.id', ondelete='CASCADE'), index=True)
    kind: Mapped[str] = mapped_column(OutlinkKind, index=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    target_url: Mapped[str] = mapped_column(Text)
    utm: Mapped[dict | None] = mapped_column(JSONB)


class Click(Base):
    __tablename__ = 'clicks'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    outlink_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('outlinks.id', ondelete='CASCADE'), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)
    referer: Mapped[str | None] = mapped_column(Text)
    ua: Mapped[str | None] = mapped_column(Text)
    ip_hash: Mapped[str | None] = mapped_column(String(128), index=True)


class Consent(Base):
    __tablename__ = 'consents'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('profiles.id', ondelete='CASCADE'), index=True)
    doc_version: Mapped[str] = mapped_column(String(40))
    agreed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(Text)


class Report(Base):
    __tablename__ = 'reports'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    target_type: Mapped[str] = mapped_column(ReportTarget, index=True)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    reason: Mapped[str] = mapped_column(String(80))
    note: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(ReportStatus, default='open', index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Review(Base):
    __tablename__ = 'reviews'
    __table_args__ = (
        UniqueConstraint('profile_id', 'external_id', name='uq_reviews_profile_external'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('profiles.id', ondelete='CASCADE'), index=True)
    status: Mapped[str] = mapped_column(ReviewStatus, default='pending', nullable=False, index=True)
    external_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    author_alias: Mapped[str | None] = mapped_column(String(80))
    visited_at: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)
    aspect_scores: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        server_default=text("'{}'::jsonb"),
        nullable=False,
    )

    profile: Mapped["Profile"] = relationship(back_populates='reviews')


class DashboardNotificationSetting(Base):
    __tablename__ = 'dashboard_notification_settings'

    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('profiles.id', ondelete='CASCADE'), primary_key=True
    )
    trigger_status: Mapped[list[str]] = mapped_column(ARRAY(String(32)), nullable=False, default=list)
    channels: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True
    )

    profile: Mapped[Profile] = relationship(back_populates='notification_setting')
    updated_by_user: Mapped[Optional[User]] = relationship(back_populates='notification_settings_updated')


class AdminLog(Base):
    __tablename__ = 'admin_logs'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)
    method: Mapped[str] = mapped_column(String(8))
    path: Mapped[str] = mapped_column(String(200), index=True)
    ip_hash: Mapped[str | None] = mapped_column(String(128), index=True)
    admin_key_hash: Mapped[str | None] = mapped_column(String(128))
    details: Mapped[dict | None] = mapped_column(JSONB)


class AdminChangeLog(Base):
    __tablename__ = 'admin_change_logs'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)
    target_type: Mapped[str] = mapped_column(String(64), index=True)
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(32))
    before_json: Mapped[dict | None] = mapped_column(JSONB)
    after_json: Mapped[dict | None] = mapped_column(JSONB)
    admin_key_hash: Mapped[str | None] = mapped_column(String(128), index=True)
    ip_hash: Mapped[str | None] = mapped_column(String(128), index=True)


class Reservation(Base):
    __tablename__ = 'reservations'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('profiles.id', ondelete='CASCADE'), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    staff_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    menu_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    channel: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    desired_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    desired_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(ReservationStatus, default='pending', index=True)
    marketing_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    customer_name: Mapped[str] = mapped_column(String(120))
    customer_phone: Mapped[str] = mapped_column(String(40))
    customer_email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    customer_line_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    customer_remark: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)
    reminder_scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    status_events: Mapped[list['ReservationStatusEvent']] = relationship(
        back_populates='reservation', cascade='all, delete-orphan', order_by='ReservationStatusEvent.changed_at'
    )
    notification_deliveries: Mapped[list['ReservationNotificationDelivery']] = relationship(
        back_populates='reservation',
        cascade='all, delete-orphan',
        order_by='ReservationNotificationDelivery.created_at',
    )
    user: Mapped[User | None] = relationship(back_populates='reservations')
    preferred_slots: Mapped[list['ReservationPreferredSlot']] = relationship(
        back_populates='reservation',
        cascade='all, delete-orphan',
        order_by='ReservationPreferredSlot.desired_start',
    )


class ReservationStatusEvent(Base):
    __tablename__ = 'reservation_status_events'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('reservations.id', ondelete='CASCADE'), index=True
    )
    status: Mapped[str] = mapped_column(ReservationStatus, nullable=False, index=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)
    changed_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    note: Mapped[str | None] = mapped_column(Text)

    reservation: Mapped['Reservation'] = relationship(back_populates='status_events')


class ReservationPreferredSlot(Base):
    __tablename__ = 'reservation_preferred_slots'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('reservations.id', ondelete='CASCADE'), index=True
    )
    desired_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    desired_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(ReservationSlotStatus, nullable=False, default='open', index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    reservation: Mapped['Reservation'] = relationship(back_populates='preferred_slots')


class ReservationNotificationChannelOption(Base):
    __tablename__ = 'reservation_notification_channels'

    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)

    deliveries: Mapped[list["ReservationNotificationDelivery"]] = relationship(
        back_populates='channel_option'
    )


class ReservationNotificationStatusOption(Base):
    __tablename__ = 'reservation_notification_statuses'

    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)

    deliveries: Mapped[list["ReservationNotificationDelivery"]] = relationship(
        back_populates='status_option'
    )


class ReservationNotificationAttemptStatusOption(Base):
    __tablename__ = 'reservation_notification_attempt_statuses'

    key: Mapped[str] = mapped_column(String(16), primary_key=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)

    attempts: Mapped[list["ReservationNotificationAttempt"]] = relationship(
        back_populates='status_option'
    )


class ReservationNotificationDelivery(Base):
    __tablename__ = 'reservation_notification_deliveries'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('reservations.id', ondelete='CASCADE'),
        index=True,
    )
    channel: Mapped[str] = mapped_column(
        String(32),
        ForeignKey('reservation_notification_channels.key', ondelete='RESTRICT'),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        ForeignKey('reservation_notification_statuses.key', ondelete='RESTRICT'),
        default='pending',
        nullable=False,
        index=True,
    )
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)
    channel_option: Mapped['ReservationNotificationChannelOption'] = relationship(back_populates='deliveries')
    status_option: Mapped['ReservationNotificationStatusOption'] = relationship(back_populates='deliveries')

    reservation: Mapped['Reservation'] = relationship(back_populates='notification_deliveries')
    attempts: Mapped[list['ReservationNotificationAttempt']] = relationship(
        back_populates='delivery', cascade='all, delete-orphan', order_by='ReservationNotificationAttempt.attempted_at'
    )


class ReservationNotificationAttempt(Base):
    __tablename__ = 'reservation_notification_attempts'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    delivery_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('reservation_notification_deliveries.id', ondelete='CASCADE'),
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(16),
        ForeignKey('reservation_notification_attempt_statuses.key', ondelete='RESTRICT'),
        nullable=False,
        index=True,
    )
    response_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)
    status_option: Mapped['ReservationNotificationAttemptStatusOption'] = relationship(back_populates='attempts')

    delivery: Mapped['ReservationNotificationDelivery'] = relationship(back_populates='attempts')
