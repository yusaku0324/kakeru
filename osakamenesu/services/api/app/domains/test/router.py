"""Test router - placeholder for test-only endpoints."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/test", tags=["test"], include_in_schema=False)


# Test endpoints can be added here if needed
