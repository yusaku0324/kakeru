from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from ...utils.proxy import require_proxy_signature

router = APIRouter(prefix="/api/async", tags=["async"])


@router.get("/ping")
async def async_ping(_verified: None = Depends(require_proxy_signature)):
    return {"ok": "async-proxy"}


@router.post("/jobs", status_code=status.HTTP_202_ACCEPTED)
async def enqueue_job(
    _verified: None = Depends(require_proxy_signature),
):
    """Legacy notification job endpoint - removed."""
    raise HTTPException(
        status.HTTP_410_GONE,
        detail="legacy_notification_system_removed",
    )


__all__ = ["router"]
