"""Seed sample data for Ops API debugging.

This script creates a demo profile and a handful of reservations so that
`/api/ops/{queue,outbox,slots}` return meaningful numbers.

Usage:
    doppler run --project osakamenesu --config dev_web -- \
      python tools/seed_ops_samples.py
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import timedelta

from sqlalchemy import delete, select

from app import models
from app.db import SessionLocal
from app.notifications import ReservationNotification, enqueue_reservation_notification

PROFILE_SLUG = "ops-sample"
CHANNEL_TAG = "ops_seed"


async def ensure_profile(session) -> models.Profile:
    result = await session.execute(select(models.Profile).where(models.Profile.slug == PROFILE_SLUG))
    profile = result.scalar_one_or_none()
    if profile:
        return profile

    profile = models.Profile(
        slug=PROFILE_SLUG,
        name="Ops Sample Salon",
        area="梅田",
        price_min=10000,
        price_max=22000,
        bust_tag="C",
        service_type="store",
        status="published",
        nearest_station="梅田",
        contact_json={"phone": "000-0000-0000", "line": "ops-sample"},
    )
    session.add(profile)
    await session.flush()
    return profile


async def purge_existing_samples(session, profile_id: uuid.UUID) -> None:
    await session.execute(
        delete(models.Reservation).where(
            models.Reservation.shop_id == profile_id,
            models.Reservation.channel == CHANNEL_TAG,
        )
    )


async def create_reservation(
    session,
    profile: models.Profile,
    *,
    status: str,
    desired_start_offset_hours: float,
    duration_minutes: int,
    notes: str,
) -> models.Reservation:
    start = models.now_utc() + timedelta(hours=desired_start_offset_hours)
    end = start + timedelta(minutes=duration_minutes)

    reservation = models.Reservation(
        shop_id=profile.id,
        channel=CHANNEL_TAG,
        status=status,
        desired_start=start,
        desired_end=end,
        notes=notes,
        marketing_opt_in=True,
        customer_name="Ops Seed",
        customer_phone="090-0000-0000",
        customer_email="ops@example.com",
    )
    event = models.ReservationStatusEvent(
        reservation_id=reservation.id,
        status=status,
        changed_by="ops-seed",
    )
    reservation.status_events.append(event)
    session.add(reservation)
    await session.flush()
    return reservation


async def seed_notifications(session, profile: models.Profile, reservation: models.Reservation) -> None:
    notification = ReservationNotification(
        reservation_id=str(reservation.id),
        shop_id=str(profile.id),
        shop_name=profile.name,
        customer_name=reservation.customer_name,
        customer_phone=reservation.customer_phone,
        desired_start=reservation.desired_start.isoformat(),
        desired_end=reservation.desired_end.isoformat(),
        status=reservation.status,
        channel=reservation.channel,
        notes=reservation.notes,
        customer_email=reservation.customer_email,
        email_recipients=["ops-seed@example.com"],
    )
    await enqueue_reservation_notification(session, notification)


async def main() -> None:
    async with SessionLocal() as session:
        profile = await ensure_profile(session)
        await purge_existing_samples(session, profile.id)

        pending = await create_reservation(
            session,
            profile,
            status="pending",
            desired_start_offset_hours=1,
            duration_minutes=90,
            notes="[ops-seed] pending",
        )
        stale = await create_reservation(
            session,
            profile,
            status="pending",
            desired_start_offset_hours=-2,
            duration_minutes=60,
            notes="[ops-seed] stale",
        )
        confirmed = await create_reservation(
            session,
            profile,
            status="confirmed",
            desired_start_offset_hours=4,
            duration_minutes=120,
            notes="[ops-seed] confirmed",
        )

        await seed_notifications(session, profile, pending)
        await seed_notifications(session, profile, confirmed)
        await session.commit()

    print("Seeded Ops sample data (profile slug='ops-sample').")


if __name__ == "__main__":
    asyncio.run(main())
