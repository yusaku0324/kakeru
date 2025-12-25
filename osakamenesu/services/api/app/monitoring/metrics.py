"""Custom metrics collection for monitoring and observability."""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional, TypeVar

import redis.asyncio as redis
from prometheus_client import Counter, Histogram, Gauge, Info
from sentry_sdk import set_measurement

from ..settings import settings

logger = logging.getLogger(__name__)

T = TypeVar("T")


# Prometheus metrics
API_REQUEST_COUNT = Counter(
    "osakamenesu_api_requests_total",
    "Total number of API requests",
    ["method", "endpoint", "status"],
)

API_REQUEST_DURATION = Histogram(
    "osakamenesu_api_request_duration_seconds",
    "API request duration in seconds",
    ["method", "endpoint"],
)

DATABASE_QUERY_COUNT = Counter(
    "osakamenesu_database_queries_total",
    "Total number of database queries",
    ["operation", "table"],
)

DATABASE_QUERY_DURATION = Histogram(
    "osakamenesu_database_query_duration_seconds",
    "Database query duration in seconds",
    ["operation", "table"],
)

CACHE_OPERATION_COUNT = Counter(
    "osakamenesu_cache_operations_total",
    "Total number of cache operations",
    ["operation", "result"],
)

CACHE_HIT_RATE = Gauge(
    "osakamenesu_cache_hit_rate",
    "Cache hit rate percentage",
)

BACKGROUND_JOB_COUNT = Counter(
    "osakamenesu_background_jobs_total",
    "Total number of background jobs",
    ["job_type", "status"],
)

BACKGROUND_JOB_DURATION = Histogram(
    "osakamenesu_background_job_duration_seconds",
    "Background job duration in seconds",
    ["job_type"],
)

ACTIVE_USERS = Gauge(
    "osakamenesu_active_users",
    "Number of active users",
    ["user_type"],
)

RESERVATION_COUNT = Counter(
    "osakamenesu_reservations_total",
    "Total number of reservations",
    ["status", "source"],
)

ERROR_COUNT = Counter(
    "osakamenesu_errors_total",
    "Total number of errors",
    ["error_type", "severity"],
)

SYSTEM_INFO = Info(
    "osakamenesu_system",
    "System information",
)


@dataclass
class MetricsSummary:
    """Summary of collected metrics."""

    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    api_requests: Dict[str, int] = field(default_factory=dict)
    database_queries: Dict[str, int] = field(default_factory=dict)
    cache_operations: Dict[str, int] = field(default_factory=dict)
    background_jobs: Dict[str, int] = field(default_factory=dict)
    errors: Dict[str, int] = field(default_factory=dict)
    performance: Dict[str, float] = field(default_factory=dict)


