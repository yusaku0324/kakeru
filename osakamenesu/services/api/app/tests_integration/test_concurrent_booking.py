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
import pytest_asyncio
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

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app import models
from app.settings import settings
from app.domains.site.guest_reservations import (
    create_guest_reservation,
    create_guest_reservation_hold,
)
from app.utils.datetime import JST


def _create_session_factory():
    """Create a fresh session factory for each test."""
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        future=True,
        pool_pre_ping=True,
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


os.environ.setdefault("ANYIO_BACKEND", "asyncio")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not os.getenv("OSAKAMENESU_INTEGRATION_DB"),
        reason="requires OSAKAMENESU_INTEGRATION_DB=1",
    ),
]


async def _setup_test_data(session_factory):
    """Create test data and return IDs for cleanup."""
    profile_id = uuid.uuid4()
    therapist_id = uuid.uuid4()
    shift_id = uuid.uuid4()

    tomorrow = (datetime.now(JST) + timedelta(days=1)).date()
    shift_start = datetime.combine(
        tomorrow, datetime.min.time(), tzinfo=JST
    ) + timedelta(hours=10)
    shift_end = shift_start + timedelta(hours=8)

    try:
        async with session_factory() as session:
            profile = models.Profile(
                id=profile_id,
                name="Test Shop",
                room_count=1,
                buffer_minutes=0,
            )
            session.add(profile)

            therapist = models.Therapist(
                id=therapist_id,
                profile_id=profile_id,
                name="Test Therapist",
                status="published",
            )
            session.add(therapist)

            shift = models.TherapistShift(
                id=shift_id,
                therapist_id=therapist_id,
                shop_id=profile_id,
                date=tomorrow,
                start_at=shift_start,
                end_at=shift_end,
                availability_status="available",
                break_slots=[],
            )
            session.add(shift)
            await session.commit()
    except Exception as e:
        pytest.skip(f"Database not available: {e}")

    return {
        "profile_id": profile_id,
        "therapist_id": therapist_id,
        "shift_id": shift_id,
        "tomorrow": tomorrow,
    }


async def _cleanup_test_data(
    session_factory, data: dict, reservation_ids: list[uuid.UUID] = None
):
    """Clean up test data."""
    async with session_factory() as session:
        # Clean up reservations first
        if reservation_ids:
            for rid in reservation_ids:
                await session.execute(
                    delete(models.GuestReservation).where(
                        models.GuestReservation.id == rid
                    )
                )

        # Clean up in reverse order of creation
        await session.execute(
            delete(models.TherapistShift).where(
                models.TherapistShift.id == data["shift_id"]
            )
        )
        await session.execute(
            delete(models.Therapist).where(models.Therapist.id == data["therapist_id"])
        )
        await session.execute(
            delete(models.Profile).where(models.Profile.id == data["profile_id"])
        )
        await session.commit()


async def _create_reservation_task(session_factory, payload: dict, task_id: int):
    """Helper to create a reservation in a separate session."""
    async with session_factory() as session:
        result, debug = await create_guest_reservation(session, payload)
        return {
            "task_id": task_id,
            "success": result is not None,
            "reservation_id": str(result.id) if result else None,
            "rejected_reasons": debug.get("rejected_reasons", []),
        }


