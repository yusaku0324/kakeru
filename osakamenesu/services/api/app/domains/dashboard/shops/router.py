from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models
from ....db import get_session
from ....deps import require_dashboard_user
from ....meili import index_profile
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
from ....utils.datetime import ensure_aware_datetime
from ....utils.profiles import build_profile_doc
from ....utils.slug import slugify
from ....utils.text import strip_or_none

JST = ZoneInfo("Asia/Tokyo")

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

DEFAULT_BUST_TAG = "UNSPECIFIED"
ALLOWED_PROFILE_STATUSES = {"draft", "published", "hidden"}


def _extract_contact(
    contact_json: Dict[str, Any] | None
) -> Optional[DashboardShopContact]:
    if not isinstance(contact_json, dict):
        return None
    phone = contact_json.get("phone") or contact_json.get("tel")
    line_id = contact_json.get("line_id") or contact_json.get("line")
    website_url = contact_json.get("website_url") or contact_json.get("web")
    reservation_form_url = contact_json.get("reservation_form_url")
    if not any([phone, line_id, website_url, reservation_form_url]):
        return None
    return DashboardShopContact(
        phone=phone,
        line_id=line_id,
        website_url=website_url,
        reservation_form_url=reservation_form_url,
    )


def _extract_menus(raw: Any) -> List[DashboardShopMenu]:
    if not isinstance(raw, list):
        return []
    items: List[DashboardShopMenu] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        name = strip_or_none(entry.get("name"))
        if not name:
            continue
        try:
            price = int(entry.get("price") or 0)
        except Exception:
            price = 0
        try:
            duration = entry.get("duration_minutes")
            duration_value = int(duration) if duration is not None else None
        except Exception:
            duration_value = None
        tags = []
        raw_tags = entry.get("tags") or []
        if isinstance(raw_tags, list):
            tags = [str(tag) for tag in raw_tags if str(tag).strip()]
        items.append(
            DashboardShopMenu(
                id=str(entry.get("id")) if entry.get("id") else None,
                name=name,
                price=max(0, price),
                duration_minutes=duration_value,
                description=strip_or_none(entry.get("description")),
                tags=tags,
                is_reservable_online=entry.get("is_reservable_online", True),
            )
        )
    return items


def _extract_staff(raw: Any) -> List[DashboardShopStaff]:
    if not isinstance(raw, list):
        return []
    members: List[DashboardShopStaff] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        name = strip_or_none(entry.get("name"))
        if not name:
            continue
        specialties = []
        raw_specialties = entry.get("specialties") or []
        if isinstance(raw_specialties, list):
            specialties = []
            for item in raw_specialties:
                cleaned = strip_or_none(str(item))
                if cleaned:
                    specialties.append(cleaned)
        members.append(
            DashboardShopStaff(
                id=str(entry.get("id")) if entry.get("id") else None,
                name=name,
                alias=strip_or_none(entry.get("alias")),
                headline=strip_or_none(entry.get("headline")),
                specialties=specialties,
            )
        )
    return members


def _serialize_profile(profile: models.Profile) -> DashboardShopProfileResponse:
    contact_json = profile.contact_json or {}
    contact = _extract_contact(contact_json)
    menus = _extract_menus(contact_json.get("menus"))
    staff = _extract_staff(contact_json.get("staff"))
    service_tags = contact_json.get("service_tags") or profile.body_tags or []
    photos = [str(url) for url in (profile.photos or [])]

    return DashboardShopProfileResponse(
        id=profile.id,
        slug=profile.slug,
        name=profile.name,
        store_name=contact_json.get("store_name") or profile.name,
        area=profile.area,
        price_min=profile.price_min,
        price_max=profile.price_max,
        service_type=profile.service_type,
        service_tags=[str(tag) for tag in service_tags],
        description=contact_json.get("description"),
        catch_copy=contact_json.get("catch_copy"),
        address=contact_json.get("address"),
        photos=photos,
        contact=contact,
        menus=menus,
        staff=staff,
        updated_at=profile.updated_at,
        status=profile.status,
    )


async def _get_profile(db: AsyncSession, profile_id: UUID) -> models.Profile:
    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="profile_not_found"
        )
    return profile


async def _reindex_profile(db: AsyncSession, profile: models.Profile) -> None:
    today = datetime.now(JST).date()
    availability_count = await db.execute(
        select(func.count())
        .select_from(models.Availability)
        .where(
            models.Availability.profile_id == profile.id,
            models.Availability.date == today,
        )
    )
    has_today = (availability_count.scalar_one() or 0) > 0
    outlinks_result = await db.execute(
        select(models.Outlink).where(models.Outlink.profile_id == profile.id)
    )
    outlinks = list(outlinks_result.scalars().all())
    doc = build_profile_doc(
        profile, today=has_today, tag_score=0.0, ctr7d=0.0, outlinks=outlinks
    )
    try:
        index_profile(doc)
    except Exception:
        # Meili の一時的な失敗で編集を失敗扱いにしない
        pass


