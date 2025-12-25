"""
Health endpoint tests
"""

import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_healthz_endpoint():
    """Test the /healthz endpoint returns success."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"ok": True}


@pytest.mark.asyncio
async def test_docs_endpoint():
    """Test that API documentation is accessible."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/docs")

    assert response.status_code == 200
    assert "Swagger UI" in response.text
