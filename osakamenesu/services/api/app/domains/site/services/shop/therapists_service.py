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


def _compute_simple_recommended_score(
    therapist: Therapist,
    profile: Profile,
    has_availability: bool,
) -> float:
    """Compute a simple recommended score for shop page context.

    Uses display_order, tag overlap, price, age, and availability.
    Weights are tuned for shop_page entry source.

    Returns score in 0-1 range.
    """
    # Base score from display order (lower is better)
    display_order = getattr(therapist, "display_order", 99) or 99
    base_staff_similarity = max(0.0, 1.0 - (display_order / 100.0))

    # Tag similarity from profile body_tags and therapist specialties
    profile_tags = set(getattr(profile, "body_tags", None) or [])
    therapist_tags = set(getattr(therapist, "specialties", None) or [])
    if profile_tags and therapist_tags:
        tag_overlap = len(profile_tags & therapist_tags)
        tag_union = len(profile_tags | therapist_tags)
        tag_similarity = tag_overlap / tag_union if tag_union > 0 else 0.5
    else:
        tag_similarity = 0.5

    # Price match (normalize to 0-1)
    price_min = getattr(profile, "price_min", None) or 0
    price_max = getattr(profile, "price_max", None) or 0
    avg_price = (price_min + price_max) / 2 if price_max > 0 else 10000
    price_match = min(1.0, avg_price / 30000.0)

    # Age match (prime age range 20-35 gets boost)
    age = getattr(therapist, "age", None)
    if age and 20 <= age <= 35:
        age_match = 0.8 + (0.2 * (1.0 - abs(age - 27) / 15.0))
    elif age:
        age_match = 0.5
    else:
        age_match = 0.6

    # Availability boost
    availability_boost = 1.0 if has_availability else 0.0

    # Shop page weights (same as therapist detail API)
    weights = {
        "base_staff_similarity": 0.35,
        "tag_similarity": 0.25,
        "price_match": 0.15,
        "age_match": 0.10,
        "availability_boost": 0.15,
    }

    # Calculate weighted score
    score = (
        weights["base_staff_similarity"] * base_staff_similarity
        + weights["tag_similarity"] * tag_similarity
        + weights["price_match"] * price_match
        + weights["age_match"] * age_match
        + weights["availability_boost"] * availability_boost
    )

    # Ranking badge boost
    badges = getattr(profile, "ranking_badges", None) or []
    if "top_rated" in badges:
        score += 0.1
    if "new_arrival" in badges:
        score += 0.05

    # Normalize to 0-1 range
    return max(0.0, min(1.0, score))


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

            # Compute recommended score
            has_availability = bool(shifts)
            recommended_score = round(
                _compute_simple_recommended_score(therapist, profile, has_availability),
                3,
            )

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
                    recommended_score=recommended_score,
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
