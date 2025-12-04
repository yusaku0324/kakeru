"""Tests for rate limiting functionality.

These tests require a real database connection via db_session fixture.
Skipped until conftest.py with db_session is implemented.
"""

import asyncio
import pytest

# Skip entire module until db_session fixture is available
pytestmark = pytest.mark.skip(
    reason="db_session fixture not available - requires conftest.py setup"
)
from datetime import datetime
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Therapist, Profile
from uuid import uuid4


@pytest.fixture
async def therapist_for_search(db_session: AsyncSession) -> Therapist:
    """Create a therapist for search tests."""
    profile = Profile(
        id=uuid4(),
        name="Test Shop",
        status="published",
    )
    db_session.add(profile)

    therapist = Therapist(
        id=uuid4(),
        name="Test Therapist",
        profile_id=profile.id,
        status="published",
        photo_urls=["https://example.com/photo.jpg"],
        specialties=["massage"],
        headline="Test therapist",
    )
    db_session.add(therapist)
    await db_session.commit()
    return therapist


class TestSearchRateLimit:
    """Test rate limiting on search endpoints."""

    async def test_guest_matching_search_rate_limit(self, client: AsyncClient):
        """Test rate limiting on guest matching search endpoint."""
        # Rate limit is 60 requests per minute

        # Make requests up to the limit
        for i in range(60):
            response = await client.post(
                "/api/guest/matching/search",
                json={
                    "area": "tokyo",
                    "date": datetime.now().date().isoformat(),
                },
            )
            assert response.status_code == status.HTTP_200_OK
            assert "X-RateLimit-Limit" in response.headers
            assert response.headers["X-RateLimit-Limit"] == "60"
            assert "X-RateLimit-Window" in response.headers
            assert response.headers["X-RateLimit-Window"] == "60"

        # Next request should be rate limited
        response = await client.post(
            "/api/guest/matching/search",
            json={
                "area": "tokyo",
                "date": datetime.now().date().isoformat(),
            },
        )
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert "Retry-After" in response.headers
        assert response.json()["detail"]["message"] == "Rate limit exceeded"

    async def test_similar_therapists_rate_limit(
        self, client: AsyncClient, therapist_for_search: Therapist
    ):
        """Test rate limiting on similar therapists endpoint."""
        # Make multiple requests rapidly (up to limit)
        for i in range(60):
            response = await client.get(
                "/api/guest/matching/similar",
                params={"staff_id": str(therapist_for_search.id)},
            )
            # Should succeed up to the limit
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                break
            assert response.status_code in [
                status.HTTP_200_OK,
                status.HTTP_404_NOT_FOUND,
            ]

        # Ensure we can trigger rate limit with rapid requests
        # Make several more requests to ensure we hit the limit
        for _ in range(5):
            response = await client.get(
                "/api/guest/matching/similar",
                params={"staff_id": str(therapist_for_search.id)},
            )

        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS


class TestReservationRateLimit:
    """Test rate limiting on reservation endpoints."""

    async def test_create_reservation_rate_limit(self, client: AsyncClient):
        """Test rate limiting on reservation creation."""
        # Rate limit is 10 requests per hour

        # Make requests up to the limit
        for i in range(10):
            response = await client.post(
                "/api/guest/reservations",
                json={
                    "shop_id": str(uuid4()),
                    "therapist_id": str(uuid4()),
                    "start_at": datetime.now().isoformat(),
                    "end_at": datetime.now().isoformat(),
                    "duration_minutes": 60,
                    "course_id": str(uuid4()),
                    "price": 10000,
                    "payment_method": "cash",
                    "contact_info": {
                        "name": f"Test User {i}",
                        "phone": f"090-1234-{i:04d}",
                        "email": f"test{i}@example.com",
                    },
                    "guest_token": f"test-token-{i}",
                },
            )
            assert response.status_code == status.HTTP_200_OK

        # Next request should be rate limited
        response = await client.post(
            "/api/guest/reservations",
            json={
                "shop_id": str(uuid4()),
                "therapist_id": str(uuid4()),
                "start_at": datetime.now().isoformat(),
                "end_at": datetime.now().isoformat(),
                "duration_minutes": 60,
                "course_id": str(uuid4()),
                "price": 10000,
                "payment_method": "cash",
                "contact_info": {
                    "name": "Test User",
                    "phone": "090-1234-5678",
                    "email": "test@example.com",
                },
                "guest_token": "test-token-overflow",
            },
        )
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert "Retry-After" in response.headers
        # Retry-After should be significant since it's hourly rate limit
        assert int(response.headers["Retry-After"]) > 0


