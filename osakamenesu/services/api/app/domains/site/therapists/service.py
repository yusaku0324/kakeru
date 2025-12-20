"""Service layer for therapist detail operations."""

from datetime import timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ....models import Profile, Therapist
from ....utils.datetime import now_jst
from ..therapist_availability import list_daily_slots
from .schemas import AvailabilitySlotInfo


async def fetch_therapist_with_profile(
    db: AsyncSession,
    therapist_id: UUID,
) -> tuple[Therapist, Profile] | None:
    """Fetch therapist with joined profile."""
    stmt = (
        select(Therapist)
        .options(joinedload(Therapist.profile))
        .where(Therapist.id == therapist_id)
    )
    result = await db.execute(stmt)
    therapist = result.scalar_one_or_none()
    if not therapist or not therapist.profile:
        return None
    return therapist, therapist.profile


async def fetch_therapist_by_shop_slug(
    db: AsyncSession,
    therapist_id: UUID,
    shop_slug: str,
) -> tuple[Therapist, Profile] | None:
    """Fetch therapist with profile, verifying shop_slug matches."""
    stmt = (
        select(Therapist)
        .options(joinedload(Therapist.profile))
        .where(Therapist.id == therapist_id)
    )
    result = await db.execute(stmt)
    therapist = result.scalar_one_or_none()

    if not therapist or not therapist.profile:
        return None

    # Check if shop slug matches
    if therapist.profile.slug != shop_slug:
        return None

    return therapist, therapist.profile


async def build_availability_slots(
    db: AsyncSession,
    therapist_id: UUID,
    days: int,
    slot_granularity_minutes: int,
) -> list[AvailabilitySlotInfo]:
    """Build availability slots for the specified number of days."""
    slots: list[AvailabilitySlotInfo] = []
    today = now_jst().date()

    for day_offset in range(days):
        target_date = today + timedelta(days=day_offset)
        available_slots = await list_daily_slots(db, therapist_id, target_date)

        for slot_start, slot_end in available_slots:
            slots.append(
                AvailabilitySlotInfo(
                    starts_at=slot_start.isoformat(),
                    ends_at=slot_end.isoformat(),
                    is_available=True,
                    rejected_reasons=None,
                )
            )

    return slots
