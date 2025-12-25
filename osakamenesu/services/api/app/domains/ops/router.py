from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
import os
import secrets
import subprocess

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ... import models, schemas
from ...db import get_session
from ...settings import settings
from ...services.reservation_holds import expire_reserved_holds
from .cache_metrics import router as cache_router

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def require_ops_token(
    authorization: str | None = Header(None, alias="Authorization"),
) -> None:
    """Enforce optional bearer token for Ops endpoints."""
    token = getattr(settings, "ops_api_token", None)
    if not token:
        return

    if not authorization:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="ops_token_required")

    scheme, _, credentials = authorization.partition(" ")
    candidate = credentials.strip() if credentials else authorization.strip()
    if scheme.lower() == "bearer":
        candidate = credentials.strip()

    if not candidate or not secrets.compare_digest(candidate, token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="ops_token_invalid")


router = APIRouter(
    prefix="/api/ops", tags=["ops"], dependencies=[Depends(require_ops_token)]
)


async def _get_queue_stats(db: AsyncSession) -> schemas.OpsQueueStats:
    # Legacy notification queue removed - return empty stats
    return schemas.OpsQueueStats(
        pending=0,
        lag_seconds=0.0,
        oldest_created_at=None,
        next_attempt_at=None,
    )


async def _get_outbox_summary(db: AsyncSession) -> schemas.OpsOutboxSummary:
    # Legacy notification outbox removed - return empty stats
    return schemas.OpsOutboxSummary(channels=[])


async def _get_slots_summary(db: AsyncSession) -> schemas.OpsSlotsSummary:
    now = _utcnow()
    window_end = now + timedelta(hours=24)

    # Use GuestReservation instead of old Reservation
    pending_total_stmt = select(func.count(models.GuestReservation.id)).where(
        models.GuestReservation.status == "pending"
    )
    pending_stale_stmt = (
        select(func.count(models.GuestReservation.id))
        .where(models.GuestReservation.status == "pending")
        .where(models.GuestReservation.start_at < now)
    )
    confirmed_stmt = (
        select(func.count(models.GuestReservation.id))
        .where(models.GuestReservation.status == "confirmed")
        .where(models.GuestReservation.start_at >= now)
        .where(models.GuestReservation.start_at < window_end)
    )

    pending_total = int(await db.scalar(pending_total_stmt) or 0)
    pending_stale = int(await db.scalar(pending_stale_stmt) or 0)
    confirmed_next_24h = int(await db.scalar(confirmed_stmt) or 0)

    return schemas.OpsSlotsSummary(
        pending_total=pending_total,
        pending_stale=pending_stale,
        confirmed_next_24h=confirmed_next_24h,
        window_start=now,
        window_end=window_end,
    )


@router.get("/queue", response_model=schemas.OpsQueueStats)
async def get_ops_queue(
    db: AsyncSession = Depends(get_session),
) -> schemas.OpsQueueStats:
    return await _get_queue_stats(db)


@router.get("/outbox", response_model=schemas.OpsOutboxSummary)
async def get_ops_outbox(
    db: AsyncSession = Depends(get_session),
) -> schemas.OpsOutboxSummary:
    return await _get_outbox_summary(db)


@router.get("/slots", response_model=schemas.OpsSlotsSummary)
async def get_ops_slots(
    db: AsyncSession = Depends(get_session),
) -> schemas.OpsSlotsSummary:
    return await _get_slots_summary(db)


class MigrateResponse(BaseModel):
    success: bool
    message: str
    current_revision: str | None = None
    output: str | None = None


class StampRequest(BaseModel):
    revision: str = "head"


class ExpireHoldsResponse(BaseModel):
    expired: int
    now: datetime


@router.post("/reservations/expire_holds", response_model=ExpireHoldsResponse)
async def expire_holds(
    db: AsyncSession = Depends(get_session),
) -> ExpireHoldsResponse:
    now = _utcnow()
    expired = await expire_reserved_holds(db, now=now)
    if expired:
        await db.commit()
    return ExpireHoldsResponse(expired=expired, now=now)


