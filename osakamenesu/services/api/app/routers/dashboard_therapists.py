from __future__ import annotations

import hashlib
from datetime import datetime, timezone
import imghdr
import mimetypes
from typing import Any, Iterable
from uuid import UUID
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..db import get_session
from ..deps import require_dashboard_user
from ..schemas import (
    DashboardTherapistCreatePayload,
    DashboardTherapistDetail,
    DashboardTherapistReorderPayload,
    DashboardTherapistPhotoUploadResponse,
    DashboardTherapistSummary,
    DashboardTherapistUpdatePayload,
)
from ..utils.profiles import build_profile_doc
from zoneinfo import ZoneInfo
from ..storage import get_media_storage, MediaStorageError

router = APIRouter(prefix="/api/dashboard", tags=["dashboard-therapists"])

JST = ZoneInfo("Asia/Tokyo")

MAX_PHOTO_BYTES = 8 * 1024 * 1024
ALLOWED_IMAGE_CONTENT_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
IMGHDR_TO_MIME: dict[str, str] = {
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
}


def _ensure_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


async def _get_profile(db: AsyncSession, profile_id: UUID) -> models.Profile:
    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="profile_not_found")
    return profile


def _sanitize_strings(values: Iterable[str] | None) -> list[str]:
    if not values:
        return []
    sanitized: list[str] = []
    for value in values:
        if not isinstance(value, str):
            continue
        text = value.strip()
        if text:
            sanitized.append(text)
    return sanitized


def _sanitize_photo_urls(values: Iterable[str] | None) -> list[str]:
    return _sanitize_strings(values)


