"""Tests for reservation buffer time functionality.

These tests require a real database connection via db_session fixture.
Skipped until conftest.py with db_session is implemented.
"""

import pytest

# Skip entire module until db_session fixture is available
pytestmark = pytest.mark.skip(
    reason="db_session fixture not available - requires conftest.py setup"
)
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import status
from httpx import AsyncClient

from app.models import Profile, Therapist, TherapistShift, GuestReservation


@pytest.fixture
async def shop_with_buffer(db_session: AsyncSession) -> Profile:
    """Create a shop with buffer minutes configured."""
    shop = Profile(
        id=uuid4(),
        name="Test Shop with Buffer",
        area="tokyo",
        price_min=0,
        price_max=0,
        bust_tag="unspecified",
        buffer_minutes=15,  # 15 minutes buffer
        status="published",
    )
    db_session.add(shop)
    await db_session.commit()
    return shop


@pytest.fixture
async def shop_without_buffer(db_session: AsyncSession) -> Profile:
    """Create a shop without buffer minutes."""
    shop = Profile(
        id=uuid4(),
        name="Test Shop without Buffer",
        area="tokyo",
        price_min=0,
        price_max=0,
        bust_tag="unspecified",
        buffer_minutes=0,  # No buffer
        status="published",
    )
    db_session.add(shop)
    await db_session.commit()
    return shop


@pytest.fixture
async def therapist_with_buffer(
    db_session: AsyncSession, shop_with_buffer: Profile
) -> Therapist:
    """Create a therapist in a shop with buffer."""
    therapist = Therapist(
        id=uuid4(),
        profile_id=shop_with_buffer.id,
        name="Test Therapist with Buffer",
        status="published",
    )
    db_session.add(therapist)
    await db_session.commit()
    return therapist


@pytest.fixture
async def therapist_without_buffer(
    db_session: AsyncSession, shop_without_buffer: Profile
) -> Therapist:
    """Create a therapist in a shop without buffer."""
    therapist = Therapist(
        id=uuid4(),
        profile_id=shop_without_buffer.id,
        name="Test Therapist without Buffer",
        status="published",
    )
    db_session.add(therapist)
    await db_session.commit()
    return therapist


class TestBufferMinutesAvailability:
    """Test availability checks with buffer minutes."""

    async def test_buffer_prevents_adjacent_booking(
        self, db_session: AsyncSession, therapist_with_buffer: Therapist
    ):
        """Test that buffer time prevents adjacent bookings."""
        from app.domains.site.therapist_availability import is_available

        now = datetime.now(timezone.utc).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        shift_start = now
        shift_end = now + timedelta(hours=8)

        # Create shift
        shift = TherapistShift(
            id=uuid4(),
            therapist_id=therapist_with_buffer.id,
            shop_id=therapist_with_buffer.profile_id,
            date=now.date(),
            start_at=shift_start,
            end_at=shift_end,
            availability_status="available",
        )
        db_session.add(shift)

        # Create existing reservation from 11:00 to 12:00
        existing_reservation = GuestReservation(
            id=uuid4(),
            therapist_id=therapist_with_buffer.id,
            shop_id=therapist_with_buffer.profile_id,
            start_at=now + timedelta(hours=1),
            end_at=now + timedelta(hours=2),
            status="confirmed",
        )
        db_session.add(existing_reservation)
        await db_session.commit()

        # Try to book 10:45 to 11:00 (would overlap with 15min buffer)
        available, reasons = await is_available(
            db_session,
            therapist_with_buffer.id,
            now + timedelta(minutes=45),
            now + timedelta(hours=1),
        )
        assert not available
        assert "overlap_existing_reservation" in reasons["rejected_reasons"]

        # Try to book 12:00 to 12:15 (would overlap with 15min buffer)
        available, reasons = await is_available(
            db_session,
            therapist_with_buffer.id,
            now + timedelta(hours=2),
            now + timedelta(hours=2, minutes=15),
        )
        assert not available
        assert "overlap_existing_reservation" in reasons["rejected_reasons"]

    async def test_buffer_allows_spaced_booking(
        self, db_session: AsyncSession, therapist_with_buffer: Therapist
    ):
        """Test that bookings outside buffer time are allowed."""
        from app.domains.site.therapist_availability import is_available

        now = datetime.now(timezone.utc).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        shift_start = now
        shift_end = now + timedelta(hours=8)

        # Create shift
        shift = TherapistShift(
            id=uuid4(),
            therapist_id=therapist_with_buffer.id,
            shop_id=therapist_with_buffer.profile_id,
            date=now.date(),
            start_at=shift_start,
            end_at=shift_end,
            availability_status="available",
        )
        db_session.add(shift)

        # Create existing reservation from 11:00 to 12:00
        existing_reservation = GuestReservation(
            id=uuid4(),
            therapist_id=therapist_with_buffer.id,
            shop_id=therapist_with_buffer.profile_id,
            start_at=now + timedelta(hours=1),
            end_at=now + timedelta(hours=2),
            status="confirmed",
        )
        db_session.add(existing_reservation)
        await db_session.commit()

        # Try to book 10:00 to 10:30 (enough space with 15min buffer)
        available, reasons = await is_available(
            db_session,
            therapist_with_buffer.id,
            now,
            now + timedelta(minutes=30),
        )
        assert available

        # Try to book 12:30 to 13:00 (enough space with 15min buffer)
        available, reasons = await is_available(
            db_session,
            therapist_with_buffer.id,
            now + timedelta(hours=2, minutes=30),
            now + timedelta(hours=3),
        )
        assert available

    async def test_no_buffer_allows_adjacent_booking(
        self, db_session: AsyncSession, therapist_without_buffer: Therapist
    ):
        """Test that without buffer, adjacent bookings are allowed."""
        from app.domains.site.therapist_availability import is_available

        now = datetime.now(timezone.utc).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        shift_start = now
        shift_end = now + timedelta(hours=8)

        # Create shift
        shift = TherapistShift(
            id=uuid4(),
            therapist_id=therapist_without_buffer.id,
            shop_id=therapist_without_buffer.profile_id,
            date=now.date(),
            start_at=shift_start,
            end_at=shift_end,
            availability_status="available",
        )
        db_session.add(shift)

        # Create existing reservation from 11:00 to 12:00
        existing_reservation = GuestReservation(
            id=uuid4(),
            therapist_id=therapist_without_buffer.id,
            shop_id=therapist_without_buffer.profile_id,
            start_at=now + timedelta(hours=1),
            end_at=now + timedelta(hours=2),
            status="confirmed",
        )
        db_session.add(existing_reservation)
        await db_session.commit()

        # Can book 10:00 to 11:00 (adjacent before)
        available, reasons = await is_available(
            db_session,
            therapist_without_buffer.id,
            now,
            now + timedelta(hours=1),
        )
        assert available

        # Can book 12:00 to 13:00 (adjacent after)
        available, reasons = await is_available(
            db_session,
            therapist_without_buffer.id,
            now + timedelta(hours=2),
            now + timedelta(hours=3),
        )
        assert available


