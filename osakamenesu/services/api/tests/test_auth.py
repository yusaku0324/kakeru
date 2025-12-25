"""
Authentication endpoint tests
"""

import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
class TestAuthEndpoints:
    """Test authentication endpoints."""

    async def test_auth_request_link_endpoint_exists(self):
        """Test that request-link endpoint exists."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post("/api/auth/request-link")

        # Should return 422 Unprocessable Entity due to missing data, not 404
        assert response.status_code in [422, 400]

    async def test_protected_endpoint_requires_auth(self):
        """Test that protected endpoints require authentication."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Try accessing a protected endpoint without auth
            response = await client.get("/api/dashboard/shops")

        # Should return 401 Unauthorized or 403 Forbidden
        assert response.status_code in [401, 403]

    async def test_invalid_token_rejected(self):
        """Test that invalid tokens are rejected."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            headers = {"Authorization": "Bearer invalid-token"}
            response = await client.get("/api/dashboard/shops", headers=headers)

        assert response.status_code in [401, 403]

    async def test_cors_headers_present(self):
        """Test that CORS headers are properly set."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            headers = {"Origin": "http://localhost:3000"}
            response = await client.options("/api/auth/session", headers=headers)

        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers
        assert (
            response.headers["access-control-allow-origin"] == "http://localhost:3000"
        )

    async def test_cors_invalid_origin_rejected(self):
        """Test that invalid origins are rejected."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            headers = {"Origin": "http://evil-site.com"}
            response = await client.options("/api/auth/login", headers=headers)

        # Should not have CORS headers for invalid origin
        assert (
            response.status_code == 400
            or "access-control-allow-origin" not in response.headers
        )
