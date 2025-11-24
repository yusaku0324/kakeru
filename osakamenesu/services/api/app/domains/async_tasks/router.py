from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from ...db import get_session
from ...notifications import (
    ReservationNotification,
    dispatch_delivery_by_id,
    enqueue_reservation_notification,
)
from ...settings import settings
from ...utils.proxy import require_proxy_signature

router = APIRouter(prefix="/api/async", tags=["async"])


def _ensure_notification_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    data = payload.get("notification")
    if not isinstance(data, dict):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="notification_payload_required",
        )
    return data


def _parse_schedule_at(payload: Dict[str, Any]) -> datetime | None:
    schedule_at_iso = payload.get("schedule_at")
    if not schedule_at_iso:
        return None
    try:
        dt = datetime.fromisoformat(schedule_at_iso)
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="invalid_schedule_at",
        ) from exc
    return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def _enqueue_notification(
    db: AsyncSession,
    payload: Dict[str, Any],
    *,
    overrides: Dict[str, Any] | None = None,
    job_type: str,
) -> Dict[str, Any]:
    data = _ensure_notification_payload(payload)
    schedule_at_dt = _parse_schedule_at(payload)

    merged = dict(data)
    if overrides:
        merged.update({k: v for k, v in overrides.items() if v is not None})

    try:
        notification = ReservationNotification(**merged)
    except TypeError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"invalid_notification_payload: {exc}",
        ) from exc

    await enqueue_reservation_notification(db, notification, schedule_at=schedule_at_dt)
    await db.commit()
    return {"status": "accepted", "type": job_type}


async def _handle_reservation_notification_job(
    payload: Dict[str, Any],
    db: AsyncSession,
) -> Dict[str, Any]:
    return await _enqueue_notification(db, payload, overrides=None, job_type="reservation_notification")


async def _handle_reservation_reminder_job(
    payload: Dict[str, Any],
    db: AsyncSession,
) -> Dict[str, Any]:
    data = _ensure_notification_payload(payload)
    if not data.get("reminder_at"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="reminder_at_required",
        )
    overrides = {
        "event": "reminder",
        "audience": data.get("audience") or "customer",
        "status": data.get("status") or "confirmed",
    }
    return await _enqueue_notification(db, payload, overrides=overrides, job_type="reservation_reminder")


async def _handle_reservation_cancellation_job(
    payload: Dict[str, Any],
    db: AsyncSession,
) -> Dict[str, Any]:
    overrides = {
        "status": "cancelled",
        "event": payload.get("notification", {}).get("event") or "status",
    }
    return await _enqueue_notification(db, payload, overrides=overrides, job_type="reservation_cancellation")


@router.post("/jobs", status_code=status.HTTP_202_ACCEPTED)
async def enqueue_job(
    request: Request,
    _verified: None = Depends(require_proxy_signature),
    db: AsyncSession = Depends(get_session),
):
    payload = await request.json()
    job_type = payload.get("type")
    if not job_type:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="job_type_required",
        )

    if job_type == "reservation_notification":
        return await _handle_reservation_notification_job(payload, db)
    if job_type == "reservation_reminder":
        return await _handle_reservation_reminder_job(payload, db)
    if job_type == "reservation_cancellation":
        return await _handle_reservation_cancellation_job(payload, db)

    raise HTTPException(
        status.HTTP_400_BAD_REQUEST,
        detail="unsupported_job_type",
    )


@router.get("/ping")
async def async_ping(_verified: None = Depends(require_proxy_signature)):
    return {"ok": "async-proxy"}


def require_worker_token(authorization: str | None = Header(None, alias="Authorization")) -> None:
    token = settings.async_worker_token
    if not token:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="worker_token_not_configured")
    if not authorization:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="worker_token_required")
    scheme, _, credentials = authorization.partition(" ")
    candidate = credentials or authorization
    if scheme.lower() == "bearer":
        candidate = credentials
    candidate = (candidate or "").strip()
    if not candidate or candidate != token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="worker_token_invalid")


@router.post("/deliveries/{delivery_id}/dispatch")
async def dispatch_delivery(
    delivery_id: UUID,
    db: AsyncSession = Depends(get_session),
    _verified: None = Depends(require_worker_token),
):
    try:
        handled = await dispatch_delivery_by_id(db, delivery_id)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="delivery_not_found") from exc
    await db.commit()
    return {"status": "succeeded" if handled else "skipped"}


__all__ = ["router"]
