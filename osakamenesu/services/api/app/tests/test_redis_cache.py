"""Tests for Redis cache functionality."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import json

from app.utils.redis_cache import RedisCache, redis_cache


@pytest.mark.asyncio
class TestRedisCache:
    """Test Redis cache implementation."""

    async def test_redis_cache_init(self):
        """Test Redis cache initialization."""
        cache = RedisCache(redis_url="redis://test:6379", ttl_seconds=60)

        assert cache.redis_url == "redis://test:6379"
        assert cache.ttl_seconds == 60
        assert cache.key_prefix == "osakamenesu"
        assert not cache._connected

    async def test_make_key(self):
        """Test key generation with prefix."""
        cache = RedisCache(key_prefix="test")

        key = cache._make_key("user:123")
        assert key == "test:user:123"

    @patch("app.utils.redis_cache.redis.from_url")
    async def test_connect_success(self, mock_from_url):
        """Test successful Redis connection."""
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock(return_value=True)
        mock_from_url.return_value = mock_client

        cache = RedisCache()
        await cache.connect()

        assert cache._connected
        assert cache._client is not None
        mock_client.ping.assert_called_once()

    @patch("app.utils.redis_cache.redis.from_url")
    async def test_connect_failure(self, mock_from_url):
        """Test Redis connection failure handling."""
        mock_from_url.side_effect = Exception("Connection failed")

        cache = RedisCache()
        await cache.connect()

        assert not cache._connected
        assert cache._client is None

    @patch("app.utils.redis_cache.redis.from_url")
    async def test_get_hit(self, mock_from_url):
        """Test cache get with hit."""
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock(return_value=True)
        mock_client.get = AsyncMock(return_value='{"data": "test"}')
        mock_from_url.return_value = mock_client

        cache = RedisCache()
        await cache.connect()

        hit, value = await cache.get("test_key")

        assert hit is True
        assert value == {"data": "test"}
        mock_client.get.assert_called_with("osakamenesu:test_key")

    @patch("app.utils.redis_cache.redis.from_url")
    async def test_get_miss(self, mock_from_url):
        """Test cache get with miss."""
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock(return_value=True)
        mock_client.get = AsyncMock(return_value=None)
        mock_from_url.return_value = mock_client

        cache = RedisCache()
        await cache.connect()

        hit, value = await cache.get("test_key")

        assert hit is False
        assert value is None

    @patch("app.utils.redis_cache.redis.from_url")
    async def test_set_success(self, mock_from_url):
        """Test cache set operation."""
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock(return_value=True)
        mock_client.setex = AsyncMock(return_value=True)
        mock_from_url.return_value = mock_client

        cache = RedisCache(ttl_seconds=300)
        await cache.connect()

        result = await cache.set("test_key", {"data": "value"})

        assert result is True
        mock_client.setex.assert_called_with(
            "osakamenesu:test_key", 300, '{"data": "value"}'
        )

    @patch("app.utils.redis_cache.redis.from_url")
    async def test_delete(self, mock_from_url):
        """Test cache delete operation."""
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock(return_value=True)
        mock_client.delete = AsyncMock(return_value=1)
        mock_from_url.return_value = mock_client

        cache = RedisCache()
        await cache.connect()

        result = await cache.delete("test_key")

        assert result is True
        mock_client.delete.assert_called_with("osakamenesu:test_key")

    @patch("app.utils.redis_cache.redis.from_url")
    async def test_get_or_set(self, mock_from_url):
        """Test get_or_set functionality."""
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock(return_value=True)
        mock_client.get = AsyncMock(return_value=None)  # Cache miss
        mock_client.setex = AsyncMock(return_value=True)
        mock_from_url.return_value = mock_client

        cache = RedisCache()
        await cache.connect()

        fetch_called = False

        async def fetch_fn():
            nonlocal fetch_called
            fetch_called = True
            return {"fresh": "data"}

        result = await cache.get_or_set("test_key", fetch_fn)

        assert result == {"fresh": "data"}
        assert fetch_called
        mock_client.setex.assert_called_once()

    @patch("app.utils.redis_cache.redis.from_url")
    async def test_redis_decorator_fallback(self, mock_from_url):
        """Test redis_cache decorator falls back to memory cache on Redis failure."""
        # Make Redis connection fail
        mock_from_url.side_effect = Exception("Connection failed")

        call_count = 0

        @redis_cache(ttl_seconds=60)
        async def test_func(param: str) -> dict:
            nonlocal call_count
            call_count += 1
            return {"param": param, "count": call_count}

        # First call - should execute function
        result1 = await test_func("test")
        assert result1 == {"param": "test", "count": 1}

        # Second call - should use memory cache (fallback)
        result2 = await test_func("test")
        assert result2 == {"param": "test", "count": 1}  # Same count = cached

        # Different parameter - should execute function again
        result3 = await test_func("other")
        assert result3 == {"param": "other", "count": 2}

    async def test_not_connected_operations(self):
        """Test operations when Redis is not connected."""
        cache = RedisCache()
        # Don't connect

        hit, value = await cache.get("key")
        assert hit is False
        assert value is None

        result = await cache.set("key", "value")
        assert result is False

        result = await cache.delete("key")
        assert result is False

        count = await cache.delete_pattern("*")
        assert count == 0
