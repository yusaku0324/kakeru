"""Simple in-memory TTL cache for frequently accessed data.

Usage:
    from app.utils.cache import ttl_cache

    @ttl_cache(ttl_seconds=300)  # 5 minutes
    async def get_shop_detail(shop_id: str) -> dict:
        ...

    # Or use the cache directly
    cache = TTLCache(ttl_seconds=60)
    await cache.get_or_set("key", async_fetch_fn)
"""

from __future__ import annotations

import asyncio
import functools
import logging
import time
from typing import Any, Callable, TypeVar, ParamSpec

logger = logging.getLogger(__name__)

P = ParamSpec("P")
T = TypeVar("T")


class TTLCache:
    """Thread-safe TTL cache for async operations."""

    def __init__(self, ttl_seconds: int = 300, max_size: int = 1000):
        self._cache: dict[str, tuple[float, Any]] = {}
        self._ttl = ttl_seconds
        self._max_size = max_size
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> tuple[bool, Any]:
        """Get value from cache. Returns (hit, value)."""
        async with self._lock:
            if key not in self._cache:
                return False, None

            expires_at, value = self._cache[key]
            if time.time() > expires_at:
                del self._cache[key]
                return False, None

            return True, value

    async def set(self, key: str, value: Any) -> None:
        """Set value in cache with TTL."""
        async with self._lock:
            # Evict oldest entries if at capacity
            if len(self._cache) >= self._max_size:
                self._evict_expired()
                if len(self._cache) >= self._max_size:
                    # Remove oldest entry
                    oldest_key = min(
                        self._cache.keys(), key=lambda k: self._cache[k][0]
                    )
                    del self._cache[oldest_key]

            self._cache[key] = (time.time() + self._ttl, value)

    async def get_or_set(self, key: str, fetch_fn: Callable[[], Any]) -> Any:
        """Get from cache or fetch and cache the result."""
        hit, value = await self.get(key)
        if hit:
            logger.debug("Cache hit: %s", key)
            return value

        logger.debug("Cache miss: %s", key)
        if asyncio.iscoroutinefunction(fetch_fn):
            value = await fetch_fn()
        else:
            value = fetch_fn()

        await self.set(key, value)
        return value

    async def invalidate(self, key: str) -> bool:
        """Remove a key from cache. Returns True if key existed."""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    async def invalidate_prefix(self, prefix: str) -> int:
        """Remove all keys with given prefix. Returns count of removed keys."""
        async with self._lock:
            keys_to_remove = [k for k in self._cache if k.startswith(prefix)]
            for key in keys_to_remove:
                del self._cache[key]
            return len(keys_to_remove)

    async def clear(self) -> None:
        """Clear all cache entries."""
        async with self._lock:
            self._cache.clear()

    def _evict_expired(self) -> None:
        """Remove expired entries (must hold lock)."""
        now = time.time()
        expired = [k for k, (exp, _) in self._cache.items() if now > exp]
        for key in expired:
            del self._cache[key]

    @property
    def size(self) -> int:
        """Current number of cached items."""
        return len(self._cache)


# Global caches for different data types
shop_cache = TTLCache(ttl_seconds=300, max_size=500)  # 5 min
therapist_cache = TTLCache(ttl_seconds=180, max_size=1000)  # 3 min
availability_cache = TTLCache(
    ttl_seconds=60, max_size=500
)  # 1 min (changes frequently)


def ttl_cache(
    ttl_seconds: int = 300,
    cache_instance: TTLCache | None = None,
    key_prefix: str = "",
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """Decorator for caching async function results.

    Args:
        ttl_seconds: Time-to-live in seconds
        cache_instance: Optional shared cache instance
        key_prefix: Optional prefix for cache keys

    Example:
        @ttl_cache(ttl_seconds=60)
        async def fetch_data(id: str) -> dict:
            ...
    """
    cache = cache_instance or TTLCache(ttl_seconds=ttl_seconds)

    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @functools.wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            # Build cache key from function name and arguments
            key_parts = [key_prefix, func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            key = ":".join(filter(None, key_parts))

            async def fetch() -> T:
                return await func(*args, **kwargs)

            return await cache.get_or_set(key, fetch)

        # Expose cache for manual invalidation
        wrapper.cache = cache  # type: ignore[attr-defined]
        wrapper.invalidate = lambda *args, **kwargs: cache.invalidate(  # type: ignore[attr-defined]
            ":".join(
                filter(
                    None,
                    [key_prefix, func.__name__]
                    + [str(a) for a in args]
                    + [f"{k}={v}" for k, v in sorted(kwargs.items())],
                )
            )
        )

        return wrapper  # type: ignore[return-value]

    return decorator
