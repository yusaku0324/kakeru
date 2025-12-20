"""Tests for TTL cache utility."""

from __future__ import annotations

import asyncio
import pytest
from unittest.mock import AsyncMock

from app.utils.cache import TTLCache, ttl_cache


@pytest.mark.asyncio
async def test_cache_get_set():
    """Test basic get/set operations."""
    cache = TTLCache(ttl_seconds=60)

    await cache.set("key1", "value1")
    hit, value = await cache.get("key1")

    assert hit is True
    assert value == "value1"


@pytest.mark.asyncio
async def test_cache_miss():
    """Test cache miss returns (False, None)."""
    cache = TTLCache(ttl_seconds=60)

    hit, value = await cache.get("nonexistent")

    assert hit is False
    assert value is None


@pytest.mark.asyncio
async def test_cache_get_or_set():
    """Test get_or_set fetches on miss and returns cached on hit."""
    cache = TTLCache(ttl_seconds=60)
    fetch_count = 0

    async def fetch_fn():
        nonlocal fetch_count
        fetch_count += 1
        return {"data": "value"}

    # First call should fetch
    result1 = await cache.get_or_set("key", fetch_fn)
    assert result1 == {"data": "value"}
    assert fetch_count == 1

    # Second call should return cached
    result2 = await cache.get_or_set("key", fetch_fn)
    assert result2 == {"data": "value"}
    assert fetch_count == 1  # No additional fetch


@pytest.mark.asyncio
async def test_cache_invalidate():
    """Test cache invalidation."""
    cache = TTLCache(ttl_seconds=60)

    await cache.set("key1", "value1")
    removed = await cache.invalidate("key1")

    assert removed is True
    hit, _ = await cache.get("key1")
    assert hit is False


@pytest.mark.asyncio
async def test_cache_invalidate_prefix():
    """Test prefix-based invalidation."""
    cache = TTLCache(ttl_seconds=60)

    await cache.set("shop:1", "data1")
    await cache.set("shop:2", "data2")
    await cache.set("user:1", "user_data")

    count = await cache.invalidate_prefix("shop:")

    assert count == 2
    hit1, _ = await cache.get("shop:1")
    hit2, _ = await cache.get("shop:2")
    hit3, _ = await cache.get("user:1")

    assert hit1 is False
    assert hit2 is False
    assert hit3 is True


@pytest.mark.asyncio
async def test_cache_max_size():
    """Test cache evicts oldest when max size reached."""
    cache = TTLCache(ttl_seconds=60, max_size=3)

    await cache.set("key1", "value1")
    await cache.set("key2", "value2")
    await cache.set("key3", "value3")
    await cache.set("key4", "value4")

    # key1 should be evicted as oldest
    hit1, _ = await cache.get("key1")
    hit4, _ = await cache.get("key4")

    assert hit1 is False
    assert hit4 is True
    assert cache.size == 3


@pytest.mark.asyncio
async def test_ttl_cache_decorator():
    """Test ttl_cache decorator caches function results."""
    call_count = 0

    @ttl_cache(ttl_seconds=60)
    async def fetch_data(item_id: str) -> dict:
        nonlocal call_count
        call_count += 1
        return {"id": item_id}

    # First call
    result1 = await fetch_data("123")
    assert result1 == {"id": "123"}
    assert call_count == 1

    # Second call with same args - should use cache
    result2 = await fetch_data("123")
    assert result2 == {"id": "123"}
    assert call_count == 1

    # Call with different args - should fetch
    result3 = await fetch_data("456")
    assert result3 == {"id": "456"}
    assert call_count == 2


@pytest.mark.asyncio
async def test_cache_clear():
    """Test clearing all cache entries."""
    cache = TTLCache(ttl_seconds=60)

    await cache.set("key1", "value1")
    await cache.set("key2", "value2")
    await cache.clear()

    assert cache.size == 0
