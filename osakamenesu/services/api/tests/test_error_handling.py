"""
Error handling and edge case tests
"""

import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
class TestErrorHandling:
    """Test error handling and edge cases."""

    async def test_404_for_unknown_endpoint(self):
        """Test 404 response for unknown endpoints."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/unknown/endpoint")

        assert response.status_code == 404

    async def test_method_not_allowed(self):
        """Test 405 response for wrong HTTP methods."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Try POST on a GET-only endpoint
            response = await client.post("/healthz")

        assert response.status_code == 405

    async def test_malformed_json_request(self):
        """Test handling of malformed JSON requests."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            headers = {"Content-Type": "application/json"}
            response = await client.post(
                "/api/auth/request-link", content="{invalid json}", headers=headers
            )

        assert response.status_code in [400, 422]

    async def test_missing_required_headers(self):
        """Test handling of requests with missing required headers."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Remove default headers
            response = await client.get("/api/dashboard/shops", headers={})

        # Should return 401 or 403 for missing auth
        assert response.status_code in [401, 403]

    async def test_invalid_query_parameters(self):
        """Test handling of invalid query parameters."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Try with invalid query parameters
            response = await client.get("/api/v1/shops?page=invalid&limit=abc")

        # Should handle gracefully
        assert response.status_code in [200, 400, 422]

    async def test_large_request_body(self):
        """Test handling of large request bodies."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Create a large payload
            large_data = {"email": "x" * 10000}

            response = await client.post("/api/auth/request-link", json=large_data)

        # Should handle gracefully, either process or reject
        assert response.status_code in [400, 413, 422]

    async def test_concurrent_error_requests(self):
        """Test that errors don't cause server instability."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            import asyncio

            # Make multiple error-inducing requests concurrently
            tasks = []
            for _ in range(5):
                task = client.get("/api/nonexistent")
                tasks.append(task)

            responses = await asyncio.gather(*tasks, return_exceptions=True)

            # All should return 404, not cause server errors
            for response in responses:
                if not isinstance(response, Exception):
                    assert response.status_code == 404