class MetricsCollector:
    """Central metrics collector with Redis backend."""

    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.namespace = "osakamenesu:metrics"
        self._cache_hits = 0
        self._cache_misses = 0

    async def initialize(self) -> None:
        """Initialize metrics collector."""
        if not self.redis and settings.redis_url:
            self.redis = await redis.from_url(settings.redis_url)

        # Set system info
        SYSTEM_INFO.info({
            "environment": settings.sentry_environment or "production",
            "version": _get_app_version(),
        })

    async def close(self) -> None:
        """Close connections."""
        if self.redis:
            await self.redis.close()

    @contextmanager
    def track_duration(self, metric_name: str, labels: Optional[Dict[str, str]] = None):
        """Context manager to track operation duration."""
        start_time = time.time()
        try:
            yield
        finally:
            duration = time.time() - start_time
            self._record_duration(metric_name, duration, labels)

    async def record_api_request(
        self,
        method: str,
        endpoint: str,
        status_code: int,
        duration: float,
    ) -> None:
        """Record API request metrics."""
        # Prometheus metrics
        API_REQUEST_COUNT.labels(
            method=method,
            endpoint=endpoint,
            status=str(status_code),
        ).inc()

        API_REQUEST_DURATION.labels(
            method=method,
            endpoint=endpoint,
        ).observe(duration)

        # Sentry performance
        set_measurement("http.response_time", duration * 1000, "millisecond")

        # Redis metrics
        if self.redis:
            key = f"{self.namespace}:api:{method}:{endpoint}:{status_code}"
            pipe = self.redis.pipeline()
            pipe.hincrby(key, "count", 1)
            pipe.hincrbyfloat(key, "total_duration", duration)
            pipe.expire(key, 86400)  # 1 day TTL
            await pipe.execute()

    async def record_database_query(
        self,
        operation: str,
        table: str,
        duration: float,
        row_count: Optional[int] = None,
    ) -> None:
        """Record database query metrics."""
        # Prometheus metrics
        DATABASE_QUERY_COUNT.labels(
            operation=operation,
            table=table,
        ).inc()

        DATABASE_QUERY_DURATION.labels(
            operation=operation,
            table=table,
        ).observe(duration)

        # Sentry performance
        set_measurement("db.query_time", duration * 1000, "millisecond")
        if row_count is not None:
            set_measurement("db.row_count", row_count, "none")

        # Redis metrics
        if self.redis:
            key = f"{self.namespace}:db:{operation}:{table}"
            pipe = self.redis.pipeline()
            pipe.hincrby(key, "count", 1)
            pipe.hincrbyfloat(key, "total_duration", duration)
            if row_count is not None:
                pipe.hincrby(key, "total_rows", row_count)
            pipe.expire(key, 86400)
            await pipe.execute()

    async def record_cache_operation(
        self,
        operation: str,
        hit: bool,
        key: Optional[str] = None,
    ) -> None:
        """Record cache operation metrics."""
        result = "hit" if hit else "miss"

        # Prometheus metrics
        CACHE_OPERATION_COUNT.labels(
            operation=operation,
            result=result,
        ).inc()

        # Update hit rate
        if hit:
            self._cache_hits += 1
        else:
            self._cache_misses += 1

        total = self._cache_hits + self._cache_misses
        if total > 0:
            hit_rate = (self._cache_hits / total) * 100
            CACHE_HIT_RATE.set(hit_rate)

        # Redis metrics
        if self.redis:
            metrics_key = f"{self.namespace}:cache:{operation}"
            await self.redis.hincrby(metrics_key, result, 1)
            await self.redis.expire(metrics_key, 86400)

    async def record_background_job(
        self,
        job_type: str,
        status: str,
        duration: float,
        error: Optional[str] = None,
    ) -> None:
        """Record background job metrics."""
        # Prometheus metrics
        BACKGROUND_JOB_COUNT.labels(
            job_type=job_type,
            status=status,
        ).inc()

        BACKGROUND_JOB_DURATION.labels(
            job_type=job_type,
        ).observe(duration)

        # Redis metrics
        if self.redis:
            key = f"{self.namespace}:job:{job_type}:{status}"
            pipe = self.redis.pipeline()
            pipe.hincrby(key, "count", 1)
            pipe.hincrbyfloat(key, "total_duration", duration)
            if error:
                pipe.hset(key, "last_error", error)
            pipe.expire(key, 86400)
            await pipe.execute()

    async def record_active_users(
        self,
        user_type: str,
        count: int,
    ) -> None:
        """Record active users count."""
        ACTIVE_USERS.labels(user_type=user_type).set(count)

        if self.redis:
            key = f"{self.namespace}:users:active:{user_type}"
            await self.redis.setex(key, 3600, count)

    async def record_reservation(
        self,
        status: str,
        source: str,
    ) -> None:
        """Record reservation metrics."""
        RESERVATION_COUNT.labels(
            status=status,
            source=source,
        ).inc()

        if self.redis:
            key = f"{self.namespace}:reservations:{status}:{source}"
            await self.redis.hincrby(key, "count", 1)
            await self.redis.expire(key, 86400 * 7)  # 7 days

    async def record_error(
        self,
        error_type: str,
        severity: str = "error",
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Record error metrics."""
        ERROR_COUNT.labels(
            error_type=error_type,
            severity=severity,
        ).inc()

        if self.redis and context:
            key = f"{self.namespace}:errors:{error_type}"
            await self.redis.hset(
                key,
                f"{datetime.now(timezone.utc).isoformat()}",
                str(context),
            )
            await self.redis.expire(key, 86400 * 3)  # 3 days

    async def get_metrics_summary(
        self,
        time_window_seconds: int = 3600,
    ) -> MetricsSummary:
        """Get summary of recent metrics."""
        summary = MetricsSummary()

        if not self.redis:
            return summary

        # Collect metrics from Redis
        pattern = f"{self.namespace}:*"
        cursor = 0
        keys = []

        # Scan for keys
        while True:
            cursor, batch = await self.redis.scan(
                cursor,
                match=pattern,
                count=100,
            )
            keys.extend(batch)
            if cursor == 0:
                break

        # Process keys
        for key in keys:
            key_str = key.decode() if isinstance(key, bytes) else key
            parts = key_str.split(":")

            if len(parts) < 3:
                continue

            metric_type = parts[2]

            if metric_type == "api":
                data = await self.redis.hgetall(key_str)
                if data:
                    method_endpoint = f"{parts[3]}:{parts[4]}" if len(parts) > 4 else parts[3]
                    count = int(data.get(b"count", 0))
                    summary.api_requests[method_endpoint] = count

            elif metric_type == "db":
                data = await self.redis.hgetall(key_str)
                if data:
                    operation_table = f"{parts[3]}:{parts[4]}" if len(parts) > 4 else parts[3]
                    count = int(data.get(b"count", 0))
                    summary.database_queries[operation_table] = count

            # Add other metric types...

        return summary

    def _record_duration(
        self,
        metric_name: str,
        duration: float,
        labels: Optional[Dict[str, str]] = None,
    ) -> None:
        """Record duration metric."""
        # Add to Sentry performance monitoring
        set_measurement(metric_name, duration * 1000, "millisecond")

    async def export_to_prometheus(self) -> str:
        """Export metrics in Prometheus format."""
        from prometheus_client import generate_latest

        return generate_latest().decode()


def _get_app_version() -> str:
    """Get application version."""
    import os

    if version := os.environ.get("APP_VERSION"):
        return version

    try:
        import subprocess

        result = subprocess.run(
            ["git", "describe", "--tags", "--always"],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except Exception:
        return "unknown"


# Decorator functions
def track_api_request(
    endpoint_name: Optional[str] = None,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator to track API request metrics."""

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        import functools

        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            # Extract request
            request = None
            for arg in args:
                if hasattr(arg, "method") and hasattr(arg, "url"):
                    request = arg
                    break

            endpoint = endpoint_name or (
                f"{request.method} {request.url.path}" if request else func.__name__
            )

            start_time = time.time()
            status_code = 500

            try:
                result = await func(*args, **kwargs)
                status_code = getattr(result, "status_code", 200)
                return result
            except Exception as e:
                if hasattr(e, "status_code"):
                    status_code = e.status_code
                raise
            finally:
                duration = time.time() - start_time
                if collector := getattr(args[0], "_metrics_collector", None):
                    await collector.record_api_request(
                        method=request.method if request else "UNKNOWN",
                        endpoint=endpoint,
                        status_code=status_code,
                        duration=duration,
                    )

        return wrapper

    return decorator


def track_database_query(
    operation: str,
    table: str,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator to track database query metrics."""

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        import functools

        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            start_time = time.time()

            try:
                result = await func(*args, **kwargs)
                row_count = len(result) if hasattr(result, "__len__") else None
                return result
            finally:
                duration = time.time() - start_time
                if collector := getattr(args[0], "_metrics_collector", None):
                    await collector.record_database_query(
                        operation=operation,
                        table=table,
                        duration=duration,
                        row_count=row_count,
                    )

        return wrapper

    return decorator


def track_cache_operation(
    operation: str = "get",
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator to track cache operation metrics."""

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        import functools

        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            result = await func(*args, **kwargs)
            hit = result is not None if operation == "get" else True

            if collector := getattr(args[0], "_metrics_collector", None):
                await collector.record_cache_operation(
                    operation=operation,
                    hit=hit,
                )

            return result

        return wrapper

    return decorator


def track_background_job(
    job_type: str,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator to track background job metrics."""

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        import functools

        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            start_time = time.time()
            status = "success"
            error = None

            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                status = "error"
                error = str(e)
                raise
            finally:
                duration = time.time() - start_time
                if collector := getattr(args[0], "_metrics_collector", None):
                    await collector.record_background_job(
                        job_type=job_type,
                        status=status,
                        duration=duration,
                        error=error,
                    )

        return wrapper

    return decorator