class TestAuthRateLimit:
    """Test rate limiting on auth endpoints."""

    async def test_request_link_rate_limit(self, client: AsyncClient):
        """Test rate limiting on magic link requests."""
        # Rate limit is 5 requests per 10 minutes

        # Make requests up to the limit
        for i in range(5):
            response = await client.post(
                "/api/auth/request-link",
                json={"email": f"test{i}@example.com", "redirect_to": "/dashboard"},
            )
            # Request should be accepted (202) up to the limit
            assert response.status_code == status.HTTP_202_ACCEPTED

        # Next request should be rate limited
        response = await client.post(
            "/api/auth/request-link",
            json={"email": "overflow@example.com", "redirect_to": "/dashboard"},
        )
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert "Retry-After" in response.headers

    async def test_verify_token_rate_limit(self, client: AsyncClient):
        """Test rate limiting on token verification."""
        # Make multiple verification attempts
        for i in range(5):
            response = await client.post(
                "/api/auth/verify", json={"token": f"invalid-token-{i}"}
            )
            # Should get various errors but not rate limit yet
            assert response.status_code != status.HTTP_429_TOO_MANY_REQUESTS

        # After limit, should get rate limited
        response = await client.post(
            "/api/auth/verify", json={"token": "another-invalid-token"}
        )
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS


class TestRateLimitHeaders:
    """Test rate limit headers are properly set."""

    async def test_rate_limit_headers_on_success(self, client: AsyncClient):
        """Test that rate limit headers are included on successful requests."""
        response = await client.post(
            "/api/guest/matching/search",
            json={
                "area": "tokyo",
                "date": datetime.now().date().isoformat(),
            },
        )

        assert response.status_code == status.HTTP_200_OK
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Window" in response.headers

        # Check header values match our configuration
        assert response.headers["X-RateLimit-Limit"] == "60"  # search limit
        assert response.headers["X-RateLimit-Window"] == "60"  # 60 seconds

    async def test_rate_limit_response_format(self, client: AsyncClient):
        """Test the format of rate limit error responses."""
        # First exhaust the auth rate limit (5 requests per 10 minutes)
        for i in range(6):
            response = await client.post(
                "/api/auth/request-link",
                json={"email": f"test{i}@example.com", "redirect_to": "/dashboard"},
            )

        # Last response should be rate limited
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS

        # Check response body
        data = response.json()
        assert "detail" in data
        assert "message" in data["detail"]
        assert data["detail"]["message"] == "Rate limit exceeded"
        assert "retry_after" in data["detail"]

        # Check headers
        assert "Retry-After" in response.headers
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Window" in response.headers


@pytest.mark.parametrize(
    "endpoint,limit,window",
    [
        ("/api/guest/matching/search", 60, 60),  # 60 req/min
        ("/api/guest/reservations", 10, 3600),  # 10 req/hour
        ("/api/auth/request-link", 5, 600),  # 5 req/10min
    ],
)
async def test_rate_limit_configuration(
    client: AsyncClient, endpoint: str, limit: int, window: int
):
    """Test that rate limits are configured correctly for each endpoint."""
    # Make one request to check headers
    if endpoint == "/api/guest/matching/search":
        payload = {"area": "tokyo", "date": datetime.now().date().isoformat()}
    elif endpoint == "/api/guest/reservations":
        payload = {
            "shop_id": str(uuid4()),
            "therapist_id": str(uuid4()),
            "start_at": datetime.now().isoformat(),
            "end_at": datetime.now().isoformat(),
            "duration_minutes": 60,
            "course_id": str(uuid4()),
            "price": 10000,
            "payment_method": "cash",
            "contact_info": {
                "name": "Test User",
                "phone": "090-1234-5678",
                "email": "test@example.com",
            },
            "guest_token": "test-token",
        }
    else:  # auth endpoint
        payload = {"email": "test@example.com", "redirect_to": "/dashboard"}

    response = await client.post(endpoint, json=payload)

    # Check headers match expected configuration
    assert "X-RateLimit-Limit" in response.headers
    assert "X-RateLimit-Window" in response.headers
    assert response.headers["X-RateLimit-Limit"] == str(limit)
    assert response.headers["X-RateLimit-Window"] == str(window)
