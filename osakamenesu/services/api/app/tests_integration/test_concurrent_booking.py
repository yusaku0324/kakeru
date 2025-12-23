"""
Concurrent booking tests to verify race condition prevention.

These tests verify that:
1. Only one reservation succeeds when two concurrent requests target the same slot
2. SELECT FOR UPDATE properly locks rows to prevent double booking
3. Room capacity limits are enforced under concurrent load

Requires: OSAKAMENESU_INTEGRATION_DB=1 and a running PostgreSQL instance.
"""

import asyncio
import os
import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

# Clear environment to ensure test isolation
for key in [
    "PROJECT_NAME",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "POSTGRES_HOST",
    "POSTGRES_PORT",
]:
    os.environ.pop(key, None)
    os.environ.pop(key.lower(), None)

from app import models
from app.db import SessionLocal
from app.domains.site.guest_reservations import (
    create_guest_reservation,
    create_guest_reservation_hold,
)
from app.utils.datetime import JST

os.environ.setdefault("ANYIO_BACKEND", "asyncio")

pytestmark = [pytest.mark.integration]

# Skip if integration DB not available
if not os.getenv("OSAKAMENESU_INTEGRATION_DB"):
    pytestmark.append(pytest.mark.skip(reason="requires OSAKAMENESU_INTEGRATION_DB=1"))


def _ensure_local_db_available() -> None:
    async def _ping() -> None:
        try:
            async with SessionLocal() as session:
                await session.execute(text("SELECT 1"))
        except Exception as e:
            pytest.skip(f"PostgreSQL not available: {e}")

    asyncio.get_event_loop().run_until_complete(_ping())


_ensure_local_db_available()


@pytest.fixture
async def db_session():
    """Provide a database session for tests."""
    async with SessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def test_profile(db_session: AsyncSession):
    """Create a test profile (shop)."""
    profile_id = uuid.uuid4()
    profile = models.Profile(
        id=profile_id,
        name="Test Shop",
        room_count=1,  # Single room for testing
        buffer_minutes=0,
    )
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(profile)
    yield profile
    # Cleanup
    await db_session.execute(
        delete(models.Profile).where(models.Profile.id == profile_id)
    )
    await db_session.commit()


@pytest.fixture
async def test_therapist(db_session: AsyncSession, test_profile):
    """Create a test therapist."""
    therapist_id = uuid.uuid4()
    therapist = models.Therapist(
        id=therapist_id,
        profile_id=test_profile.id,
        name="Test Therapist",
        status="published",
    )
    db_session.add(therapist)
    await db_session.commit()
    await db_session.refresh(therapist)
    yield therapist
    # Cleanup
    await db_session.execute(
        delete(models.Therapist).where(models.Therapist.id == therapist_id)
    )
    await db_session.commit()


@pytest.fixture
async def test_shift(db_session: AsyncSession, test_therapist):
    """Create a test shift for tomorrow."""
    tomorrow = (datetime.now(JST) + timedelta(days=1)).date()
    shift_start = datetime.combine(
        tomorrow, datetime.min.time(), tzinfo=JST
    ) + timedelta(hours=10)
    shift_end = shift_start + timedelta(hours=8)

    shift = models.TherapistShift(
        id=uuid.uuid4(),
        therapist_id=test_therapist.id,
        date=tomorrow,
        start_at=shift_start,
        end_at=shift_end,
        availability_status="available",
        break_slots=[],
    )
    db_session.add(shift)
    await db_session.commit()
    await db_session.refresh(shift)
    yield shift
    # Cleanup
    await db_session.execute(
        delete(models.TherapistShift).where(models.TherapistShift.id == shift.id)
    )
    await db_session.commit()


@pytest.fixture
def reservation_payload(test_profile, test_therapist, test_shift):
    """Create a base reservation payload."""
    tomorrow = (datetime.now(JST) + timedelta(days=1)).date()
    start_at = datetime.combine(tomorrow, datetime.min.time(), tzinfo=JST) + timedelta(
        hours=12
    )

    return {
        "shop_id": str(test_profile.id),
        "therapist_id": str(test_therapist.id),
        "start_at": start_at.isoformat(),
        "duration_minutes": 60,
        "contact_info": {"name": "Test User", "phone": "090-1234-5678"},
    }


async def _create_reservation_task(payload: dict, task_id: int):
    """Helper to create a reservation in a separate session."""
    async with SessionLocal() as session:
        result, debug = await create_guest_reservation(session, payload)
        return {
            "task_id": task_id,
            "success": result is not None,
            "reservation_id": str(result.id) if result else None,
            "rejected_reasons": debug.get("rejected_reasons", []),
        }


@pytest.mark.asyncio
async def test_concurrent_same_slot_only_one_succeeds(
    db_session: AsyncSession,
    reservation_payload: dict,
):
    """
    Test that when two concurrent requests try to book the same slot,
    exactly one succeeds and the other fails with overlap_existing_reservation.

    This is the critical race condition test for double booking prevention.
    """
    # Create two concurrent reservation attempts for the same slot
    tasks = [_create_reservation_task(reservation_payload.copy(), i) for i in range(2)]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Filter out exceptions
    successful_results = [r for r in results if isinstance(r, dict)]

    # Count successes and failures
    successes = [r for r in successful_results if r["success"]]
    failures = [r for r in successful_results if not r["success"]]

    # Exactly one should succeed
    assert len(successes) == 1, (
        f"Expected exactly 1 success, got {len(successes)}: {successes}"
    )

    # The other should fail with overlap_existing_reservation
    assert len(failures) == 1, (
        f"Expected exactly 1 failure, got {len(failures)}: {failures}"
    )
    assert "overlap_existing_reservation" in failures[0]["rejected_reasons"], (
        f"Expected overlap_existing_reservation, got {failures[0]['rejected_reasons']}"
    )

    # Cleanup: delete the created reservation
    if successes:
        await db_session.execute(
            delete(models.GuestReservation).where(
                models.GuestReservation.id == uuid.UUID(successes[0]["reservation_id"])
            )
        )
        await db_session.commit()


