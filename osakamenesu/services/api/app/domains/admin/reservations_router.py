from __future__ import annotations

from typing import Awaitable, TypeVar
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...deps import require_admin, audit_admin
from ...schemas import ReservationAdminList, ReservationAdminUpdate
from .services import reservation_service
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
    "/api/admin/reservations",
    summary="List reservations",
    response_model=ReservationAdminList,
)
async def list_reservations(
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    return await _run_service(
        reservation_service.list_reservations(
            db=db,
            status_filter=status,
            limit=limit,
            offset=offset,
        )
    )


@router.patch(
    "/api/admin/reservations/{reservation_id}", summary="Update reservation status"
)
async def update_reservation_admin(
    request: Request,
    reservation_id: str,
    payload: ReservationAdminUpdate,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
    _audit=Depends(audit_admin),
):
    context = _admin_context(request)
    return await _run_service(
        reservation_service.update_reservation(
            audit_context=context,
            db=db,
            reservation_id=UUID(reservation_id),
            payload=payload,
        )
    )