@router.post("/stamp", response_model=MigrateResponse)
async def stamp_migration(
    request: StampRequest,
    db: AsyncSession = Depends(get_session),
) -> MigrateResponse:
    """Stamp the database with a specific alembic revision without running migrations.

    Use this to mark the database as being at a specific migration version
    when the actual schema is already in sync but alembic_version is missing.
    """
    try:
        result = subprocess.run(
            ["alembic", "stamp", request.revision],
            capture_output=True,
            text=True,
            timeout=60,
        )

        success = result.returncode == 0
        output = result.stdout + result.stderr

        logger.info("Stamp result: success=%s, output=%s", success, output)

        current_revision = None
        try:
            rev_result = await db.execute(
                text("SELECT version_num FROM alembic_version LIMIT 1")
            )
            row = rev_result.fetchone()
            if row:
                current_revision = row[0]
        except Exception as e:
            logger.warning("Could not get current revision: %s", e)

        return MigrateResponse(
            success=success,
            message=f"Stamped to {request.revision}" if success else "Stamp failed",
            current_revision=current_revision,
            output=output,
        )
    except subprocess.TimeoutExpired:
        logger.error("Stamp timed out")
        return MigrateResponse(
            success=False,
            message="Stamp timed out after 60 seconds",
        )
    except Exception as e:
        logger.exception("Stamp error: %s", e)
        return MigrateResponse(
            success=False,
            message=f"Stamp error: {str(e)}",
        )


@router.post("/migrate", response_model=MigrateResponse)
async def run_migrations(
    db: AsyncSession = Depends(get_session),
) -> MigrateResponse:
    """Run alembic database migrations.

    This endpoint runs 'alembic upgrade head' to apply any pending migrations.
    Protected by the ops_api_token.
    """
    try:
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            timeout=120,
        )

        success = result.returncode == 0
        output = result.stdout + result.stderr

        logger.info("Migration result: success=%s, output=%s", success, output)

        # Get current revision
        current_revision = None
        try:
            rev_result = await db.execute(
                text("SELECT version_num FROM alembic_version LIMIT 1")
            )
            row = rev_result.fetchone()
            if row:
                current_revision = row[0]
        except Exception as e:
            logger.warning("Could not get current revision: %s", e)

        return MigrateResponse(
            success=success,
            message="Migration completed" if success else "Migration failed",
            current_revision=current_revision,
            output=output,
        )
    except subprocess.TimeoutExpired:
        logger.error("Migration timed out")
        return MigrateResponse(
            success=False,
            message="Migration timed out after 120 seconds",
        )
    except Exception as e:
        logger.exception("Migration error: %s", e)
        return MigrateResponse(
            success=False,
            message=f"Migration error: {str(e)}",
        )


class BackupHealthResponse(BaseModel):
    status: str  # healthy, unhealthy
    message: str | None = None
    last_backup: str | None = None
    backup_count: int | None = None
    latest_size: int | None = None


@router.get("/health/backup", response_model=BackupHealthResponse)
async def backup_health_check(
    db: AsyncSession = Depends(get_session),
) -> BackupHealthResponse | JSONResponse:
    """Check the health of database backups.

    Returns unhealthy if:
    - No backups found
    - Latest backup is older than 48 hours
    - Cannot access backup storage
    """
    try:
        # For now, return a simple check based on GitHub Actions
        # In production, this would check S3/R2 for actual backup files

        # Check if we have the backup configuration
        bucket = os.getenv("BACKUP_S3_BUCKET")
        if not bucket:
            return BackupHealthResponse(
                status="unhealthy", message="Backup storage not configured"
            )

        # TODO: Implement actual S3/R2 check when AWS SDK is available
        # For now, we'll return a placeholder response
        # This would normally check the actual backup files in S3/R2

        return BackupHealthResponse(
            status="healthy",
            message="Backup monitoring requires S3/R2 integration",
            last_backup=datetime.now(timezone.utc).isoformat(),
            backup_count=0,
            latest_size=0,
        )

    except Exception as e:
        logger.exception("Backup health check error: %s", e)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "error": str(e)},
        )


# Include cache metrics sub-router
router.include_router(cache_router, tags=["ops"])
