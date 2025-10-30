from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models
from ....db import get_session
from ....deps import require_dashboard_user
from ....schemas import (
    DashboardShopListResponse,
    DashboardShopSummaryItem,
    DashboardShopContact,
    DashboardShopMenu,
    DashboardShopProfileCreatePayload,
    DashboardShopProfileResponse,
    DashboardShopProfileUpdatePayload,
    DashboardShopStaff,
)
from ....services.dashboard_shop_service import (
    ALLOWED_PROFILE_STATUSES,
    DEFAULT_BUST_TAG,
    DashboardShopService,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

_service = DashboardShopService()

# Backwards-compatible exports for tests
_extract_contact = _service.extract_contact
_extract_menus = _service.extract_menus
_extract_staff = _service.extract_staff
_serialize_profile = _service.serialize_profile
_reindex_profile = _service.reindex_profile
_record_change = _service.record_change
_update_contact_json = _service.update_contact_json
_sanitize_service_tags = _service.sanitize_service_tags
_sanitize_photos = _service.sanitize_photos
_menus_to_contact_json = _service.menus_to_contact_json
_staff_to_contact_json = _service.staff_to_contact_json
_get_profile = _service.get_profile


@router.get("/shops", response_model=DashboardShopListResponse)
async def list_dashboard_shops(
    limit: int = 20,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DashboardShopListResponse:
    _ = user
    return await _service.list_shops(limit=limit, db=db)


@router.post(
    "/shops",
    response_model=DashboardShopProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_dashboard_shop_profile(
    request: Request,
    payload: DashboardShopProfileCreatePayload,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DashboardShopProfileResponse:
    return await _service.create_profile(request=request, payload=payload, db=db, user=user)


@router.get("/shops/{profile_id}/profile", response_model=DashboardShopProfileResponse)
async def get_dashboard_shop_profile(
    profile_id: UUID,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DashboardShopProfileResponse:
    _ = user
    return await _service.get_profile_response(profile_id=profile_id, db=db)


@router.put("/shops/{profile_id}/profile", response_model=DashboardShopProfileResponse)
async def update_dashboard_shop_profile(
    request: Request,
    profile_id: UUID,
    payload: DashboardShopProfileUpdatePayload,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DashboardShopProfileResponse:
    return await _service.update_profile(
        request=request,
        profile_id=profile_id,
        payload=payload,
        db=db,
        user=user,
        reindex=_reindex_profile,
        recorder=_record_change,
    )


__all__ = [
    "router",
    "DashboardShopService",
    "DEFAULT_BUST_TAG",
    "ALLOWED_PROFILE_STATUSES",
    "_extract_contact",
    "_extract_menus",
    "_extract_staff",
    "_serialize_profile",
    "_reindex_profile",
    "_record_change",
    "_update_contact_json",
    "_sanitize_service_tags",
    "_sanitize_photos",
    "_menus_to_contact_json",
    "_staff_to_contact_json",
    "_get_profile",
]
