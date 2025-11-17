from __future__ import annotations

from datetime import date
from http import HTTPStatus
from typing import Any, Awaitable, Callable, List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models
from ....schemas import (
    AvailabilityCalendar,
    AvailabilityCreate,
    AvailabilitySlotIn,
    AvailabilityUpsert,
    BulkAvailabilityInput,
    BulkShopIngestResult,
)
from ....utils.datetime import isoformat_jst, now_jst
from .errors import AdminServiceError
from . import site_bridge


class ProfileServiceError(AdminServiceError):
    """Local alias for availability helpers."""


ReindexCallback = Callable[[AsyncSession, models.Profile], Awaitable[None]]
RecordChangeCallback = Callable[..., Awaitable[None]]


async def create_single_availability(
    *,
    db: AsyncSession,
    profile_id: UUID,
    date_value: date,
    slots_json: Optional[dict[str, Any]] = None,
    reindex: Optional[ReindexCallback] = None,
) -> str:
    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise ProfileServiceError(HTTPStatus.NOT_FOUND, detail="profile not found")

    availability = models.Availability(
        profile_id=profile.id,
        date=date_value,
        slots_json=slots_json or {},
        is_today=date_value == now_jst().date(),
    )
    db.add(availability)
    await db.commit()
    if reindex:
        await reindex(db=db, profile=profile)
    return str(availability.id)


async def create_availability_bulk(
    *, db: AsyncSession, payload: List[AvailabilityCreate]
) -> List[str]:
    created: List[str] = []
    today = now_jst().date()
    for item in payload:
        profile = await db.get(models.Profile, item.profile_id)
        if not profile:
            raise ProfileServiceError(
                HTTPStatus.NOT_FOUND, detail=f"profile {item.profile_id} not found"
            )
        slots_json = slots_to_json(item.slots)
        availability = models.Availability(
            profile_id=profile.id,
            date=item.date,
            slots_json=slots_json,
            is_today=item.date == today,
        )
        db.add(availability)
        created.append(str(availability.id))
    await db.commit()
    return created


async def upsert_availability(
    *,
    audit_context: Any,
    db: AsyncSession,
    shop_id: UUID,
    payload: AvailabilityUpsert,
    record_change: RecordChangeCallback,
) -> str:
    profile = await db.get(models.Profile, shop_id)
    if not profile:
        raise ProfileServiceError(HTTPStatus.NOT_FOUND, detail="shop not found")

    slots_json = slots_to_json(payload.slots)
    stmt = (
        select(models.Availability)
        .where(models.Availability.profile_id == shop_id)
        .where(models.Availability.date == payload.date)
    )
    avail = (await db.execute(stmt)).scalar_one_or_none()
    before_slots = avail.slots_json if avail else None
    if avail:
        avail.slots_json = slots_json
        avail.is_today = payload.date == now_jst().date()
    else:
        avail = models.Availability(
            profile_id=shop_id,
            date=payload.date,
            slots_json=slots_json,
            is_today=payload.date == now_jst().date(),
        )
        db.add(avail)

    await db.commit()

    await record_change(
        db,
        context=audit_context,
        target_type="availability",
        target_id=avail.id,
        action="upsert",
        before=before_slots,
        after=slots_json,
    )

    return str(avail.id)


async def get_availability_calendar(
    *,
    db: AsyncSession,
    shop_id: UUID,
    start_date: date | None = None,
    end_date: date | None = None,
) -> AvailabilityCalendar | None:
    return await site_bridge.fetch_availability(
        db, shop_id, start_date=start_date, end_date=end_date
    )


def slots_to_json(slots: List[AvailabilitySlotIn] | None) -> dict | None:
    if not slots:
        return None
    return {
        "slots": [
            {
                "start_at": isoformat_jst(slot.start_at),
                "end_at": isoformat_jst(slot.end_at),
                "status": slot.status,
                "staff_id": str(slot.staff_id) if slot.staff_id else None,
                "menu_id": str(slot.menu_id) if slot.menu_id else None,
            }
            for slot in slots
        ]
    }


async def upsert_bulk_availability(
    *,
    db: AsyncSession,
    profile: models.Profile,
    availability: List[BulkAvailabilityInput],
    summary: BulkShopIngestResult,
) -> None:
    for entry in availability:
        slots_json = slots_to_json(entry.slots)
        stmt = select(models.Availability).where(
            models.Availability.profile_id == profile.id,
            models.Availability.date == entry.date,
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            existing.slots_json = slots_json
            existing.is_today = entry.date == now_jst().date()
        else:
            db.add(
                models.Availability(
                    profile_id=profile.id,
                    date=entry.date,
                    slots_json=slots_json,
                    is_today=entry.date == now_jst().date(),
                )
            )
        summary.availability_upserts += 1


__all__ = [
    "create_single_availability",
    "create_availability_bulk",
    "upsert_availability",
    "get_availability_calendar",
    "slots_to_json",
    "upsert_bulk_availability",
    "ProfileServiceError",
]
