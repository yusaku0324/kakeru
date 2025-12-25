"""Error tracking middleware with Sentry integration."""

from __future__ import annotations

import logging
import time
import traceback
from typing import Callable, Optional

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.status import (
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
    HTTP_422_UNPROCESSABLE_ENTITY,
    HTTP_500_INTERNAL_SERVER_ERROR,
)

from ..monitoring import capture_exception, set_context, set_tag, set_user_context
from ..monitoring.metrics import ERROR_COUNT

logger = logging.getLogger(__name__)


class ErrorTrackingMiddleware(BaseHTTPMiddleware):
    """Middleware to track errors and send them to Sentry."""

    # Error codes that should not be sent to Sentry
    IGNORED_STATUS_CODES = {
        HTTP_400_BAD_REQUEST,
        HTTP_401_UNAUTHORIZED,
        HTTP_403_FORBIDDEN,
        HTTP_404_NOT_FOUND,
        HTTP_409_CONFLICT,
        HTTP_422_UNPROCESSABLE_ENTITY,
    }

    def __init__(
        self,
        app,
        capture_request_body: bool = True,
        capture_response_body: bool = False,
        sanitize_headers: bool = True,
    ):
        """Initialize error tracking middleware.

        Args:
            app: FastAPI application
            capture_request_body: Whether to capture request body in error context
            capture_response_body: Whether to capture response body in error context
            sanitize_headers: Whether to sanitize sensitive headers
        """
        super().__init__(app)
        self.capture_request_body = capture_request_body
        self.capture_response_body = capture_response_body
        self.sanitize_headers = sanitize_headers

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process the request and track any errors."""
        # Start timing
        start_time = time.time()

        # Set request context
        self._set_request_context(request)

        # Extract user context if available
        if hasattr(request.state, "user") and request.state.user:
            set_user_context(
                user_id=request.state.user.id,
                email=getattr(request.state.user, "email", None),
            )

        try:
            response = await call_next(request)

            # Track client errors (4xx)
            if 400 <= response.status_code < 500:
                self._track_client_error(request, response)

            # Track server errors (5xx)
            elif response.status_code >= 500:
                await self._track_server_error(request, response)

            return response

        except Exception as exc:
            # Track unhandled exceptions
            duration = time.time() - start_time
            await self._track_exception(request, exc, duration)

            # Return error response
            return JSONResponse(
                status_code=HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": "An internal server error occurred",
                    "type": "internal_server_error",
                    "request_id": getattr(request.state, "request_id", None),
                },
            )

    def _set_request_context(self, request: Request) -> None:
        """Set request context for error tracking."""
        # Set tags
        set_tag("http.method", request.method)
        set_tag("http.url", str(request.url))
        set_tag("http.scheme", request.url.scheme)
        set_tag("http.host", request.url.hostname)
        set_tag("http.path", request.url.path)

        # Set request context
        context = {
            "method": request.method,
            "url": str(request.url),
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "client": self._get_client_info(request),
        }

        # Add headers (sanitized)
        if self.sanitize_headers:
            context["headers"] = self._sanitize_headers(dict(request.headers))
        else:
            context["headers"] = dict(request.headers)

        set_context("request", context)

    def _track_client_error(self, request: Request, response: Response) -> None:
        """Track client errors (4xx) for metrics."""
        ERROR_COUNT.labels(
            error_type=f"client_{response.status_code}",
            severity="warning",
        ).inc()

        # Log for debugging
        logger.debug(
            f"Client error: {response.status_code} {request.method} {request.url.path}"
        )

    async def _track_server_error(self, request: Request, response: Response) -> None:
        """Track server errors (5xx)."""
        ERROR_COUNT.labels(
            error_type=f"server_{response.status_code}",
            severity="error",
        ).inc()

        # Only send to Sentry if not in ignored list
        if response.status_code not in self.IGNORED_STATUS_CODES:
            # Try to get response body if enabled
            response_body = None
            if self.capture_response_body and hasattr(response, "body"):
                try:
                    response_body = response.body.decode() if response.body else None
                except Exception:
                    pass

            capture_message(
                f"Server error: {response.status_code}",
                level="error",
                response_status=response.status_code,
                response_body=response_body,
                request_path=request.url.path,
                request_method=request.method,
            )

    async def _track_exception(
        self,
        request: Request,
        exc: Exception,
        duration: float,
    ) -> None:
        """Track unhandled exceptions."""
        ERROR_COUNT.labels(
            error_type=type(exc).__name__,
            severity="error",
        ).inc()

        # Prepare extra context
        extra_context = {
            "request_method": request.method,
            "request_path": request.url.path,
            "request_duration": duration,
            "exception_type": type(exc).__name__,
            "exception_message": str(exc),
            "traceback": traceback.format_exc(),
        }

        # Add request body if enabled
        if self.capture_request_body:
            try:
                body = await request.body()
                if body:
                    extra_context["request_body"] = body.decode()
            except Exception:
                pass

        # Add request ID if available
        if hasattr(request.state, "request_id"):
            extra_context["request_id"] = request.state.request_id

        # Send to Sentry
        capture_exception(exc, **extra_context)

        # Log locally as well
        logger.error(
            f"Unhandled exception in {request.method} {request.url.path}: {exc}",
            exc_info=True,
            extra=extra_context,
        )

    def _get_client_info(self, request: Request) -> dict:
        """Extract client information from request."""
        client_info = {}

        # Get IP address
        if request.client:
            client_info["ip"] = request.client.host
            client_info["port"] = request.client.port

        # Check for proxy headers
        if forwarded_for := request.headers.get("x-forwarded-for"):
            client_info["forwarded_for"] = forwarded_for.split(",")[0].strip()

        if real_ip := request.headers.get("x-real-ip"):
            client_info["real_ip"] = real_ip

        # User agent
        if user_agent := request.headers.get("user-agent"):
            client_info["user_agent"] = user_agent

        return client_info

    def _sanitize_headers(self, headers: dict) -> dict:
        """Sanitize sensitive headers."""
        sensitive_headers = {
            "authorization",
            "cookie",
            "x-api-key",
            "x-auth-token",
            "x-csrf-token",
            "x-access-token",
        }

        sanitized = {}
        for key, value in headers.items():
            if key.lower() in sensitive_headers:
                sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = value

        return sanitized


def create_error_tracking_middleware(**kwargs) -> type[ErrorTrackingMiddleware]:
    """Create a configured ErrorTrackingMiddleware class."""

    class ConfiguredErrorTrackingMiddleware(ErrorTrackingMiddleware):
        def __init__(self, app):
            super().__init__(app, **kwargs)

    return ConfiguredErrorTrackingMiddleware