def _serialize_therapist(model: models.Therapist) -> DashboardTherapistDetail:
    specialties = list(model.specialties or [])
    qualifications = list(model.qualifications or [])
    photo_urls = list(model.photo_urls or [])
    return DashboardTherapistDetail(
        id=model.id,
        name=model.name,
        alias=model.alias,
        headline=model.headline,
        biography=model.biography,
        specialties=[str(item) for item in specialties],
        qualifications=[str(item) for item in qualifications],
        experience_years=model.experience_years,
        status=model.status,
        display_order=model.display_order,
        is_booking_enabled=model.is_booking_enabled,
        photo_urls=[str(url) for url in photo_urls],
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _summary_from_detail(detail: DashboardTherapistDetail) -> DashboardTherapistSummary:
    return DashboardTherapistSummary(
        id=detail.id,
        name=detail.name,
        alias=detail.alias,
        headline=detail.headline,
        status=detail.status,
        display_order=detail.display_order,
        is_booking_enabled=detail.is_booking_enabled,
        updated_at=detail.updated_at,
        photo_urls=detail.photo_urls,
        specialties=detail.specialties,
    )


async def _reindex_profile(db: AsyncSession, profile: models.Profile) -> None:
    today = datetime.now(JST).date()
    availability_count = await db.execute(
        select(sa.func.count())
        .select_from(models.Availability)
        .where(models.Availability.profile_id == profile.id, models.Availability.date == today)
    )
    has_today = (availability_count.scalar_one() or 0) > 0
    outlinks = await db.execute(select(models.Outlink).where(models.Outlink.profile_id == profile.id))
    doc = build_profile_doc(
        profile,
        today=has_today,
        tag_score=0.0,
        ctr7d=0.0,
        outlinks=list(outlinks.scalars().all()),
    )
    try:
        from ..meili import index_profile

        index_profile(doc)
    except Exception:
        # Non-blocking: メイリーダウンで編集を失敗にしない
        pass


async def _sync_staff_contact_json(db: AsyncSession, profile: models.Profile) -> None:
    result = await db.execute(
        select(models.Therapist)
        .where(models.Therapist.profile_id == profile.id)
        .order_by(models.Therapist.display_order, models.Therapist.created_at)
    )
    therapists = list(result.scalars().all())
    staff_payload: list[dict[str, Any]] = []
    for therapist in therapists:
        staff_payload.append(
            {
                "id": str(therapist.id),
                "name": therapist.name,
                "alias": therapist.alias,
                "headline": therapist.headline,
                "biography": therapist.biography,
                "specialties": list(therapist.specialties or []),
                "qualifications": list(therapist.qualifications or []),
                "experience_years": therapist.experience_years,
                "photo_urls": list(therapist.photo_urls or []),
                "display_order": therapist.display_order,
                "status": therapist.status,
                "is_booking_enabled": therapist.is_booking_enabled,
            }
        )
    contact_json = dict(profile.contact_json or {})
    if staff_payload:
        contact_json["staff"] = staff_payload
    else:
        contact_json.pop("staff", None)
    profile.contact_json = contact_json
    await db.flush([profile])


async def _record_change(
    request: Request,
    db: AsyncSession,
    target_id: UUID | None,
    action: str,
    before: Any,
    after: Any,
) -> None:
    try:
        ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")
        ip_hash = hashlib.sha256(ip.encode("utf-8")).hexdigest() if ip else None
        log = models.AdminChangeLog(
            target_type="therapist",
            target_id=target_id,
            action=action,
            before_json=before,
            after_json=after,
            admin_key_hash=None,
            ip_hash=ip_hash,
        )
        db.add(log)
        await db.commit()
    except Exception:
        # 監査ログは失敗しても処理を止めない
        pass


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
    await _get_profile(db, profile_id)
    result = await db.execute(
        select(models.Therapist)
        .where(models.Therapist.profile_id == profile_id)
        .order_by(models.Therapist.display_order, models.Therapist.created_at)
    )
    therapists = list(result.scalars().all())
    summaries = []
    for therapist in therapists:
        detail = _serialize_therapist(therapist)
        summaries.append(_summary_from_detail(detail))
    return summaries


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
    profile = await _get_profile(db, profile_id)
    name = payload.name.strip() if payload.name else ""
    if not name:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field": "name", "message": "セラピスト名を入力してください。"},
        )

    specialties = _sanitize_strings(payload.specialties)
    qualifications = _sanitize_strings(payload.qualifications)
    photo_urls = _sanitize_photo_urls(payload.photo_urls)
    experience_years = None
    if payload.experience_years is not None:
        experience_years = max(0, int(payload.experience_years))

    display_order_res = await db.execute(
        select(models.Therapist.display_order)
        .where(models.Therapist.profile_id == profile_id)
        .order_by(models.Therapist.display_order.desc())
    )
    next_order = 0
    top = display_order_res.first()
    if top:
        next_order = (top[0] or 0) + 10

    therapist = models.Therapist(
        profile_id=profile_id,
        name=name,
        alias=payload.alias.strip() if payload.alias else None,
        headline=payload.headline.strip() if payload.headline else None,
        biography=payload.biography.strip() if payload.biography else None,
        specialties=specialties or None,
        qualifications=qualifications or None,
        experience_years=experience_years,
        photo_urls=photo_urls or None,
        is_booking_enabled=payload.is_booking_enabled if payload.is_booking_enabled is not None else True,
        display_order=next_order,
        status="draft",
    )
    db.add(therapist)
    await db.flush()
    await _sync_staff_contact_json(db, profile)
    await db.commit()
    await db.refresh(therapist)

    await _reindex_profile(db, profile)

    detail = _serialize_therapist(therapist)
    await _record_change(request, db, detail.id, "create", None, detail.model_dump())
    return detail


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
    await _get_profile(db, profile_id)
    therapist = await db.get(models.Therapist, therapist_id)
    if not therapist or therapist.profile_id != profile_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="therapist_not_found")
    return _serialize_therapist(therapist)


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
    profile = await _get_profile(db, profile_id)
    therapist = await db.get(models.Therapist, therapist_id)
    if not therapist or therapist.profile_id != profile_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="therapist_not_found")

    current_updated_at = _ensure_datetime(therapist.updated_at)
    incoming_updated_at = _ensure_datetime(payload.updated_at)
    if incoming_updated_at != current_updated_at:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "message": "conflict",
                "current": _serialize_therapist(therapist).model_dump(),
            },
        )

    before = _serialize_therapist(therapist).model_dump()

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"field": "name", "message": "セラピスト名を入力してください。"},
            )
        therapist.name = name

    if payload.alias is not None:
        therapist.alias = payload.alias.strip() or None

    if payload.headline is not None:
        therapist.headline = payload.headline.strip() or None

    if payload.biography is not None:
        therapist.biography = payload.biography.strip() or None

    if payload.specialties is not None:
        therapist.specialties = _sanitize_strings(payload.specialties) or None

    if payload.qualifications is not None:
        therapist.qualifications = _sanitize_strings(payload.qualifications) or None

    if payload.experience_years is not None:
        therapist.experience_years = max(0, int(payload.experience_years))

    if payload.photo_urls is not None:
        therapist.photo_urls = _sanitize_photo_urls(payload.photo_urls) or None

    if payload.status is not None:
        therapist.status = payload.status

    if payload.is_booking_enabled is not None:
        therapist.is_booking_enabled = bool(payload.is_booking_enabled)

    if payload.display_order is not None:
        therapist.display_order = max(0, int(payload.display_order))

    await db.flush()
    await _sync_staff_contact_json(db, profile)
    await db.commit()
    await db.refresh(therapist)
    await _reindex_profile(db, profile)

    detail = _serialize_therapist(therapist)
    await _record_change(request, db, detail.id, "update", before, detail.model_dump())
    return detail


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
    profile = await _get_profile(db, profile_id)
    therapist = await db.get(models.Therapist, therapist_id)
    if not therapist or therapist.profile_id != profile_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="therapist_not_found")

    before = _serialize_therapist(therapist).model_dump()
    await db.delete(therapist)
    await db.flush()

    await _sync_staff_contact_json(db, profile)
    await db.commit()
    await _reindex_profile(db, profile)
    await _record_change(request, db, therapist.id, "delete", before, None)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _matches_magic_signature(payload: bytes) -> tuple[str | None, str | None]:
    detected = imghdr.what(None, h=payload)
    if detected:
        mime = IMGHDR_TO_MIME.get(detected.lower())
        if mime and mime in ALLOWED_IMAGE_CONTENT_TYPES:
            return mime, ALLOWED_IMAGE_CONTENT_TYPES[mime]
    return None, None