async def _create_hold_task(
    session_factory, payload: dict, idempotency_key: str, task_id: int
):
    """Helper to create a hold in a separate session."""
    async with session_factory() as session:
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
async def test_concurrent_same_slot_only_one_succeeds():
    """
    Test that when two concurrent requests try to book the same slot,
    exactly one succeeds and the other fails with overlap_existing_reservation.

    This is the critical race condition test for double booking prevention.
    """
    # Create a fresh session factory for this test
    session_factory = _create_session_factory()

    # Setup
    data = await _setup_test_data(session_factory)
    reservation_ids = []

    try:
        start_at = datetime.combine(
            data["tomorrow"], datetime.min.time(), tzinfo=JST
        ) + timedelta(hours=12)

        payload = {
            "shop_id": str(data["profile_id"]),
            "therapist_id": str(data["therapist_id"]),
            "start_at": start_at.isoformat(),
            "duration_minutes": 60,
            "contact_info": {"name": "Test User", "phone": "090-1234-5678"},
        }

        # Create two concurrent reservation attempts for the same slot
        tasks = [
            _create_reservation_task(session_factory, payload.copy(), i)
            for i in range(2)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out exceptions
        successful_results = [r for r in results if isinstance(r, dict)]

        # Count successes and failures
        successes = [r for r in successful_results if r["success"]]
        failures = [r for r in successful_results if not r["success"]]

        # Track reservation IDs for cleanup
        for s in successes:
            if s["reservation_id"]:
                reservation_ids.append(uuid.UUID(s["reservation_id"]))

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

    finally:
        await _cleanup_test_data(session_factory, data, reservation_ids)


@pytest.mark.asyncio
async def test_concurrent_different_slots_both_succeed():
    """
    Test that two concurrent requests for different slots both succeed.
    This verifies that locking is granular and doesn't block unrelated bookings.
    """
    # Create a fresh session factory for this test
    session_factory = _create_session_factory()

    # Setup
    data = await _setup_test_data(session_factory)
    reservation_ids = []

    try:
        # Two different time slots
        slot1_start = datetime.combine(
            data["tomorrow"], datetime.min.time(), tzinfo=JST
        ) + timedelta(hours=11)
        slot2_start = datetime.combine(
            data["tomorrow"], datetime.min.time(), tzinfo=JST
        ) + timedelta(hours=14)

        payload1 = {
            "shop_id": str(data["profile_id"]),
            "therapist_id": str(data["therapist_id"]),
            "start_at": slot1_start.isoformat(),
            "duration_minutes": 60,
            "contact_info": {"name": "User 1", "phone": "090-1111-1111"},
        }

        payload2 = {
            "shop_id": str(data["profile_id"]),
            "therapist_id": str(data["therapist_id"]),
            "start_at": slot2_start.isoformat(),
            "duration_minutes": 60,
            "contact_info": {"name": "User 2", "phone": "090-2222-2222"},
        }

        # Run concurrently
        results = await asyncio.gather(
            _create_reservation_task(session_factory, payload1, 1),
            _create_reservation_task(session_factory, payload2, 2),
            return_exceptions=True,
        )

        successful_results = [r for r in results if isinstance(r, dict)]
        successes = [r for r in successful_results if r["success"]]

        # Track reservation IDs for cleanup
        for s in successes:
            if s["reservation_id"]:
                reservation_ids.append(uuid.UUID(s["reservation_id"]))

        # Both should succeed
        assert len(successes) == 2, (
            f"Expected 2 successes, got {len(successes)}: {successful_results}"
        )

    finally:
        await _cleanup_test_data(session_factory, data, reservation_ids)


@pytest.mark.asyncio
async def test_concurrent_holds_only_one_succeeds():
    """
    Test that when two concurrent hold requests target the same slot,
    exactly one succeeds.
    """
    # Create a fresh session factory for this test
    session_factory = _create_session_factory()

    # Setup
    data = await _setup_test_data(session_factory)
    reservation_ids = []

    try:
        start_at = datetime.combine(
            data["tomorrow"], datetime.min.time(), tzinfo=JST
        ) + timedelta(hours=12)

        payload = {
            "shop_id": str(data["profile_id"]),
            "therapist_id": str(data["therapist_id"]),
            "start_at": start_at.isoformat(),
            "duration_minutes": 60,
            "contact_info": {"name": "Test User", "phone": "090-1234-5678"},
        }

        # Different idempotency keys for different users
        tasks = [
            _create_hold_task(
                session_factory,
                payload.copy(),
                idempotency_key=f"test-hold-{i}-{uuid.uuid4()}",
                task_id=i,
            )
            for i in range(2)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        successful_results = [r for r in results if isinstance(r, dict)]
        successes = [r for r in successful_results if r["success"]]
        failures = [r for r in successful_results if not r["success"]]

        # Track reservation IDs for cleanup
        for s in successes:
            if s["reservation_id"]:
                reservation_ids.append(uuid.UUID(s["reservation_id"]))

        # Exactly one should succeed
        assert len(successes) == 1, (
            f"Expected exactly 1 success, got {len(successes)}: {successes}"
        )
        assert len(failures) == 1, (
            f"Expected exactly 1 failure, got {len(failures)}: {failures}"
        )

    finally:
        await _cleanup_test_data(session_factory, data, reservation_ids)


@pytest.mark.asyncio
async def test_high_concurrency_stress():
    """
    Stress test: 10 concurrent requests for the same slot.
    Exactly one should succeed.
    """
    # Create a fresh session factory for this test
    session_factory = _create_session_factory()

    # Setup
    data = await _setup_test_data(session_factory)
    reservation_ids = []

    try:
        num_concurrent = 10

        start_at = datetime.combine(
            data["tomorrow"], datetime.min.time(), tzinfo=JST
        ) + timedelta(hours=12)

        payload = {
            "shop_id": str(data["profile_id"]),
            "therapist_id": str(data["therapist_id"]),
            "start_at": start_at.isoformat(),
            "duration_minutes": 60,
            "contact_info": {"name": "Test User", "phone": "090-1234-5678"},
        }

        tasks = [
            _create_reservation_task(session_factory, payload.copy(), i)
            for i in range(num_concurrent)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        successful_results = [r for r in results if isinstance(r, dict)]
        successes = [r for r in successful_results if r["success"]]
        failures = [r for r in successful_results if not r["success"]]

        # Track reservation IDs for cleanup
        for s in successes:
            if s["reservation_id"]:
                reservation_ids.append(uuid.UUID(s["reservation_id"]))

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

    finally:
        await _cleanup_test_data(session_factory, data, reservation_ids)
