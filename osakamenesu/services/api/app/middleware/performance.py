"""Performance monitoring middleware."""

from __future__ import annotations

import logging
import time
import uuid
from typing import Callable, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from ..monitoring import set_context, set_tag, start_transaction
from ..monitoring.metrics import API_REQUEST_DURATION, MetricsCollector

logger = logging.getLogger(__name__)


class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """Middleware to monitor API performance and track metrics."""

    def __init__(
        self,
        app,
        metrics_collector: Optional[MetricsCollector] = None,
        slow_request_threshold: float = 3.0,  # seconds
        track_db_queries: bool = True,
        track_cache_operations: bool = True,
    ):
        """Initialize performance monitoring middleware.

        Args:
            app: FastAPI application
            metrics_collector: Metrics collector instance
            slow_request_threshold: Threshold for slow request warnings (seconds)
            track_db_queries: Whether to track database query metrics
            track_cache_operations: Whether to track cache operation metrics
        """
        super().__init__(app)
        self.metrics_collector = metrics_collector or MetricsCollector()
        self.slow_request_threshold = slow_request_threshold
        self.track_db_queries = track_db_queries
        self.track_cache_operations = track_cache_operations

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process the request and monitor performance."""
        # Generate request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # Skip performance monitoring for health checks
        if request.url.path in ["/health", "/metrics", "/healthz"]:
            return await call_next(request)

        # Start performance transaction
        with start_transaction(
            op="http.server",
            name=f"{request.method} {request.url.path}",
        ) as transaction:
            # Set transaction tags
            transaction.set_tag("http.method", request.method)
            transaction.set_tag("http.path", request.url.path)
            transaction.set_tag("request.id", request_id)

            # Track request start
            start_time = time.time()
            request.state.start_time = start_time

            # Initialize performance context
            perf_context = {
                "db_queries": 0,
                "db_time": 0.0,
                "cache_hits": 0,
                "cache_misses": 0,
                "cache_time": 0.0,
            }
            request.state.performance = perf_context

            try:
                # Process request
                response = await call_next(request)

                # Calculate duration
                duration = time.time() - start_time

                # Set response tags
                transaction.set_tag("http.status_code", response.status_code)
                transaction.set_status(
                    "ok" if response.status_code < 400 else "error"
                )

                # Record metrics
                await self._record_metrics(request, response, duration)

                # Add performance headers
                response.headers["X-Request-ID"] = request_id
                response.headers["X-Response-Time"] = f"{duration * 1000:.2f}ms"

                # Add performance context to response
                if hasattr(request.state, "performance"):
                    response.headers["X-DB-Queries"] = str(perf_context["db_queries"])
                    response.headers["X-DB-Time"] = f"{perf_context['db_time'] * 1000:.2f}ms"
                    response.headers["X-Cache-Hits"] = str(perf_context["cache_hits"])
                    response.headers["X-Cache-Misses"] = str(perf_context["cache_misses"])

                # Warn about slow requests
                if duration > self.slow_request_threshold:
                    logger.warning(
                        f"Slow request detected: {request.method} {request.url.path} "
                        f"took {duration:.2f}s (threshold: {self.slow_request_threshold}s)",
                        extra={
                            "request_id": request_id,
                            "duration": duration,
                            "db_queries": perf_context["db_queries"],
                            "db_time": perf_context["db_time"],
                        },
                    )

                return response

            except Exception as exc:
                # Record error metrics
                duration = time.time() - start_time
                transaction.set_status("internal_error")

                await self.metrics_collector.record_api_request(
                    method=request.method,
                    endpoint=request.url.path,
                    status_code=500,
                    duration=duration,
                )

                raise

    async def _record_metrics(
        self,
        request: Request,
        response: Response,
        duration: float,
    ) -> None:
        """Record performance metrics."""
        # Record API request metrics
        await self.metrics_collector.record_api_request(
            method=request.method,
            endpoint=request.url.path,
            status_code=response.status_code,
            duration=duration,
        )

        # Set performance measurements
        set_context("performance", {
            "duration": duration,
            "db_queries": request.state.performance["db_queries"],
            "db_time": request.state.performance["db_time"],
            "cache_hits": request.state.performance["cache_hits"],
            "cache_misses": request.state.performance["cache_misses"],
            "cache_time": request.state.performance["cache_time"],
        })

        # Log performance summary
        if logger.isEnabledFor(logging.DEBUG):
            logger.debug(
                f"Request completed: {request.method} {request.url.path} - "
                f"Status: {response.status_code}, Duration: {duration * 1000:.2f}ms, "
                f"DB: {request.state.performance['db_queries']} queries "
                f"({request.state.performance['db_time'] * 1000:.2f}ms), "
                f"Cache: {request.state.performance['cache_hits']} hits, "
                f"{request.state.performance['cache_misses']} misses",
                extra={"request_id": request.state.request_id},
            )


def create_performance_monitoring_middleware(
    **kwargs,
) -> type[PerformanceMonitoringMiddleware]:
    """Create a configured PerformanceMonitoringMiddleware class."""

    class ConfiguredPerformanceMonitoringMiddleware(PerformanceMonitoringMiddleware):
        def __init__(self, app):
            super().__init__(app, **kwargs)

    return ConfiguredPerformanceMonitoringMiddleware