def _detect_image_type(filename: str | None, content_type: str | None, payload: bytes) -> tuple[str, str]:
    mime, extension = _matches_magic_signature(payload)
    if mime:
        return mime, extension  # type: ignore[return-value]

    raise HTTPException(
        status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="unsupported_media_type",
    )


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
    profile = await _get_profile(db, profile_id)

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
    mime, extension = _detect_image_type(file.filename, file.content_type, payload)
    storage = get_media_storage()
    filename = f"{uuid.uuid4().hex}{extension}"
    folder = f"therapists/{profile_id}"

    try:
        stored = await storage.save_photo(folder=folder, filename=filename, content=payload, content_type=mime)
    except MediaStorageError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="upload_failed") from exc

    await _record_change(
        request,
        db,
        profile.id,
        "upload_photo",
        before=None,
        after={"key": stored.key, "url": stored.url, "content_type": mime},
    )

    return DashboardTherapistPhotoUploadResponse(
        url=stored.url,
        filename=filename,
        content_type=mime,
        size=len(payload),
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
    profile = await _get_profile(db, profile_id)
    if not payload.items:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "items_required"},
        )

    therapist_ids = {item.therapist_id for item in payload.items}
    result = await db.execute(
        select(models.Therapist)
        .where(models.Therapist.profile_id == profile_id, models.Therapist.id.in_(therapist_ids))
    )
    existing = {therapist.id: therapist for therapist in result.scalars().all()}
    if len(existing) != len(therapist_ids):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="therapist_not_found")

    before_state = [
        _serialize_therapist(existing[tid]).model_dump()
        for tid in sorted(existing, key=lambda t: existing[t].display_order)
    ]

    for item in payload.items:
        therapist = existing[item.therapist_id]
        therapist.display_order = max(0, item.display_order)

    await db.flush()
    await _sync_staff_contact_json(db, profile)
    await db.commit()

    result = await db.execute(
        select(models.Therapist)
        .where(models.Therapist.profile_id == profile_id)
        .order_by(models.Therapist.display_order, models.Therapist.created_at)
    )
    therapists = list(result.scalars().all())
    summaries = [_summary_from_detail(_serialize_therapist(t)) for t in therapists]

    after_state = [summary.model_dump() for summary in summaries]
    await _reindex_profile(db, profile)
    await _record_change(request, db, None, "reorder", before_state, after_state)
    return summaries
