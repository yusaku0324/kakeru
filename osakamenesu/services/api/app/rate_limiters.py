"""Shared rate limiter instances.

This module provides pre-configured rate limiters for different endpoints.
Moved out of main.py to avoid circular imports.
"""

from __future__ import annotations

from redis.asyncio import from_url

from .settings import settings
from .utils.ratelimit import create_rate_limiter
from .middleware import create_rate_limit_dependency


redis_client = (
    from_url(settings.rate_limit_redis_url, encoding="utf-8", decode_responses=False)
    if settings.rate_limit_redis_url
    else None
)

# per token+ip: 5 requests / 10 seconds
outlink_rate = create_rate_limiter(
    max_events=5,
    window_sec=10.0,
    redis_client=redis_client,
    namespace=settings.rate_limit_namespace,
    redis_error_cooldown=settings.rate_limit_redis_error_cooldown,
)

# Public API rate limiters
# Search/browse: 60 requests / minute per IP
search_rate_limiter = create_rate_limiter(
    max_events=60,
    window_sec=60.0,
    redis_client=redis_client,
    namespace=f"{settings.rate_limit_namespace}:search",
    redis_error_cooldown=settings.rate_limit_redis_error_cooldown,
)

# Reservation creation: 10 requests / hour per IP
reservation_rate_limiter = create_rate_limiter(
    max_events=10,
    window_sec=3600.0,
    redis_client=redis_client,
    namespace=f"{settings.rate_limit_namespace}:reservation",
    redis_error_cooldown=settings.rate_limit_redis_error_cooldown,
)

# Auth (login/magic link): 5 requests / 10 minutes per IP
auth_rate_limiter = create_rate_limiter(
    max_events=5,
    window_sec=600.0,
    redis_client=redis_client,
    namespace=f"{settings.rate_limit_namespace}:auth",
    redis_error_cooldown=settings.rate_limit_redis_error_cooldown,
)

# Dependencies for rate limiting
rate_limit_search = create_rate_limit_dependency(search_rate_limiter)
rate_limit_reservation = create_rate_limit_dependency(reservation_rate_limiter)
rate_limit_auth = create_rate_limit_dependency(auth_rate_limiter)


async def shutdown_all_rate_limiters() -> None:
    """Shutdown all rate limiters."""
    from .utils.ratelimit import shutdown_rate_limiter

    await shutdown_rate_limiter(outlink_rate)
    await shutdown_rate_limiter(search_rate_limiter)
    await shutdown_rate_limiter(reservation_rate_limiter)
    await shutdown_rate_limiter(auth_rate_limiter)
