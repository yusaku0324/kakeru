"""Monitoring and observability module."""

from .sentry import (
    capture_exception,
    capture_message,
    set_user_context,
    set_tag,
    set_context,
    start_transaction,
    monitor_task,
)
from .metrics import (
    MetricsCollector,
    track_api_request,
    track_database_query,
    track_cache_operation,
    track_background_job,
)
from .health import (
    check_database_health,
    check_redis_health,
    check_meili_health,
    get_system_health,
)

__all__ = [
    # Sentry
    "capture_exception",
    "capture_message",
    "set_user_context",
    "set_tag",
    "set_context",
    "start_transaction",
    "monitor_task",
    # Metrics
    "MetricsCollector",
    "track_api_request",
    "track_database_query",
    "track_cache_operation",
    "track_background_job",
    # Health
    "check_database_health",
    "check_redis_health",
    "check_meili_health",
    "get_system_health",
]