"""Shop therapists service for listing therapists with availability and scoring."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .....models import Profile, Therapist, TherapistShift
from .....utils.datetime import now_jst
from .shared import ShopNotFoundError


class TherapistTagsResponse(BaseModel):
    """Therapist matching tags."""

    mood: str | None = None
    style: str | None = None
    look: str | None = None
    contact: str | None = None
    talk: str | None = None
    hobby_tags: list[str] | None = None


class AvailabilitySlotResponse(BaseModel):
    """Availability slot for a therapist."""

    starts_at: datetime
    ends_at: datetime
    is_available: bool


class TherapistListItem(BaseModel):
    """Therapist item for shop page list."""

    id: str
    name: str
    alias: str | None = None
    age: int | None = None
    headline: str | None = None
    avatar_url: str | None = None
    photos: list[str] = Field(default_factory=list)
    specialties: list[str] = Field(default_factory=list)
    tags: TherapistTagsResponse | None = None
    price_rank: int | None = None
    today_available: bool = False
    next_available_at: datetime | None = None
    availability_slots: list[AvailabilitySlotResponse] = Field(default_factory=list)
    recommended_score: float | None = None


class ShopTherapistsResponse(BaseModel):
    """Response for shop therapists list."""

    shop_id: str
    total: int
    items: list[TherapistListItem]


class ShopTherapistsService:
    """Service for listing therapists with availability for a shop."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_therapists(
        self,
        shop_id: UUID,
        *,
        include_availability: bool = True,
        availability_days: int = 7,
        page: int = 1,
        page_size: int = 20,
    ) -> ShopTherapistsResponse:
        """List published therapists for a shop with optional availability.

        Args:
            shop_id: The shop (profile) ID
            include_availability: Whether to include availability slots
            availability_days: Number of days to check for availability
            page: Page number (1-indexed)
            page_size: Number of items per page

        Returns:
            ShopTherapistsResponse with therapist list
        """
        # Verify shop exists and is published
        profile = await self.db.get(Profile, shop_id)
        if profile is None or getattr(profile, "status", "draft") != "published":
            raise ShopNotFoundError("shop not found")

        # Fetch published therapists
        offset = max(page - 1, 0) * page_size
        stmt = (
            select(Therapist)
            .where(
                Therapist.profile_id == shop_id,
                Therapist.status == "published",
            )
            .order_by(
                Therapist.display_order.asc().nulls_last(), Therapist.created_at.desc()
            )
            .offset(offset)
            .limit(page_size)
        )
        result = await self.db.execute(stmt)
        therapists = result.scalars().all()

        # Count total
        count_stmt = select(Therapist.id).where(
            Therapist.profile_id == shop_id,
            Therapist.status == "published",
        )
        count_result = await self.db.execute(count_stmt)
        total = len(count_result.scalars().all())

        # Fetch availability if requested
        availability_map: dict[UUID, list[TherapistShift]] = {}
        if include_availability and therapists:
            therapist_ids = [t.id for t in therapists]
            availability_map = await self._fetch_availability(
                therapist_ids, days=availability_days
            )

        # Build response
        now = now_jst()
        today = now.date()
        items: list[TherapistListItem] = []

        for therapist in therapists:
            shifts = availability_map.get(therapist.id, [])
            slots = self._build_availability_slots(shifts)
            today_available = any(
                slot.starts_at.date() == today and slot.is_available for slot in slots
            )
            next_available_at = self._find_next_available(slots, now)

            # Build tags
            tags = None
            if any(
                [
                    therapist.mood_tag,
                    therapist.style_tag,
                    therapist.look_type,
                    therapist.contact_style,
                    therapist.talk_level,
                    therapist.hobby_tags,
                ]
            ):
                tags = TherapistTagsResponse(
                    mood=therapist.mood_tag,
                    style=therapist.style_tag,
                    look=therapist.look_type,
                    contact=therapist.contact_style,
                    talk=therapist.talk_level,
                    hobby_tags=therapist.hobby_tags,
                )

            # Get avatar URL
            photo_urls = therapist.photo_urls or []
            avatar_url = photo_urls[0] if photo_urls else None

            items.append(
                TherapistListItem(
                    id=str(therapist.id),
                    name=therapist.name,
                    alias=therapist.alias,
                    age=therapist.age,
                    headline=therapist.headline,
                    avatar_url=avatar_url,
                    photos=photo_urls,
                    specialties=therapist.specialties or [],
                    tags=tags,
                    price_rank=therapist.price_rank,
                    today_available=today_available,
                    next_available_at=next_available_at,
                    availability_slots=slots if include_availability else [],
                    recommended_score=None,  # Scoring can be added based on guest context
                )
            )

        return ShopTherapistsResponse(
            shop_id=str(shop_id),
            total=total,
            items=items,
        )

    async def _fetch_availability(
        self,
        therapist_ids: list[UUID],
        *,
        days: int = 7,
    ) -> dict[UUID, list[TherapistShift]]:
        """Fetch availability shifts for therapists.

        Args:
            therapist_ids: List of therapist IDs
            days: Number of days to fetch

        Returns:
            Map of therapist ID to shifts
        """
        now = now_jst()
        start_date = now.date()
        end_date = start_date + timedelta(days=days)

        stmt = select(TherapistShift).where(
            TherapistShift.therapist_id.in_(therapist_ids),
            TherapistShift.date >= start_date,
            TherapistShift.date <= end_date,
            TherapistShift.availability_status == "available",
        )
        result = await self.db.execute(stmt)
        shifts = result.scalars().all()

        # Group by therapist
        availability_map: dict[UUID, list[TherapistShift]] = {}
        for shift in shifts:
            if shift.therapist_id not in availability_map:
                availability_map[shift.therapist_id] = []
            availability_map[shift.therapist_id].append(shift)

        return availability_map

    def _build_availability_slots(
        self,
        shifts: list[TherapistShift],
    ) -> list[AvailabilitySlotResponse]:
        """Convert shifts to availability slots."""
        slots: list[AvailabilitySlotResponse] = []
        for shift in shifts:
            if not shift.start_at or not shift.end_at:
                continue
            slots.append(
                AvailabilitySlotResponse(
                    starts_at=shift.start_at,
                    ends_at=shift.end_at,
                    is_available=shift.availability_status == "available",
                )
            )
        # Sort by start time
        slots.sort(key=lambda s: s.starts_at)
        return slots

    def _find_next_available(
        self,
        slots: list[AvailabilitySlotResponse],
        now: datetime,
    ) -> datetime | None:
        """Find the next available slot after now."""
        for slot in slots:
            if slot.is_available and slot.starts_at > now:
                return slot.starts_at
        return None
