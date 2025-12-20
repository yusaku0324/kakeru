from __future__ import annotations

from typing import Awaitable, TypeVar
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...deps import require_admin, audit_admin
from ...schemas import ReviewItem, ReviewListResponse, ReviewModerationRequest
from .services import review_service
from .services.audit import build_admin_audit_context
from .services.errors import AdminServiceError

_T = TypeVar("_T")

router = APIRouter()


def _admin_context(request: Request):
    ip = request.headers.get("x-forwarded-for") or (
        request.client.host if request.client else ""
    )
    admin_key = request.headers.get("x-admin-key")
    return build_admin_audit_context(ip=ip, admin_key=admin_key)


async def _run_service(call: Awaitable[_T]):
    try:
        return await call
    except AdminServiceError as exc:  # pragma: no cover - HTTP adapter
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get(
    "/api/admin/reviews", summary="List reviews", response_model=ReviewListResponse
)
async def admin_list_reviews(
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    return await _run_service(
        review_service.list_reviews(
            db=db,
            status_filter=status,
            page=page,
            page_size=page_size,
        )
    )


@router.patch(
    "/api/admin/reviews/{review_id}",
    summary="Update review status",
    response_model=ReviewItem,
)
async def admin_update_review_status(
    review_id: UUID,
    payload: ReviewModerationRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    context = _admin_context(request)
    return await _run_service(
        review_service.update_review_status(
            audit_context=context,
            db=db,
            review_id=review_id,
            payload=payload,
        )
    )
