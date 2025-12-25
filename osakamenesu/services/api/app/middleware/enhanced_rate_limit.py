"""Enhanced rate limiting middleware with multiple tiers and DDoS protection."""

from __future__ import annotations

import logging
from typing import Callable, Optional
from datetime import datetime, timedelta, timezone

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.status import HTTP_429_TOO_MANY_REQUESTS, HTTP_503_SERVICE_UNAVAILABLE

from ..utils.ratelimit import RateLimiter, create_rate_limiter
from ..settings import settings

logger = logging.getLogger(__name__)


class EnhancedRateLimitMiddleware:
    """Enhanced rate limiting with multiple tiers and DDoS protection."""

    def __init__(
        self,
        redis_client,
        exclude_paths: Optional[set[str]] = None,
    ):
        """Initialize enhanced rate limit middleware.

        Args:
            redis_client: Redis client for distributed rate limiting
            exclude_paths: Set of paths to exclude from rate limiting
        """
        self.exclude_paths = exclude_paths or {
            "/health",
            "/metrics",
            "/api/ops/health",
            "/api/ops/health/backup",
        }

        # Tier 1: Global rate limit (DDoS protection)
        # 1000 requests per minute per IP (aggressive clients)
        self.global_limiter = create_rate_limiter(
            max_events=1000,
            window_sec=60.0,
            redis_client=redis_client,
            namespace=f"{settings.rate_limit_namespace}:global",
        )

        # Tier 2: Burst protection
        # 100 requests per 10 seconds per IP (burst prevention)
        self.burst_limiter = create_rate_limiter(
            max_events=100,
            window_sec=10.0,
            redis_client=redis_client,
            namespace=f"{settings.rate_limit_namespace}:burst",
        )

        # Tier 3: Sustained traffic limit
        # 300 requests per minute per IP (normal usage)
        self.sustained_limiter = create_rate_limiter(
            max_events=300,
            window_sec=60.0,
            redis_client=redis_client,
            namespace=f"{settings.rate_limit_namespace}:sustained",
        )

        # Track suspicious IPs
        self.suspicious_ips: dict[str, datetime] = {}

    def _extract_client_ip(self, request: Request) -> str:
        """Extract client IP from request headers."""
        # Check standard proxy headers
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        # Fallback to direct connection
        if request.client:
            return request.client.host

        return "unknown"

    def _is_health_check(self, path: str) -> bool:
        """Check if the path is a health check endpoint."""
        health_patterns = [
            "/health",
            "/api/ops/health",
            "/metrics",
            "/.well-known",
        ]
        return any(path.startswith(pattern) for pattern in health_patterns)

    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Process the request with enhanced rate limiting."""
        path = request.url.path

        # Skip rate limiting for excluded paths and health checks
        if path in self.exclude_paths or self._is_health_check(path):
            return await call_next(request)

        # Extract client IP
        client_ip = self._extract_client_ip(request)
        key_prefix = f"ip:{client_ip}"

        # Check if IP is in suspicious list
        if client_ip in self.suspicious_ips:
            # Check if cooldown period has passed (1 hour)
            if datetime.now(timezone.utc) - self.suspicious_ips[client_ip] < timedelta(
                hours=1
            ):
                logger.warning(f"Blocked suspicious IP: {client_ip}")
                return JSONResponse(
                    status_code=HTTP_503_SERVICE_UNAVAILABLE,
                    content={
                        "detail": "Temporarily blocked due to suspicious activity",
                        "retry_after": 3600,
                    },
                    headers={"Retry-After": "3600"},
                )
            else:
                # Remove from suspicious list after cooldown
                del self.suspicious_ips[client_ip]

        # Check all rate limit tiers
        limiters = [
            ("global", self.global_limiter),
            ("burst", self.burst_limiter),
            ("sustained", self.sustained_limiter),
        ]

        for tier_name, limiter in limiters:
            allowed, retry_after = await limiter.allow(f"{key_prefix}:{tier_name}")

            if not allowed:
                # Log rate limit violation
                logger.warning(
                    f"Rate limit exceeded - Tier: {tier_name}, IP: {client_ip}, "
                    f"Path: {path}, Retry after: {retry_after}s"
                )

                # Mark IP as suspicious if hitting global limit
                if tier_name == "global":
                    self.suspicious_ips[client_ip] = datetime.now(timezone.utc)

                # Return rate limit response
                return JSONResponse(
                    status_code=HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": f"Rate limit exceeded ({tier_name})",
                        "retry_after": retry_after,
                        "tier": tier_name,
                    },
                    headers={
                        "Retry-After": str(int(retry_after)),
                        "X-RateLimit-Limit": str(limiter.max_events),
                        "X-RateLimit-Window": str(limiter.window),
                        "X-RateLimit-Tier": tier_name,
                    },
                )

        # Process the request
        response = await call_next(request)

        # Add rate limit headers to successful responses
        if response.status_code < 400:
            response.headers["X-RateLimit-Limit-Sustained"] = str(
                self.sustained_limiter.max_events
            )
            response.headers["X-RateLimit-Window-Sustained"] = str(
                self.sustained_limiter.window
            )

        return response


def create_enhanced_rate_limiter(redis_client) -> EnhancedRateLimitMiddleware:
    """Create an instance of enhanced rate limiting middleware."""
    return EnhancedRateLimitMiddleware(redis_client=redis_client)
