"""Enhanced Sentry integration for comprehensive error and performance monitoring."""

from __future__ import annotations

import functools
import logging
import time
from contextlib import contextmanager
from typing import Any, Callable, Dict, Optional, TypeVar, Union

import sentry_sdk
from sentry_sdk import Hub, configure_scope, start_transaction as sentry_start_transaction
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from ..settings import settings

logger = logging.getLogger(__name__)

T = TypeVar("T")


def init_sentry(
    dsn: Optional[str] = None,
    environment: Optional[str] = None,
    traces_sample_rate: Optional[float] = None,
    profiles_sample_rate: Optional[float] = None,
) -> None:
    """Initialize Sentry with enhanced configuration."""
    if not dsn and not settings.sentry_dsn:
        logger.info("Sentry DSN not configured, skipping initialization")
        return

    sentry_sdk.init(
        dsn=dsn or settings.sentry_dsn,
        environment=environment or settings.sentry_environment or "production",
        traces_sample_rate=traces_sample_rate or settings.sentry_traces_sample_rate or 0.1,
        profiles_sample_rate=profiles_sample_rate or 0.1,  # Enable profiling
        send_default_pii=False,
        attach_stacktrace=True,
        integrations=[
            LoggingIntegration(
                level=logging.INFO,  # Capture info and above
                event_level=logging.ERROR,  # Only send errors as events
            ),
            SqlalchemyIntegration(),
        ],
        before_send=_before_send,
        before_send_transaction=_before_send_transaction,
        # Performance monitoring
        enable_tracing=True,
        # Release tracking
        release=_get_release_version(),
    )