async def _record_change(
    request: Request,
    db: AsyncSession,
    target_id: UUID | None,
    action: str,
    before: Any,
    after: Any,
) -> None:
    try:
        ip = request.headers.get("x-forwarded-for") or (
            request.client.host if request.client else ""
        )
        ip_hash = hashlib.sha256(ip.encode("utf-8")).hexdigest() if ip else None
        log = models.AdminChangeLog(
            target_type="shop_profile",
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
        # 監査ログが失敗しても処理自体は成功扱いにする
        pass


@router.get("/shops", response_model=DashboardShopListResponse)
async def list_dashboard_shops(
    limit: int = 20,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DashboardShopListResponse:
    _ = user
    limit_value = max(1, min(limit, 100))
    stmt = (
        select(models.Profile)
        .order_by(models.Profile.updated_at.desc())
        .limit(limit_value)
    )
    result = await db.execute(stmt)
    profiles = list(result.scalars().all())
    items = [
        DashboardShopSummaryItem(
            id=profile.id,
            name=profile.name,
            area=profile.area,
            status=profile.status,
            updated_at=profile.updated_at,
        )
        for profile in profiles
    ]
    return DashboardShopListResponse(shops=items)


def _update_contact_json(
    contact_json: Dict[str, Any],
    contact: Optional[DashboardShopContact],
) -> None:
    if contact is None:
        # 空指定の場合は既存のキーをクリア
        for key in [
            "phone",
            "tel",
            "line_id",
            "line",
            "website_url",
            "web",
            "reservation_form_url",
        ]:
            contact_json.pop(key, None)
        return

    if contact.phone is not None:
        if contact.phone:
            contact_json["phone"] = contact.phone
            contact_json["tel"] = contact.phone
        else:
            contact_json.pop("phone", None)
            contact_json.pop("tel", None)
    if contact.line_id is not None:
        if contact.line_id:
            contact_json["line_id"] = contact.line_id
            contact_json["line"] = contact.line_id
        else:
            contact_json.pop("line_id", None)
            contact_json.pop("line", None)
    if contact.website_url is not None:
        if contact.website_url:
            contact_json["website_url"] = contact.website_url
            contact_json["web"] = contact.website_url
        else:
            contact_json.pop("website_url", None)
            contact_json.pop("web", None)
    if contact.reservation_form_url is not None:
        if contact.reservation_form_url:
            contact_json["reservation_form_url"] = contact.reservation_form_url
        else:
            contact_json.pop("reservation_form_url", None)


def _sanitize_service_tags(raw: Optional[List[str]]) -> List[str]:
    if not raw:
        return []
    tags: List[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        value = item.strip()
        if value:
            tags.append(value)
    return tags


def _sanitize_photos(raw: Optional[List[str]]) -> List[str]:
    if not raw:
        return []
    photos: List[str] = []
    for url in raw:
        if not isinstance(url, str):
            continue
        value = url.strip()
        if value:
            photos.append(value)
    return photos


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
    _ = user
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field": "name", "message": "店舗名を入力してください。"},
        )
    area = (payload.area or "").strip()
    if not area:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field": "area", "message": "エリアを入力してください。"},
        )

    try:
        price_min = max(0, int(payload.price_min))
        price_max = max(0, int(payload.price_max))
    except Exception as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field": "price", "message": "料金は数値で入力してください。"},
        ) from exc

    if price_max < price_min:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "field": "price_max",
                "message": "料金の上限は下限以上に設定してください。",
            },
        )

    service_type = (
        (payload.service_type or "store").strip() if payload.service_type else "store"
    )
    if service_type not in {"store", "dispatch"}:
        service_type = "store"

    service_tags = _sanitize_service_tags(payload.service_tags)
    photos = _sanitize_photos(payload.photos)

    contact_json: Dict[str, Any] = {}
    if payload.contact is not None:
        _update_contact_json(contact_json, payload.contact)

    if payload.description:
        contact_json["description"] = payload.description.strip()
    if payload.catch_copy:
        contact_json["catch_copy"] = payload.catch_copy.strip()
    if payload.address:
        contact_json["address"] = payload.address.strip()

    if service_tags:
        contact_json["service_tags"] = service_tags

    if "store_name" not in contact_json or not contact_json.get("store_name"):
        contact_json["store_name"] = name

    profile = models.Profile(
        name=name,
        area=area,
        price_min=price_min,
        price_max=price_max,
        service_type=service_type,
        bust_tag=DEFAULT_BUST_TAG,
        status="draft",
    )
    profile.body_tags = service_tags or []
    profile.photos = photos or []
    profile.contact_json = contact_json

    db.add(profile)
    await db.flush()
    await db.commit()
    await db.refresh(profile)

    await _reindex_profile(db, profile)
    response = _serialize_profile(profile)
    await _record_change(request, db, profile.id, "create", None, response.model_dump())
    return response


