"""Shared pytest fixtures for API tests."""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def clear_caches():
    """Clear all caches before each test to ensure isolation."""
    from app.utils.cache import shop_cache, therapist_cache, availability_cache

    # Synchronously clear the internal cache dict directly
    shop_cache._cache.clear()
    therapist_cache._cache.clear()
    availability_cache._cache.clear()

    yield

    # Clear again after test
    shop_cache._cache.clear()
    therapist_cache._cache.clear()
    availability_cache._cache.clear()
