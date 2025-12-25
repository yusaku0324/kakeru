"""Redis-based distributed cache implementation."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable, Optional, TypeVar, ParamSpec

import redis.asyncio as redis
from redis.exceptions import RedisError

from ..settings import settings

logger = logging.getLogger(__name__)

P = ParamSpec("P")
T = TypeVar("T")


class RedisCache:
    """Redis-based cache for distributed systems."""

    def __init__(
        self,
        redis_url: Optional[str] = None,
        ttl_seconds: int = 300,
        key_prefix: str = "osakamenesu",
    ):
        self.redis_url = (
            redis_url
            or settings.redis_url
            or settings.rate_limit_redis_url
            or "redis://localhost:6379"
        )
        self.ttl_seconds = ttl_seconds
        self.key_prefix = key_prefix
        self._client: Optional[redis.Redis] = None
        self._connected = False

    async def connect(self) -> None:
        """Connect to Redis."""
        if self._connected:
            return

        try:
            self._client = redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
            )
            await self._client.ping()
            self._connected = True
            logger.info("Connected to Redis cache")
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}")
            self._client = None
            self._connected = False

    async def disconnect(self) -> None:
        """Disconnect from Redis."""
        if self._client:
            await self._client.close()
            self._connected = False

    def _make_key(self, key: str) -> str:
        """Create a namespaced key."""
        return f"{self.key_prefix}:{key}"

    async def get(self, key: str) -> tuple[bool, Any]:
        """Get value from cache. Returns (hit, value)."""
        if not self._connected:
            return False, None

        try:
            full_key = self._make_key(key)
            value = await self._client.get(full_key)

            if value is None:
                return False, None

            # Try to deserialize JSON
            try:
                deserialized = json.loads(value)
                return True, deserialized
            except json.JSONDecodeError:
                # Return as string if not JSON
                return True, value

        except RedisError as e:
            logger.error(f"Redis get error: {e}")
            return False, None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache with TTL."""
        if not self._connected:
            return False

        try:
            full_key = self._make_key(key)
            ttl = ttl or self.ttl_seconds

            # Serialize to JSON if not a string
            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False)

            await self._client.setex(full_key, ttl, value)
            return True

        except RedisError as e:
            logger.error(f"Redis set error: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete a key from cache."""
        if not self._connected:
            return False

        try:
            full_key = self._make_key(key)
            result = await self._client.delete(full_key)
            return bool(result)

        except RedisError as e:
            logger.error(f"Redis delete error: {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern."""
        if not self._connected:
            return 0

        try:
            full_pattern = self._make_key(pattern)
            keys = []
            async for key in self._client.scan_iter(match=full_pattern):
                keys.append(key)

            if keys:
                return await self._client.delete(*keys)
            return 0

        except RedisError as e:
            logger.error(f"Redis delete_pattern error: {e}")
            return 0

    async def get_or_set(
        self, key: str, fetch_fn: Callable, ttl: Optional[int] = None
    ) -> Any:
        """Get from cache or fetch and cache the result."""
        hit, value = await self.get(key)
        if hit:
            logger.debug(f"Redis cache hit: {key}")
            return value

        logger.debug(f"Redis cache miss: {key}")

        # Fetch the value
        if asyncio.iscoroutinefunction(fetch_fn):
            value = await fetch_fn()
        else:
            value = fetch_fn()

        # Try to cache it
        await self.set(key, value, ttl)
        return value

    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """Increment a counter."""
        if not self._connected:
            return None

        try:
            full_key = self._make_key(key)
            return await self._client.incrby(full_key, amount)
        except RedisError as e:
            logger.error(f"Redis increment error: {e}")
            return None

    async def get_ttl(self, key: str) -> Optional[int]:
        """Get remaining TTL for a key."""
        if not self._connected:
            return None

        try:
            full_key = self._make_key(key)
            ttl = await self._client.ttl(full_key)
            return ttl if ttl > 0 else None
        except RedisError as e:
            logger.error(f"Redis get_ttl error: {e}")
            return None


# Global Redis cache instances
_redis_cache: Optional[RedisCache] = None


async def get_redis_cache() -> Optional[RedisCache]:
    """Get the global Redis cache instance."""
    global _redis_cache

    if _redis_cache is None:
        _redis_cache = RedisCache()
        await _redis_cache.connect()

    return _redis_cache if _redis_cache._connected else None


def redis_cache(
    ttl_seconds: int = 300,
    key_prefix: str = "",
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """Decorator for caching with Redis.

    Falls back to in-memory cache if Redis is unavailable.
    """
    from .cache import ttl_cache as memory_cache

    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        # Create fallback memory cache
        memory_cached = memory_cache(ttl_seconds=ttl_seconds, key_prefix=key_prefix)(
            func
        )

        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            # Try Redis first
            redis = await get_redis_cache()
            if not redis:
                # Fall back to memory cache
                return await memory_cached(*args, **kwargs)

            # Build cache key
            key_parts = [key_prefix, func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            key = ":".join(filter(None, key_parts))

            async def fetch() -> T:
                return await func(*args, **kwargs)

            return await redis.get_or_set(key, fetch, ttl_seconds)

        # Expose cache for manual operations
        async def invalidate_wrapper(*args, **kwargs) -> bool:
            redis = await get_redis_cache()
            if not redis:
                return await memory_cached.invalidate(*args, **kwargs)

            key_parts = [key_prefix, func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            key = ":".join(filter(None, key_parts))

            return await redis.delete(key)

        wrapper.invalidate = invalidate_wrapper  # type: ignore[attr-defined]

        return wrapper  # type: ignore[return-value]

    return decorator
