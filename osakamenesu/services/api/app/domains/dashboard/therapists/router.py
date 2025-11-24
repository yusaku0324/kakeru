from __future__ import annotations

import hashlib
from typing import Awaitable, TypeVar
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models
from ....db import get_session
from ....deps import require_dashboard_user
from ....schemas import (
    DashboardTherapistCreatePayload,
    DashboardTherapistDetail,
    DashboardTherapistPhotoUploadResponse,
    DashboardTherapistReorderPayload,
    DashboardTherapistSummary,
    DashboardTherapistUpdatePayload,
)
from .service import (
    ALLOWED_IMAGE_CONTENT_TYPES,
    MAX_PHOTO_BYTES,
    DashboardTherapistAuditContext,
    DashboardTherapistError,
    DashboardTherapistService,
    detect_image_type,
    ensure_datetime,
    sanitize_photo_urls,
    sanitize_strings,
    serialize_therapist,
    summary_from_detail,
)

_T = TypeVar("_T")

router = APIRouter(prefix="/api/dashboard", tags=["dashboard-therapists"])

_service = DashboardTherapistService()

# Backwards compatible re-exports for existing tests
_sanitize_strings = sanitize_strings
_sanitize_photo_urls = sanitize_photo_urls
_serialize_therapist = serialize_therapist
_summary_from_detail = summary_from_detail


def _detect_image_type(*args, **kwargs):
    try:
        return detect_image_type(*args, **kwargs)
    except DashboardTherapistError as exc:  # pragma: no cover - compatibility for tests
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


_ensure_datetime = ensure_datetime


def get_media_storage():
    return _service._media_storage_factory()


def _audit_context_from_request(request: Request) -> DashboardTherapistAuditContext:
    ip = request.headers.get("x-forwarded-for") or (
        request.client.host if request.client else ""
    )
    ip_hash = hashlib.sha256(ip.encode("utf-8")).hexdigest() if ip else None
    return DashboardTherapistAuditContext(ip_hash=ip_hash)


async def _run_service(call: Awaitable[_T]) -> _T:
    try:
        return await call
    except DashboardTherapistError as exc:  # pragma: no cover - HTTP adapter
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get(
    "/shops/{profile_id}/therapists",
    response_model=list[DashboardTherapistSummary],
)
async def list_dashboard_therapists(
    profile_id: UUID,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> list[DashboardTherapistSummary]:
    _ = user
    return await _run_service(_service.list_therapists(profile_id=profile_id, db=db))


@router.post(
    "/shops/{profile_id}/therapists",
    response_model=DashboardTherapistDetail,
    status_code=status.HTTP_201_CREATED,
)
async def create_dashboard_therapist(
    request: Request,
    profile_id: UUID,
    payload: DashboardTherapistCreatePayload,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DashboardTherapistDetail:
    _ = user
    context = _audit_context_from_request(request)
    return await _run_service(
        _service.create_therapist(
            audit_context=context,
            profile_id=profile_id,
            payload=payload,
            db=db,
        )
    )


@router.get(
    "/shops/{profile_id}/therapists/{therapist_id}",
    response_model=DashboardTherapistDetail,
)
async def get_dashboard_therapist(
    profile_id: UUID,
    therapist_id: UUID,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DashboardTherapistDetail:
    _ = user
    return await _run_service(
        _service.get_therapist(profile_id=profile_id, therapist_id=therapist_id, db=db)
    )


@router.patch(
    "/shops/{profile_id}/therapists/{therapist_id}",
    response_model=DashboardTherapistDetail,
)
async def update_dashboard_therapist(
    request: Request,
    profile_id: UUID,
    therapist_id: UUID,
    payload: DashboardTherapistUpdatePayload,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DashboardTherapistDetail:
    _ = user
    context = _audit_context_from_request(request)
    return await _run_service(
        _service.update_therapist(
            audit_context=context,
            profile_id=profile_id,
            therapist_id=therapist_id,
            payload=payload,
            db=db,
        )
    )


@router.delete(
    "/shops/{profile_id}/therapists/{therapist_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_dashboard_therapist(
    request: Request,
    profile_id: UUID,
    therapist_id: UUID,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> Response:
    _ = user
    context = _audit_context_from_request(request)
    await _run_service(
        _service.delete_therapist(
            audit_context=context,
            profile_id=profile_id,
            therapist_id=therapist_id,
            db=db,
        )
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/shops/{profile_id}/therapists/photos/upload",
    response_model=DashboardTherapistPhotoUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_dashboard_therapist_photo(
    request: Request,
    profile_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DashboardTherapistPhotoUploadResponse:
    _ = user
    context = _audit_context_from_request(request)
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
    storage = get_media_storage()
    return await _run_service(
        _service.upload_photo(
            audit_context=context,
            profile_id=profile_id,
            filename=file.filename,
            content_type=file.content_type,
            payload=payload,
            db=db,
            storage=storage,
        )
    )


@router.post(
    "/shops/{profile_id}/therapists:reorder",
    response_model=list[DashboardTherapistSummary],
)
async def reorder_dashboard_therapists(
    request: Request,
    profile_id: UUID,
    payload: DashboardTherapistReorderPayload,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> list[DashboardTherapistSummary]:
    _ = user
    context = _audit_context_from_request(request)
    return await _run_service(
        _service.reorder_therapists(
            audit_context=context,
            profile_id=profile_id,
            payload=payload,
            db=db,
        )
    )


__all__ = [
    "router",
    "ALLOWED_IMAGE_CONTENT_TYPES",
    "MAX_PHOTO_BYTES",
    "DashboardTherapistService",
    "_sanitize_strings",
    "_sanitize_photo_urls",
    "_serialize_therapist",
    "_summary_from_detail",
    "_detect_image_type",
    "_ensure_datetime",
    "get_media_storage",
]
