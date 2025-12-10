from __future__ import annotations

import uuid as uuid_module
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models
from ....db import get_session
from ....deps import require_dashboard_user, verify_shop_manager
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
    DashboardShopError,
    DashboardShopService,
)
from ....storage import MediaStorageError, get_media_storage
from ..therapists.service import (
    MAX_PHOTO_BYTES,
    ALLOWED_IMAGE_CONTENT_TYPES,
    detect_image_type,
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


def _handle_dashboard_error(error: DashboardShopError):
    raise HTTPException(status_code=error.status_code, detail=error.detail)


@router.get("/shops", response_model=DashboardShopListResponse)
async def list_dashboard_shops(
    limit: int = 20,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DashboardShopListResponse:
    return await _service.list_shops(limit=limit, db=db, user=user)


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
    try:
        return await _service.create_profile(
            request=request, payload=payload, db=db, user=user
        )
    except DashboardShopError as error:
        _handle_dashboard_error(error)


@router.get("/shops/{profile_id}/profile", response_model=DashboardShopProfileResponse)
async def get_dashboard_shop_profile(
    profile_id: UUID,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DashboardShopProfileResponse:
    await verify_shop_manager(db, user.id, profile_id)
    try:
        return await _service.get_profile_response(profile_id=profile_id, db=db)
    except DashboardShopError as error:
        _handle_dashboard_error(error)


@router.put("/shops/{profile_id}/profile", response_model=DashboardShopProfileResponse)
async def update_dashboard_shop_profile(
    request: Request,
    profile_id: UUID,
    payload: DashboardShopProfileUpdatePayload,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DashboardShopProfileResponse:
    await verify_shop_manager(db, user.id, profile_id)
    try:
        return await _service.update_profile(
            request=request,
            profile_id=profile_id,
            payload=payload,
            db=db,
            user=user,
            reindex=_reindex_profile,
            recorder=_record_change,
        )
    except DashboardShopError as error:
        _handle_dashboard_error(error)


class ShopPhotoUploadResponse(BaseModel):
    url: str
    filename: str
    content_type: str
    size: int


@router.post(
    "/shops/{profile_id}/photos/upload",
    response_model=ShopPhotoUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_shop_photo(
    profile_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> ShopPhotoUploadResponse:
    await verify_shop_manager(db, user.id, profile_id)

    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop_not_found")

    max_bytes = MAX_PHOTO_BYTES
    chunk_size = 512 * 1024
    size = 0
    payload_bytes = bytearray()

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        size += len(chunk)
        if size > max_bytes:
            await file.close()
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail={"message": "file_too_large", "limit_bytes": MAX_PHOTO_BYTES},
            )
        payload_bytes.extend(chunk)

    await file.close()
    if not payload_bytes:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "empty_file"},
        )

    payload = bytes(payload_bytes)

    try:
        mime, extension = detect_image_type(file.filename, file.content_type, payload)
    except Exception:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"message": "unsupported_image_type"},
        )

    storage = get_media_storage()
    stored_name = f"{uuid_module.uuid4().hex}{extension}"
    folder = f"shops/{profile_id}"

    try:
        stored = await storage.save_photo(
            folder=folder, filename=stored_name, content=payload, content_type=mime
        )
    except MediaStorageError as exc:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "upload_failed"},
        ) from exc

    return ShopPhotoUploadResponse(
        url=stored.url,
        filename=stored_name,
        content_type=mime,
        size=len(payload),
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