@pytest.mark.asyncio
async def test_concurrent_different_slots_both_succeed(
    db_session: AsyncSession,
    test_profile,
    test_therapist,
    test_shift,
):
    """
    Test that two concurrent requests for different slots both succeed.
    This verifies that locking is granular and doesn't block unrelated bookings.
    """
    tomorrow = (datetime.now(JST) + timedelta(days=1)).date()

    # Two different time slots
    slot1_start = datetime.combine(
        tomorrow, datetime.min.time(), tzinfo=JST
    ) + timedelta(hours=11)
    slot2_start = datetime.combine(
        tomorrow, datetime.min.time(), tzinfo=JST
    ) + timedelta(hours=14)

    payload1 = {
        "shop_id": str(test_profile.id),
        "therapist_id": str(test_therapist.id),
        "start_at": slot1_start.isoformat(),
        "duration_minutes": 60,
        "contact_info": {"name": "User 1", "phone": "090-1111-1111"},
    }

    payload2 = {
        "shop_id": str(test_profile.id),
        "therapist_id": str(test_therapist.id),
        "start_at": slot2_start.isoformat(),
        "duration_minutes": 60,
        "contact_info": {"name": "User 2", "phone": "090-2222-2222"},
    }

    # Run concurrently
    results = await asyncio.gather(
        _create_reservation_task(payload1, 1),
        _create_reservation_task(payload2, 2),
        return_exceptions=True,
    )

    successful_results = [r for r in results if isinstance(r, dict)]
    successes = [r for r in successful_results if r["success"]]

    # Both should succeed
    assert len(successes) == 2, (
        f"Expected 2 successes, got {len(successes)}: {successful_results}"
    )

    # Cleanup
    for s in successes:
        await db_session.execute(
            delete(models.GuestReservation).where(
                models.GuestReservation.id == uuid.UUID(s["reservation_id"])
            )
        )
    await db_session.commit()


async def _create_hold_task(payload: dict, idempotency_key: str, task_id: int):
    """Helper to create a hold in a separate session."""
    async with SessionLocal() as session:
        result, debug, error = await create_guest_reservation_hold(
            session, payload, idempotency_key=idempotency_key
        )
        return {
            "task_id": task_id,
            "success": result is not None and error is None,
            "reservation_id": str(result.id) if result else None,
            "rejected_reasons": debug.get("rejected_reasons", []),
            "error": error,
        }


@pytest.mark.asyncio
async def test_concurrent_holds_only_one_succeeds(
    db_session: AsyncSession,
    reservation_payload: dict,
):
    """
    Test that when two concurrent hold requests target the same slot,
    exactly one succeeds.
    """
    # Different idempotency keys for different users
    tasks = [
        _create_hold_task(
            reservation_payload.copy(),
            idempotency_key=f"test-hold-{i}-{uuid.uuid4()}",
            task_id=i,
        )
        for i in range(2)
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    successful_results = [r for r in results if isinstance(r, dict)]
    successes = [r for r in successful_results if r["success"]]
    failures = [r for r in successful_results if not r["success"]]

    # Exactly one should succeed
    assert len(successes) == 1, (
        f"Expected exactly 1 success, got {len(successes)}: {successes}"
    )
    assert len(failures) == 1, (
        f"Expected exactly 1 failure, got {len(failures)}: {failures}"
    )

    # Cleanup
    for s in successes:
        await db_session.execute(
            delete(models.GuestReservation).where(
                models.GuestReservation.id == uuid.UUID(s["reservation_id"])
            )
        )
    await db_session.commit()


@pytest.mark.asyncio
async def test_high_concurrency_stress(
    db_session: AsyncSession,
    reservation_payload: dict,
):
    """
    Stress test: 10 concurrent requests for the same slot.
    Exactly one should succeed.
    """
    num_concurrent = 10

    tasks = [
        _create_reservation_task(reservation_payload.copy(), i)
        for i in range(num_concurrent)
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    successful_results = [r for r in results if isinstance(r, dict)]
    successes = [r for r in successful_results if r["success"]]
    failures = [r for r in successful_results if not r["success"]]

    # Exactly one should succeed
    assert len(successes) == 1, (
        f"CRITICAL: Expected exactly 1 success under high concurrency, got {len(successes)}"
    )

    # All others should fail
    assert len(failures) == num_concurrent - 1, (
        f"Expected {num_concurrent - 1} failures, got {len(failures)}"
    )

    # All failures should be overlap_existing_reservation
    for f in failures:
        assert "overlap_existing_reservation" in f["rejected_reasons"], (
            f"Unexpected rejection reason: {f['rejected_reasons']}"
        )

    # Cleanup
    for s in successes:
        await db_session.execute(
            delete(models.GuestReservation).where(
                models.GuestReservation.id == uuid.UUID(s["reservation_id"])
            )
        )
    await db_session.commit()