def _menus_to_contact_json(items: List[DashboardShopMenu]) -> List[Dict[str, Any]]:
    payload: List[Dict[str, Any]] = []
    for item in items:
        name = item.name.strip()
        if not name:
            continue
        try:
            price = int(item.price)
        except Exception:
            price = 0
        try:
            duration = (
                int(item.duration_minutes)
                if item.duration_minutes is not None
                else None
            )
        except Exception:
            duration = None
        tags = [tag.strip() for tag in (item.tags or []) if tag.strip()]
        payload.append(
            {
                "id": item.id or str(uuid.uuid4()),
                "name": name,
                "price": max(0, price),
                "duration_minutes": duration,
                "description": item.description,
                "tags": tags,
                "is_reservable_online": item.is_reservable_online,
            }
        )
    return payload


def _staff_to_contact_json(items: List[DashboardShopStaff]) -> List[Dict[str, Any]]:
    payload: List[Dict[str, Any]] = []
    for member in items:
        name = member.name.strip()
        if not name:
            continue
        specialties = [tag.strip() for tag in (member.specialties or []) if tag.strip()]
        payload.append(
            {
                "id": member.id or str(uuid.uuid4()),
                "name": name,
                "alias": member.alias or None,
                "headline": member.headline or None,
                "specialties": specialties,
            }
        )
    return payload


@router.get("/shops/{profile_id}/profile", response_model=DashboardShopProfileResponse)
async def get_dashboard_shop_profile(
    profile_id: UUID,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DashboardShopProfileResponse:
    _ = user
    profile = await _get_profile(db, profile_id)
    return _serialize_profile(profile)


@router.put("/shops/{profile_id}/profile", response_model=DashboardShopProfileResponse)
async def update_dashboard_shop_profile(
    request: Request,
    profile_id: UUID,
    payload: DashboardShopProfileUpdatePayload,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DashboardShopProfileResponse:
    _ = user
    profile = await _get_profile(db, profile_id)

    current_updated_at = ensure_aware_datetime(profile.updated_at)
    incoming_updated_at = ensure_aware_datetime(payload.updated_at)
    if incoming_updated_at != current_updated_at:
        current = _serialize_profile(profile)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"current": current.model_dump()},
        )

    before_state = _serialize_profile(profile).model_dump()

    if payload.name is not None:
        normalized = payload.name.strip()
        if normalized:
            profile.name = normalized

    if payload.area is not None:
        normalized = payload.area.strip()
        if normalized:
            profile.area = normalized

    if payload.price_min is not None:
        profile.price_min = max(0, int(payload.price_min))

    if payload.price_max is not None:
        profile.price_max = max(0, int(payload.price_max))

    if payload.service_type is not None:
        profile.service_type = (
            payload.service_type
            if payload.service_type in {"store", "dispatch"}
            else "store"
        )

    if payload.slug is not None:
        candidate = slugify(payload.slug) if payload.slug else None
        if candidate:
            conflict = await db.execute(
                select(models.Profile.id).where(
                    models.Profile.slug == candidate, models.Profile.id != profile.id
                )
            )
            if conflict.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="slug_already_exists",
                )
            profile.slug = candidate
        else:
            profile.slug = None

    if payload.status is not None:
        status_value = payload.status.strip() if isinstance(payload.status, str) else ""
        status_value = status_value.lower()
        if status_value not in ALLOWED_PROFILE_STATUSES:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"field": "status", "message": "ステータスの指定が不正です。"},
            )
        profile.status = status_value

    contact_json = dict(profile.contact_json or {})

    if payload.contact is not None:
        _update_contact_json(contact_json, payload.contact)

    if payload.description is not None:
        if payload.description:
            contact_json["description"] = payload.description
        else:
            contact_json.pop("description", None)

    if payload.catch_copy is not None:
        if payload.catch_copy:
            contact_json["catch_copy"] = payload.catch_copy
        else:
            contact_json.pop("catch_copy", None)

    if payload.address is not None:
        if payload.address:
            contact_json["address"] = payload.address
        else:
            contact_json.pop("address", None)

    if payload.photos is not None:
        profile.photos = [photo for photo in payload.photos if photo]

    if payload.menus is not None:
        contact_json["menus"] = _menus_to_contact_json(payload.menus)

    if payload.staff is not None:
        contact_json["staff"] = _staff_to_contact_json(payload.staff)

    if payload.service_tags is not None:
        tags = [tag.strip() for tag in payload.service_tags if tag.strip()]
        contact_json["service_tags"] = tags
        profile.body_tags = tags

    if not contact_json.get("store_name"):
        contact_json["store_name"] = profile.name

    profile.contact_json = contact_json

    await db.commit()
    await db.refresh(profile)
    await _reindex_profile(db, profile)

    response = _serialize_profile(profile)
    await _record_change(
        request, db, profile.id, "update", before_state, response.model_dump()
    )
    return response