class TestBufferMinutesAPI:
    """Test buffer minutes configuration API."""

    async def test_update_buffer_minutes(
        self, client: AsyncClient, shop_with_buffer: Profile
    ):
        """Test updating buffer minutes for a shop."""
        response = await client.patch(
            f"/api/admin/shops/{shop_with_buffer.id}/buffer",
            json={"buffer_minutes": 30},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["buffer_minutes"] == 30
        assert "message" in data

    async def test_update_buffer_minutes_invalid_value(
        self, client: AsyncClient, shop_with_buffer: Profile
    ):
        """Test updating buffer minutes with invalid value."""
        # Negative value
        response = await client.patch(
            f"/api/admin/shops/{shop_with_buffer.id}/buffer",
            json={"buffer_minutes": -5},
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Too large value
        response = await client.patch(
            f"/api/admin/shops/{shop_with_buffer.id}/buffer",
            json={"buffer_minutes": 150},
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_update_buffer_minutes_shop_not_found(self, client: AsyncClient):
        """Test updating buffer minutes for non-existent shop."""
        non_existent_id = uuid4()
        response = await client.patch(
            f"/api/admin/shops/{non_existent_id}/buffer", json={"buffer_minutes": 15}
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_get_shop_includes_buffer_minutes(
        self, client: AsyncClient, shop_with_buffer: Profile
    ):
        """Test that shop details include buffer_minutes."""
        response = await client.get(f"/api/admin/shops/{shop_with_buffer.id}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["buffer_minutes"] == 15


class TestAvailabilitySlotsWithBuffer:
    """Test availability slots calculation with buffer."""

    async def test_slots_respect_buffer_time(
        self,
        client: AsyncClient,
        therapist_with_buffer: Therapist,
        db_session: AsyncSession,
    ):
        """Test that availability slots respect buffer time."""
        now = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        today = now.date()

        # Create shift from 10:00 to 18:00
        shift = TherapistShift(
            id=uuid4(),
            therapist_id=therapist_with_buffer.id,
            shop_id=therapist_with_buffer.profile_id,
            date=today,
            start_at=now.replace(hour=10),
            end_at=now.replace(hour=18),
            availability_status="available",
        )
        db_session.add(shift)

        # Create reservation from 12:00 to 13:00
        reservation = GuestReservation(
            id=uuid4(),
            therapist_id=therapist_with_buffer.id,
            shop_id=therapist_with_buffer.profile_id,
            start_at=now.replace(hour=12),
            end_at=now.replace(hour=13),
            status="confirmed",
        )
        db_session.add(reservation)
        await db_session.commit()

        # Get availability slots
        response = await client.get(
            f"/api/guest/therapists/{therapist_with_buffer.id}/availability_slots",
            params={"date": str(today)},
        )
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        slots = data["slots"]

        # With 15min buffer, slots should be:
        # - 10:00 to 11:45 (stop 15 min before 12:00 reservation)
        # - 13:15 to 18:00 (start 15 min after 13:00 reservation end)
        assert len(slots) == 2

        # Verify first slot ends before buffer
        first_slot = slots[0]
        first_end = datetime.fromisoformat(first_slot["end_at"].replace("Z", "+00:00"))
        assert first_end <= now.replace(hour=11, minute=45)

        # Verify second slot starts after buffer
        second_slot = slots[1]
        second_start = datetime.fromisoformat(
            second_slot["start_at"].replace("Z", "+00:00")
        )
        assert second_start >= now.replace(hour=13, minute=15)
