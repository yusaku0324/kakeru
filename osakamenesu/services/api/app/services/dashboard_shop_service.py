from __future__ import annotations

import hashlib
import uuid
from datetime import datetime
from http import HTTPStatus
from typing import Any, Dict, List, Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..meili import index_profile
from ..schemas import (
    DashboardShopContact,
    DashboardShopListResponse,
    DashboardShopMenu,
    DashboardShopProfileCreatePayload,
    DashboardShopProfileResponse,
    DashboardShopProfileUpdatePayload,
    DashboardShopStaff,
    DashboardShopSummaryItem,
)
from ..utils.datetime import ensure_aware_datetime
from ..utils.profiles import build_profile_doc
from ..utils.slug import slugify
from ..utils.text import normalize_contact_value, sanitize_strings, strip_or_none
from .dashboard_shop_helpers import (
    extract_contact,
    extract_menus,
    extract_staff,
    menus_to_contact_json,
    sanitize_photos,
    sanitize_service_tags,
    staff_to_contact_json,
    update_contact_json,
    update_optional_field,
)

JST = ZoneInfo("Asia/Tokyo")

DEFAULT_BUST_TAG = "UNSPECIFIED"
ALLOWED_PROFILE_STATUSES = {"draft", "published", "hidden"}


class DashboardShopError(Exception):
    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class DashboardShopService:
    """Encapsulates dashboard shop profile operations."""

    def __init__(self, *, indexer=index_profile) -> None:
        self._indexer = indexer

    async def list_shops(
        self, *, limit: int, db: AsyncSession, user: models.User
    ) -> DashboardShopListResponse:
        limit_value = max(1, min(limit, 100))
        # Filter by shops the user manages
        managed_shop_ids_stmt = select(models.ShopManager.shop_id).where(
            models.ShopManager.user_id == user.id
        )
        stmt = (
            select(models.Profile)
            .where(models.Profile.id.in_(managed_shop_ids_stmt))
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

    async def create_profile(
        self,
        *,
        request: Any,
        payload: DashboardShopProfileCreatePayload,
        db: AsyncSession,
        user: models.User,
        reindex=None,
        recorder=None,
    ) -> DashboardShopProfileResponse:
        name = strip_or_none(payload.name)
        if not name:
            raise DashboardShopError(
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"field": "name", "message": "店舗名を入力してください。"},
            )
        area = strip_or_none(payload.area)
        if not area:
            raise DashboardShopError(
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"field": "area", "message": "エリアを入力してください。"},
            )

        try:
            price_min = max(0, int(payload.price_min))
            price_max = max(0, int(payload.price_max))
        except Exception as exc:
            raise DashboardShopError(
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"field": "price", "message": "料金は数値で入力してください。"},
            ) from exc

        if price_max < price_min:
            raise DashboardShopError(
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {
                    "field": "price_max",
                    "message": "料金の上限は下限以上に設定してください。",
                },
            )

        service_type = strip_or_none(payload.service_type) or "store"
        if service_type not in {"store", "dispatch"}:
            service_type = "store"

        service_tags = sanitize_service_tags(payload.service_tags)
        photos = sanitize_photos(payload.photos)
        contact_json: Dict[str, Any] = {}
        if payload.contact:
            contact_json.update(payload.contact.model_dump(exclude_none=True))

        if payload.description:
            contact_json["description"] = payload.description
        if payload.catch_copy:
            contact_json["catch_copy"] = payload.catch_copy
        if payload.address:
            contact_json["address"] = payload.address

        # menus and staff are not part of CreatePayload - use empty lists for initial creation
        contact_json["menus"] = []
        contact_json["staff"] = []
        contact_json["service_tags"] = service_tags
        contact_json.setdefault("store_name", name)

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

        # Auto-create ShopManager record for the user as owner
        shop_manager = models.ShopManager(
            shop_id=profile.id,
            user_id=user.id,
            role="owner",
        )
        db.add(shop_manager)

        await db.commit()
        await db.refresh(profile)

        reindex_fn = reindex or self._reindex_profile
        await reindex_fn(db, profile)
        response = self.serialize_profile(profile, availability_calendar=None)
        record_fn = recorder or self._record_change
        await record_fn(
            request,
            db,
            target_id=profile.id,
            action="create",
            before=None,
            after=response.model_dump(),
        )
        return response

    async def get_profile_response(
        self,
        *,
        profile_id: UUID,
        db: AsyncSession,
    ) -> DashboardShopProfileResponse:
        from ..domains.site.services.shop.availability import fetch_availability
        from datetime import date, timedelta

        profile = await self.get_profile(db=db, profile_id=profile_id)

        # Fetch availability calendar for the next 7 days
        today = date.today()
        end_date = today + timedelta(days=7)
        availability_calendar = await fetch_availability(
            db=db, shop_id=profile_id, start_date=today, end_date=end_date
        )

        return self.serialize_profile(
            profile, availability_calendar=availability_calendar
        )

    async def update_profile(
        self,
        *,
        request: Any,
        profile_id: UUID,
        payload: DashboardShopProfileUpdatePayload,
        db: AsyncSession,
        user: models.User,
        reindex=None,
        recorder=None,
    ) -> DashboardShopProfileResponse:
        profile = await self.get_profile(db=db, profile_id=profile_id)

        current_updated_at = ensure_aware_datetime(profile.updated_at)
        incoming_updated_at = ensure_aware_datetime(payload.updated_at)
        if incoming_updated_at != current_updated_at:
            current = self.serialize_profile(profile, availability_calendar=None)
            raise DashboardShopError(
                HTTPStatus.CONFLICT,
                {"current": current.model_dump(mode="json")},
            )

        before_state = self.serialize_profile(
            profile, availability_calendar=None
        ).model_dump()

        if payload.name is not None:
            normalized = strip_or_none(payload.name)
            if normalized:
                profile.name = normalized

        if payload.area is not None:
            normalized = strip_or_none(payload.area)
            if normalized:
                profile.area = normalized

        if payload.price_min is not None:
            profile.price_min = max(0, int(payload.price_min))

        if payload.price_max is not None:
            profile.price_max = max(0, int(payload.price_max))

        if payload.service_type is not None:
            service_type = strip_or_none(payload.service_type) or "store"
            if service_type not in {"store", "dispatch"}:
                service_type = "store"
            profile.service_type = service_type

        if payload.slug is not None:
            candidate = slugify(payload.slug) if payload.slug else None
            if candidate:
                conflict = await db.execute(
                    select(models.Profile.id).where(
                        models.Profile.slug == candidate,
                        models.Profile.id != profile.id,
                    )
                )
                if conflict.scalar_one_or_none():
                    raise DashboardShopError(
                        HTTPStatus.BAD_REQUEST,
                        "slug_already_exists",
                    )
                profile.slug = candidate
            else:
                profile.slug = None

        if payload.status is not None:
            status_value = strip_or_none(payload.status)
            if not status_value or status_value.lower() not in ALLOWED_PROFILE_STATUSES:
                raise DashboardShopError(
                    HTTPStatus.UNPROCESSABLE_ENTITY,
                    {"field": "status", "message": "ステータスの指定が不正です。"},
                )
            profile.status = status_value.lower()

        if payload.default_slot_duration_minutes is not None:
            # Validate slot duration (must be positive, typically 60, 90, 120 minutes)
            duration = payload.default_slot_duration_minutes
            if duration < 30 or duration > 240:
                raise DashboardShopError(
                    HTTPStatus.BAD_REQUEST,
                    {
                        "field": "default_slot_duration_minutes",
                        "message": "スロット時間は30分から240分の間で設定してください。",
                    },
                )
            profile.default_slot_duration_minutes = duration

        contact_json = dict(profile.contact_json or {})
        if payload.contact is not None:
            update_contact_json(contact_json, payload.contact)

        if payload.description is not None:
            self._update_optional_field(
                contact_json, "description", payload.description
            )

        if payload.catch_copy is not None:
            self._update_optional_field(contact_json, "catch_copy", payload.catch_copy)

        if payload.address is not None:
            self._update_optional_field(contact_json, "address", payload.address)

        if payload.photos is not None:
            profile.photos = [photo for photo in payload.photos if photo]

        if payload.menus is not None:
            contact_json["menus"] = menus_to_contact_json(payload.menus)

        if payload.staff is not None:
            contact_json["staff"] = staff_to_contact_json(payload.staff)

        if payload.service_tags is not None:
            tags = [tag.strip() for tag in payload.service_tags if tag.strip()]
            contact_json["service_tags"] = tags
            profile.body_tags = tags

        contact_json.setdefault("store_name", profile.name)
        profile.contact_json = contact_json

        await db.commit()
        await db.refresh(profile)
        reindex_fn = reindex or self._reindex_profile
        await reindex_fn(db, profile)

        response = self.serialize_profile(profile, availability_calendar=None)
        record_fn = recorder or self._record_change
        await record_fn(
            request,
            db,
            target_id=profile.id,
            action="update",
            before=before_state,
            after=response.model_dump(),
        )
        return response

    async def get_profile(
        self, *, db: AsyncSession, profile_id: UUID
    ) -> models.Profile:
        profile = await db.get(models.Profile, profile_id)
        if not profile:
            raise DashboardShopError(HTTPStatus.NOT_FOUND, "profile_not_found")
        return profile

    def extract_contact(
        self, contact_json: Dict[str, Any] | None
    ) -> Optional[DashboardShopContact]:
        if not isinstance(contact_json, dict):
            return None
        phone = normalize_contact_value(
            contact_json.get("phone") or contact_json.get("tel"), allow_numeric=True
        )
        line_id = normalize_contact_value(
            contact_json.get("line_id") or contact_json.get("line")
        )
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

    def extract_menus(self, raw: Any) -> List[DashboardShopMenu]:
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
                tags = [
                    tag for tag in sanitize_strings([str(item) for item in raw_tags])
                ]
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

    def extract_staff(self, raw: Any) -> List[DashboardShopStaff]:
        if not isinstance(raw, list):
            return []
        members: List[DashboardShopStaff] = []
        for entry in raw:
            if not isinstance(entry, dict):
                continue
            name = strip_or_none(entry.get("name"))
            if not name:
                continue
            specialties: List[str] = []
            raw_specialties = entry.get("specialties") or []
            if isinstance(raw_specialties, list):
                specialties = [
                    cleaned
                    for cleaned in (
                        strip_or_none(str(item)) for item in raw_specialties
                    )
                    if cleaned
                ]
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

    def serialize_profile(
        self, profile: models.Profile, availability_calendar=None
    ) -> DashboardShopProfileResponse:
        contact_json = profile.contact_json or {}
        contact = extract_contact(contact_json)
        menus = extract_menus(contact_json.get("menus"))
        staff = extract_staff(contact_json.get("staff"))
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
            availability_calendar=availability_calendar,
            default_slot_duration_minutes=profile.default_slot_duration_minutes,
        )

    async def reindex_profile(self, db: AsyncSession, profile: models.Profile) -> None:
        await self._reindex_profile(db, profile)

    async def record_change(
        self,
        request: Request,
        db: AsyncSession,
        *,
        target_id: UUID | None,
        action: str,
        before: Any,
        after: Any,
    ) -> None:
        await self._record_change(request, db, target_id, action, before, after)

    # Internal helpers -------------------------------------------------

    async def _reindex_profile(self, db: AsyncSession, profile: models.Profile) -> None:
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
            profile,
            today=has_today,
            tag_score=0.0,
            ctr7d=0.0,
            outlinks=outlinks,
        )
        try:
            self._indexer(doc)
        except Exception:
            pass

    async def _record_change(
        self,
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
            pass

    def _update_optional_field(
        self, contact_json: Dict[str, Any], key: str, value: Optional[str]
    ) -> None:
        update_optional_field(contact_json, key, value)


__all__ = [
    "DashboardShopService",
    "DashboardShopError",
    "DEFAULT_BUST_TAG",
    "ALLOWED_PROFILE_STATUSES",
]

# Expose helper utilities for backwards compatibility (tests import via router)
DashboardShopService.extract_contact = staticmethod(extract_contact)
DashboardShopService.extract_menus = staticmethod(extract_menus)
DashboardShopService.extract_staff = staticmethod(extract_staff)
DashboardShopService.update_contact_json = staticmethod(update_contact_json)
DashboardShopService.sanitize_service_tags = staticmethod(sanitize_service_tags)
DashboardShopService.sanitize_photos = staticmethod(sanitize_photos)
DashboardShopService.menus_to_contact_json = staticmethod(menus_to_contact_json)
DashboardShopService.staff_to_contact_json = staticmethod(staff_to_contact_json)
