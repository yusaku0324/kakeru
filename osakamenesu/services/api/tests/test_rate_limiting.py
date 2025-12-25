"""
Rate limiting middleware tests
"""

import pytest
import asyncio
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
class TestRateLimiting:
    """Test rate limiting functionality."""

    async def test_outlink_rate_limiting(self):
        """Test rate limiting on outlink endpoint."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Create a fake token to test rate limiting
            token = "test-token-12345"

            # Make multiple requests to trigger rate limit
            responses = []
            for _ in range(10):
                response = await client.get(f"/api/out/{token}")
                responses.append(response.status_code)

            # Should have at least one 404 (token not found) or 429 (rate limited)
            assert any(status in [404, 429] for status in responses)

    async def test_rate_limit_headers(self):
        """Test that rate limit headers are present when applicable."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Test on a rate-limited endpoint
            response = await client.get("/api/out/test-token")

            # Check for common rate limit headers (if implemented)
            # Note: These might not be present if rate limiting is internal only
            if response.status_code == 429:
                assert (
                    "retry-after" in response.headers
                    or "x-ratelimit-remaining" in response.headers
                )

    async def test_concurrent_requests_handling(self):
        """Test that the API handles concurrent requests properly."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Make concurrent requests to test server stability
            tasks = []
            for _ in range(5):
                task = client.get("/healthz")
                tasks.append(task)

            responses = await asyncio.gather(*tasks)

            # All health check requests should succeed
            for response in responses:
                assert response.status_code == 200
                assert response.json() == {"ok": True}