def _before_send(event: Dict[str, Any], hint: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Process events before sending to Sentry."""
    # Filter out sensitive data
    if "request" in event and "data" in event["request"]:
        _sanitize_data(event["request"]["data"])

    # Add custom context
    with configure_scope() as scope:
        if user := scope._user:
            event.setdefault("user", {}).update(user)

    return event


def _before_send_transaction(
    event: Dict[str, Any], hint: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Process transactions before sending to Sentry."""
    # Filter out health checks and static files
    if "transaction" in event:
        transaction_name = event["transaction"]
        if any(
            path in transaction_name
            for path in ["/health", "/metrics", "/favicon.ico", "/robots.txt"]
        ):
            return None

    return event


def _sanitize_data(data: Any) -> None:
    """Remove sensitive data from request payload."""
    if isinstance(data, dict):
        sensitive_keys = {
            "password",
            "token",
            "secret",
            "api_key",
            "apikey",
            "authorization",
            "card_number",
            "cvv",
            "ssn",
        }
        for key in list(data.keys()):
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                data[key] = "[REDACTED]"
            elif isinstance(data[key], (dict, list)):
                _sanitize_data(data[key])
    elif isinstance(data, list):
        for item in data:
            _sanitize_data(item)


def _get_release_version() -> Optional[str]:
    """Get release version from environment or git."""
    import os

    # Try environment variable first
    if release := os.environ.get("SENTRY_RELEASE"):
        return release

    # Try to get from git
    try:
        import subprocess

        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        return f"api@{result.stdout.strip()}"
    except Exception:
        return None


def capture_exception(
    error: Optional[Exception] = None,
    level: str = "error",
    **kwargs: Any,
) -> Optional[str]:
    """Capture an exception with additional context."""
    try:
        with configure_scope() as scope:
            # Add extra context
            for key, value in kwargs.items():
                scope.set_extra(key, value)

        return sentry_sdk.capture_exception(error, level=level)
    except Exception as e:
        logger.error(f"Failed to capture exception to Sentry: {e}")
        return None


def capture_message(
    message: str,
    level: str = "info",
    **kwargs: Any,
) -> Optional[str]:
    """Capture a message with additional context."""
    try:
        with configure_scope() as scope:
            # Add extra context
            for key, value in kwargs.items():
                scope.set_extra(key, value)

        return sentry_sdk.capture_message(message, level=level)
    except Exception as e:
        logger.error(f"Failed to capture message to Sentry: {e}")
        return None


def set_user_context(
    user_id: Optional[Union[str, int]] = None,
    email: Optional[str] = None,
    username: Optional[str] = None,
    ip_address: Optional[str] = None,
    **extra: Any,
) -> None:
    """Set user context for Sentry."""
    try:
        with configure_scope() as scope:
            user_data = {"id": str(user_id)} if user_id else {}
            if email:
                user_data["email"] = email
            if username:
                user_data["username"] = username
            if ip_address:
                user_data["ip_address"] = ip_address
            if extra:
                user_data.update(extra)

            scope.set_user(user_data if user_data else None)
    except Exception as e:
        logger.error(f"Failed to set user context: {e}")


def set_tag(key: str, value: Any) -> None:
    """Set a tag for categorizing events."""
    try:
        with configure_scope() as scope:
            scope.set_tag(key, value)
    except Exception as e:
        logger.error(f"Failed to set tag: {e}")


def set_context(key: str, value: Dict[str, Any]) -> None:
    """Set custom context for events."""
    try:
        with configure_scope() as scope:
            scope.set_context(key, value)
    except Exception as e:
        logger.error(f"Failed to set context: {e}")


@contextmanager
def start_transaction(
    op: str,
    name: Optional[str] = None,
    **kwargs: Any,
):
    """Start a performance monitoring transaction."""
    transaction = sentry_start_transaction(
        op=op,
        name=name,
        **kwargs,
    )

    with Hub.current.start_transaction(transaction):
        try:
            yield transaction
        except Exception as e:
            transaction.set_status("internal_error")
            raise
        else:
            transaction.set_status("ok")


def monitor_task(
    op: str = "task",
    name: Optional[str] = None,
    capture_errors: bool = True,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator to monitor background tasks."""

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        task_name = name or f"{func.__module__}.{func.__name__}"

        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            with start_transaction(op=op, name=task_name) as transaction:
                transaction.set_tag("task.name", func.__name__)
                transaction.set_tag("task.module", func.__module__)

                start_time = time.time()
                try:
                    result = func(*args, **kwargs)
                    transaction.set_tag("task.status", "success")
                    return result
                except Exception as e:
                    transaction.set_tag("task.status", "error")
                    transaction.set_tag("error.type", type(e).__name__)

                    if capture_errors:
                        capture_exception(
                            e,
                            extra={
                                "task_name": task_name,
                                "args": args,
                                "kwargs": kwargs,
                            },
                        )
                    raise
                finally:
                    duration = time.time() - start_time
                    transaction.set_measurement("task.duration", duration, "second")

        return wrapper

    return decorator


def monitor_api_endpoint(
    capture_errors: bool = True,
    capture_request_body: bool = False,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator to monitor API endpoints."""

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            # Extract request from kwargs or args
            request = None
            for arg in args:
                if hasattr(arg, "method") and hasattr(arg, "url"):
                    request = arg
                    break
            if not request:
                request = kwargs.get("request")

            with start_transaction(
                op="http.server",
                name=f"{request.method} {request.url.path}" if request else func.__name__,
            ) as transaction:
                if request:
                    transaction.set_tag("http.method", request.method)
                    transaction.set_tag("http.url", str(request.url))
                    transaction.set_tag("http.scheme", request.url.scheme)

                    # Set user context if available
                    if hasattr(request.state, "user") and request.state.user:
                        set_user_context(
                            user_id=request.state.user.id,
                            email=getattr(request.state.user, "email", None),
                        )

                    # Capture request body if enabled
                    if capture_request_body and hasattr(request, "body"):
                        try:
                            body = await request.body()
                            transaction.set_context("request.body", {"data": body.decode()})
                        except Exception:
                            pass

                start_time = time.time()
                try:
                    result = await func(*args, **kwargs)
                    transaction.set_tag("http.status_code", getattr(result, "status_code", 200))
                    return result
                except Exception as e:
                    if capture_errors and not isinstance(e, (HTTPException,)):
                        capture_exception(
                            e,
                            extra={
                                "endpoint": func.__name__,
                                "method": request.method if request else None,
                                "path": str(request.url.path) if request else None,
                            },
                        )
                    raise
                finally:
                    duration = time.time() - start_time
                    transaction.set_measurement("http.response_time", duration * 1000, "millisecond")

        return wrapper

    return decorator