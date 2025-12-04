"""Rate limiting middleware for FastAPI endpoints."""

from __future__ import annotations

import logging
from typing import Callable, Optional

from fastapi import HTTPException, Request, Response, status
from fastapi.responses import JSONResponse

from ..utils.ratelimit import RateLimiter

logger = logging.getLogger(__name__)


class RateLimitMiddleware:
    """Middleware to apply rate limiting to API endpoints."""

    def __init__(
        self,
        rate_limiter: RateLimiter,
        key_func: Optional[Callable[[Request], str]] = None,
        exclude_paths: Optional[set[str]] = None,
    ):
        """Initialize rate limit middleware.

        Args:
            rate_limiter: The rate limiter instance
            key_func: Function to extract rate limit key from request
            exclude_paths: Set of paths to exclude from rate limiting
        """
        self.rate_limiter = rate_limiter
        self.key_func = key_func or self._default_key_func
        self.exclude_paths = exclude_paths or set()

    @staticmethod
    def _default_key_func(request: Request) -> str:
        """Default key function using client IP."""
        # Try to get real IP from proxy headers
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Take the first IP in the chain
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"

        return f"ip:{client_ip}"

    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Process the request with rate limiting."""
        # Skip rate limiting for excluded paths
        if request.url.path in self.exclude_paths:
            return await call_next(request)

        # Skip rate limiting for health checks and internal endpoints
        if request.url.path.startswith("/api/ops/"):
            return await call_next(request)

        # Extract rate limit key
        key = self.key_func(request)

        # Check rate limit
        allowed, retry_after = await self.rate_limiter.allow(key)

        if not allowed:
            # Rate limit exceeded
            logger.warning(f"Rate limit exceeded for key: {key}, retry after: {retry_after}s")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Rate limit exceeded",
                    "retry_after": retry_after,
                },
                headers={
                    "Retry-After": str(int(retry_after)),
                    "X-RateLimit-Limit": str(self.rate_limiter.max_events),
                    "X-RateLimit-Window": str(self.rate_limiter.window),
                },
            )

        # Process the request
        response = await call_next(request)

        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(self.rate_limiter.max_events)
        response.headers["X-RateLimit-Window"] = str(self.rate_limiter.window)

        return response


def create_rate_limit_dependency(
    rate_limiter: RateLimiter,
    key_func: Optional[Callable[[Request], str]] = None,
) -> Callable:
    """Create a FastAPI dependency for rate limiting specific endpoints.

    Usage:
        rate_limit = create_rate_limit_dependency(rate_limiter)

        @router.post("/api/endpoint")
        async def endpoint(request: Request, _: None = Depends(rate_limit)):
            ...
    """
    key_func = key_func or RateLimitMiddleware._default_key_func

    async def rate_limit_check(request: Request):
        key = key_func(request)
        allowed, retry_after = await rate_limiter.allow(key)

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": "Rate limit exceeded",
                    "retry_after": retry_after,
                },
                headers={
                    "Retry-After": str(int(retry_after)),
                    "X-RateLimit-Limit": str(rate_limiter.max_events),
                    "X-RateLimit-Window": str(rate_limiter.window),
                },
            )

    return rate_limit_check