"""Health check utilities for monitoring service dependencies."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
import redis.asyncio as redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..settings import settings

logger = logging.getLogger(__name__)


@dataclass
class HealthCheckResult:
    """Result of a health check."""

    name: str
    status: str  # "healthy", "degraded", "unhealthy"
    response_time: float  # in milliseconds
    message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    checked_at: datetime = None

    def __post_init__(self):
        if self.checked_at is None:
            self.checked_at = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "status": self.status,
            "response_time": self.response_time,
            "message": self.message,
            "details": self.details,
            "checked_at": self.checked_at.isoformat(),
        }


@dataclass
class SystemHealth:
    """Overall system health status."""

    status: str  # "healthy", "degraded", "unhealthy"
    version: str
    environment: str
    checks: List[HealthCheckResult]
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "status": self.status,
            "version": self.version,
            "environment": self.environment,
            "checks": [check.to_dict() for check in self.checks],
            "timestamp": self.timestamp.isoformat(),
        }


async def check_database_health(
    session: AsyncSession,
    timeout: float = 5.0,
) -> HealthCheckResult:
    """Check database health."""
    start_time = time.time()

    try:
        # Execute a simple query
        result = await asyncio.wait_for(
            session.execute(text("SELECT 1")),
            timeout=timeout,
        )
        result.scalar()

        # Check connection pool stats
        pool = session.bind.pool
        details = {
            "size": pool.size(),
            "checked_in": pool.checkedin(),
            "overflow": pool.overflow(),
            "total": pool.total(),
        }

        response_time = (time.time() - start_time) * 1000
        return HealthCheckResult(
            name="database",
            status="healthy",
            response_time=response_time,
            message="Database is responsive",
            details=details,
        )

    except asyncio.TimeoutError:
        response_time = timeout * 1000
        return HealthCheckResult(
            name="database",
            status="unhealthy",
            response_time=response_time,
            message=f"Database query timed out after {timeout}s",
        )

    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        logger.error(f"Database health check failed: {e}")
        return HealthCheckResult(
            name="database",
            status="unhealthy",
            response_time=response_time,
            message=f"Database error: {str(e)}",
        )


async def check_redis_health(
    redis_url: Optional[str] = None,
    timeout: float = 5.0,
) -> HealthCheckResult:
    """Check Redis health."""
    if not redis_url and not settings.redis_url:
        return HealthCheckResult(
            name="redis",
            status="unhealthy",
            response_time=0,
            message="Redis URL not configured",
        )

    start_time = time.time()
    client = None

    try:
        client = await redis.from_url(
            redis_url or settings.redis_url,
            decode_responses=True,
        )

        # Ping Redis
        await asyncio.wait_for(client.ping(), timeout=timeout)

        # Get Redis info
        info = await asyncio.wait_for(client.info(), timeout=timeout)

        details = {
            "version": info.get("redis_version"),
            "connected_clients": info.get("connected_clients"),
            "used_memory_human": info.get("used_memory_human"),
            "uptime_in_days": info.get("uptime_in_days"),
        }

        response_time = (time.time() - start_time) * 1000
        return HealthCheckResult(
            name="redis",
            status="healthy",
            response_time=response_time,
            message="Redis is responsive",
            details=details,
        )

    except asyncio.TimeoutError:
        response_time = timeout * 1000
        return HealthCheckResult(
            name="redis",
            status="unhealthy",
            response_time=response_time,
            message=f"Redis ping timed out after {timeout}s",
        )

    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        logger.error(f"Redis health check failed: {e}")
        return HealthCheckResult(
            name="redis",
            status="unhealthy",
            response_time=response_time,
            message=f"Redis error: {str(e)}",
        )

    finally:
        if client:
            await client.close()


async def check_meili_health(
    timeout: float = 5.0,
) -> HealthCheckResult:
    """Check Meilisearch health."""
    start_time = time.time()

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(
                f"{settings.meili_host}/health",
            )
            response.raise_for_status()

            # Get Meilisearch stats
            stats_response = await client.get(
                f"{settings.meili_host}/stats",
                headers={"Authorization": f"Bearer {settings.meili_master_key}"},
            )

            details = {}
            if stats_response.status_code == 200:
                stats = stats_response.json()
                details = {
                    "database_size": stats.get("databaseSize"),
                    "last_update": stats.get("lastUpdate"),
                    "indexes": len(stats.get("indexes", {})),
                }

            response_time = (time.time() - start_time) * 1000
            return HealthCheckResult(
                name="meilisearch",
                status="healthy",
                response_time=response_time,
                message="Meilisearch is responsive",
                details=details,
            )

    except asyncio.TimeoutError:
        response_time = timeout * 1000
        return HealthCheckResult(
            name="meilisearch",
            status="unhealthy",
            response_time=response_time,
            message=f"Meilisearch request timed out after {timeout}s",
        )

    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        logger.error(f"Meilisearch health check failed: {e}")
        return HealthCheckResult(
            name="meilisearch",
            status="unhealthy",
            response_time=response_time,
            message=f"Meilisearch error: {str(e)}",
        )


async def check_external_api_health(
    name: str,
    url: str,
    headers: Optional[Dict[str, str]] = None,
    timeout: float = 5.0,
) -> HealthCheckResult:
    """Check external API health."""
    start_time = time.time()

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()

            response_time = (time.time() - start_time) * 1000
            return HealthCheckResult(
                name=name,
                status="healthy",
                response_time=response_time,
                message=f"{name} is responsive",
                details={
                    "status_code": response.status_code,
                    "content_length": len(response.content),
                },
            )

    except asyncio.TimeoutError:
        response_time = timeout * 1000
        return HealthCheckResult(
            name=name,
            status="unhealthy",
            response_time=response_time,
            message=f"{name} request timed out after {timeout}s",
        )

    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        logger.error(f"{name} health check failed: {e}")
        return HealthCheckResult(
            name=name,
            status="unhealthy",
            response_time=response_time,
            message=f"{name} error: {str(e)}",
        )


async def get_system_health(
    session: Optional[AsyncSession] = None,
    check_external: bool = True,
) -> SystemHealth:
    """Get overall system health status."""
    checks: List[HealthCheckResult] = []

    # Database check
    if session:
        checks.append(await check_database_health(session))

    # Redis check
    checks.append(await check_redis_health())

    # Meilisearch check
    checks.append(await check_meili_health())

    # External API checks
    if check_external:
        # Add any external API health checks here
        pass

    # Determine overall status
    unhealthy_count = sum(1 for check in checks if check.status == "unhealthy")
    degraded_count = sum(1 for check in checks if check.status == "degraded")

    if unhealthy_count > 0:
        overall_status = "unhealthy"
    elif degraded_count > 0:
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    return SystemHealth(
        status=overall_status,
        version=_get_version(),
        environment=settings.sentry_environment or "production",
        checks=checks,
    )


def _get_version() -> str:
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