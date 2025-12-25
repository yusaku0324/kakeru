"""HTTP cache headers middleware for API performance optimization."""

from __future__ import annotations

import hashlib
import json
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class CacheHeadersMiddleware(BaseHTTPMiddleware):
    """Add appropriate cache headers to API responses."""

    # Cache configurations for different endpoints
    CACHE_CONFIGS = {
        # Public endpoints with longer cache
        "/api/v1/shops": {"max_age": 300, "public": True},  # 5 minutes
        "/api/shops": {"max_age": 300, "public": True},  # 5 minutes
        "/healthz": {"max_age": 60, "public": True},  # 1 minute
        # Semi-dynamic content with shorter cache
        "/api/v1/therapists": {"max_age": 180, "public": True},  # 3 minutes
        "/api/therapists": {"max_age": 180, "public": True},  # 3 minutes
        # User-specific content (private cache)
        "/api/dashboard": {"max_age": 60, "private": True},  # 1 minute
        "/api/favorites": {"max_age": 60, "private": True},  # 1 minute
        # Never cache these
        "/api/auth": {"no_cache": True},
        "/api/admin": {"no_cache": True},
        "/api/reservations": {"no_cache": True},
    }

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Only add cache headers for successful GET requests
        if request.method != "GET" or response.status_code >= 300:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
            return response

        # Find matching cache config
        path = request.url.path
        cache_config = None

        for pattern, config in self.CACHE_CONFIGS.items():
            if path.startswith(pattern):
                cache_config = config
                break

        if not cache_config:
            # Default: short private cache for unspecified endpoints
            cache_config = {"max_age": 30, "private": True}

        # Apply cache headers
        if cache_config.get("no_cache"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        else:
            cache_parts = []

            if cache_config.get("public"):
                cache_parts.append("public")
            elif cache_config.get("private"):
                cache_parts.append("private")

            max_age = cache_config.get("max_age", 0)
            cache_parts.append(f"max-age={max_age}")

            # Add stale-while-revalidate for better UX
            if max_age > 0:
                cache_parts.append(f"stale-while-revalidate={min(max_age * 2, 3600)}")

            response.headers["Cache-Control"] = ", ".join(cache_parts)

        # Add ETag for conditional requests
        if hasattr(response, "_body") and response._body:
            # Generate ETag from response body
            etag = self._generate_etag(response._body)
            response.headers["ETag"] = etag

            # Check if client sent If-None-Match
            client_etag = request.headers.get("If-None-Match")
            if client_etag and client_etag == etag:
                # Return 304 Not Modified
                return Response(status_code=304, headers=response.headers)

        # Add Vary header for content negotiation
        vary_headers = ["Accept", "Accept-Encoding"]
        if cache_config.get("private"):
            vary_headers.append("Authorization")
        response.headers["Vary"] = ", ".join(vary_headers)

        return response

    def _generate_etag(self, content: bytes) -> str:
        """Generate ETag from response content."""
        return f'"{hashlib.md5(content).hexdigest()}"'
