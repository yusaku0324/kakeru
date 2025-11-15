from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any, List, Optional
from uuid import UUID

from fastapi import HTTPException, Request
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from zoneinfo import ZoneInfo

from .... import models
from ....meili import index_bulk, index_profile, purge_all
from ....schemas import (
    AvailabilityCalendar,
    AvailabilityCreate,
    AvailabilitySlotIn,
    AvailabilityUpsert,
    BulkAvailabilityInput,
    BulkDiaryInput,
    BulkMenuInput,
    BulkReviewInput,
    BulkShopContentRequest,
    BulkShopContentResponse,
    BulkShopIngestResult,
    MenuItem,
    ProfileMarketingUpdate,
    ShopContentUpdate,
    ShopAdminDetail,
    ShopAdminList,
    ShopAdminSummary,
    StaffSummary,
)
from ....utils.profiles import build_profile_doc, normalize_review_aspects
from ....utils.slug import slugify
from .audit import record_change
from . import site_bridge

logger = logging.getLogger("app.admin.profile_service")
JST = ZoneInfo("Asia/Tokyo")


async def reindex_profile(*, db: AsyncSession, profile_id: UUID) -> None:
    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="profile not found")
    await db.refresh(profile, attribute_names=["reviews"])
    doc = await _build_profile_document(db=db, profile=profile)
    try:
        index_profile(doc)
    except Exception as exc:  # pragma: no cover - meili failure path
        raise HTTPException(status_code=503, detail=f"meili_unavailable: {exc}") from exc


async def reindex_all_profiles(*, db: AsyncSession, purge: bool = False) -> int:
    if purge:
        try:
            purge_all()
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=503, detail=f"meili_unavailable: {exc}") from exc

    result = await db.execute(select(models.Profile).where(models.Profile.status == "published"))
    profiles = list(result.scalars().all())
    docs = []
    for profile in profiles:
        await db.refresh(profile, attribute_names=["reviews"])
        docs.append(await _build_profile_document(db=db, profile=profile))

    if not docs:
        return 0

    try:
        index_bulk(docs)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=503, detail=f"meili_unavailable: {exc}") from exc
    return len(docs)


async def create_single_availability(
    *,
    db: AsyncSession,
    profile_id: UUID,
    date_value: date,
    slots_json: Optional[dict[str, Any]] = None,
) -> str:
    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="profile not found")

    availability = models.Availability(
        profile_id=profile.id,
        date=date_value,
        slots_json=slots_json or {},
        is_today=date_value == datetime.now(JST).date(),
    )
    db.add(availability)
    await db.commit()
    await _reindex_profile_contact(db=db, profile=profile)
    return str(availability.id)


async def create_availability_bulk(
    *, db: AsyncSession, payload: List[AvailabilityCreate]
) -> List[str]:
    created: List[str] = []
    today = datetime.now(JST).date()
    for item in payload:
        profile = await db.get(models.Profile, item.profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail=f"profile {item.profile_id} not found")
        slots_json = _slots_to_json(item.slots)
        availability = models.Availability(
            profile_id=profile.id,
            date=item.date,
            slots_json=slots_json,
            is_today=item.date == today,
        )
        db.add(availability)
        created.append(str(availability.id))
    await db.commit()
    return created


async def create_outlink(
    *,
    db: AsyncSession,
    profile_id: UUID,
    kind: str,
    token: str,
    target_url: str,
) -> str:
    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="profile not found")
    outlink = models.Outlink(profile_id=profile.id, kind=kind, token=token, target_url=target_url)
    db.add(outlink)
    await db.commit()
    return str(outlink.id)


async def update_marketing_metadata(
    *, db: AsyncSession, profile_id: UUID, payload: ProfileMarketingUpdate
) -> None:
    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="profile not found")

    if payload.discounts is not None:
        profile.discounts = [d.model_dump(exclude_none=True) for d in payload.discounts]
    if payload.ranking_badges is not None:
        profile.ranking_badges = payload.ranking_badges
    if payload.ranking_weight is not None:
        profile.ranking_weight = payload.ranking_weight

    await db.commit()
    await db.refresh(profile)
    await _reindex_profile_contact(db=db, profile=profile)


async def list_shops(*, db: AsyncSession) -> ShopAdminList:
    result = await db.execute(select(models.Profile))
    profiles = result.scalars().all()
    items = [
        ShopAdminSummary(
            id=p.id,
            name=p.name,
            slug=p.slug,
            area=p.area,
            status=p.status,
            service_type=p.service_type,
        )
        for p in profiles
    ]
    return ShopAdminList(items=items)


async def get_shop_detail(*, db: AsyncSession, shop_id: UUID) -> ShopAdminDetail:
    profile = await db.get(models.Profile, shop_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop not found")

    availability_calendar = await site_bridge.fetch_availability(db, profile.id)
    contact_json = dict(profile.contact_json or {})
    contact = site_bridge.normalize_contact(contact_json)
    menus = site_bridge.normalize_menus(contact_json.get("menus"), profile.id)
    staff = site_bridge.normalize_staff(contact_json.get("staff"), profile.id)
    service_tags = contact_json.get("service_tags") or profile.body_tags or []

    return ShopAdminDetail(
        id=profile.id,
        slug=profile.slug,
        name=profile.name,
        area=profile.area,
        price_min=profile.price_min,
        price_max=profile.price_max,
        service_type=profile.service_type,
        service_tags=[str(tag) for tag in service_tags],
        contact=contact,
        description=contact_json.get("description"),
        catch_copy=contact_json.get("catch_copy"),
        address=contact_json.get("address"),
        photos=profile.photos or [],
        menus=menus,
        staff=staff,
        availability=availability_calendar.days if availability_calendar else [],
    )

async def update_shop_content(
    *,
    request: Request,
    db: AsyncSession,
    shop_id: UUID,
    payload: ShopContentUpdate,
) -> ShopAdminDetail:
    profile = await db.get(models.Profile, shop_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop not found")

    before_detail = await get_shop_detail(db=db, shop_id=shop_id)
    contact_json = dict(profile.contact_json or {})

    if payload.contact is not None:
        contact_json["phone"] = payload.contact.phone
        if payload.contact.phone:
            contact_json["tel"] = payload.contact.phone
        contact_json["line_id"] = payload.contact.line_id
        contact_json["line"] = payload.contact.line_id
        contact_json["website_url"] = payload.contact.website_url
        contact_json["web"] = payload.contact.website_url
        contact_json["reservation_form_url"] = payload.contact.reservation_form_url
        contact_json["sns"] = payload.contact.sns or []

    if payload.description is not None:
        contact_json["description"] = payload.description
    if payload.catch_copy is not None:
        contact_json["catch_copy"] = payload.catch_copy
    if payload.address is not None:
        contact_json["address"] = payload.address

    if payload.photos is not None:
        profile.photos = payload.photos

    if payload.menus is not None:
        contact_json["menus"] = site_bridge.serialize_menu_inputs(payload.menus)

    if payload.staff is not None:
        contact_json["staff"] = site_bridge.serialize_staff_inputs(payload.staff)

    if payload.service_tags is not None:
        contact_json["service_tags"] = payload.service_tags
        profile.body_tags = payload.service_tags

    if payload.service_type is not None:
        profile.service_type = payload.service_type if payload.service_type in {"store", "dispatch"} else "store"

    if payload.slug is not None:
        normalized = slugify(payload.slug)
        conflict = None
        if normalized:
            stmt = select(models.Profile.id).where(
                models.Profile.slug == normalized,
                models.Profile.id != profile.id,
            )
            conflict = (await db.execute(stmt)).scalar_one_or_none()
        if conflict:
            raise HTTPException(status_code=400, detail="slug already exists")
        profile.slug = normalized or None

    profile.contact_json = contact_json

    await db.commit()
    await db.refresh(profile)
    await _reindex_profile_contact(db=db, profile=profile)

    detail = await get_shop_detail(db=db, shop_id=profile.id)
    await record_change(
        request,
        db,
        target_type="shop",
        target_id=profile.id,
        action="content_update",
        before=before_detail.model_dump(),
        after=detail.model_dump(),
    )
    return detail


async def bulk_ingest_shop_content(
    *,
    request: Request,
    db: AsyncSession,
    payload: BulkShopContentRequest,
) -> BulkShopContentResponse:
    processed: List[BulkShopIngestResult] = []
    errors: List[dict[str, Any]] = []

    for entry in payload.shops:
        profile = await db.get(models.Profile, entry.shop_id)
        if not profile:
            errors.append({"shop_id": str(entry.shop_id), "error": "shop_not_found"})
            continue

        summary = BulkShopIngestResult(shop_id=entry.shop_id)
        before_detail = await get_shop_detail(db=db, shop_id=entry.shop_id)
        contact_json = dict(profile.contact_json or {})

        if entry.contact is not None:
            contact_json["phone"] = entry.contact.phone
            if entry.contact.phone:
                contact_json["tel"] = entry.contact.phone
            contact_json["line_id"] = entry.contact.line_id
            contact_json["line"] = entry.contact.line_id
            contact_json["website_url"] = entry.contact.website_url
            contact_json["web"] = entry.contact.website_url
            contact_json["reservation_form_url"] = entry.contact.reservation_form_url
            contact_json["sns"] = entry.contact.sns or []

        if entry.description is not None:
            contact_json["description"] = entry.description
        if entry.catch_copy is not None:
            contact_json["catch_copy"] = entry.catch_copy
        if entry.address is not None:
            contact_json["address"] = entry.address

        if entry.service_tags is not None:
            contact_json["service_tags"] = entry.service_tags
            profile.body_tags = entry.service_tags

        if entry.photos is not None:
            profile.photos = entry.photos
            summary.photos_updated = True

        if entry.menus is not None:
            contact_json["menus"] = [site_bridge.serialize_bulk_menu(menu, profile.id) for menu in entry.menus]
            summary.menus_updated = True

        profile.contact_json = contact_json

        if entry.reviews:
            await _upsert_reviews(db=db, profile=profile, reviews=entry.reviews, summary=summary)

        if entry.diaries:
            await _upsert_diaries(db=db, profile=profile, diaries=entry.diaries, summary=summary)

        if entry.availability:
            await _upsert_bulk_availability(db=db, profile=profile, availability=entry.availability, summary=summary)

        try:
            await db.commit()
        except Exception as exc:  # pragma: no cover
            await db.rollback()
            errors.append({"shop_id": str(entry.shop_id), "error": str(exc)})
            continue

        try:
            await db.refresh(profile, attribute_names=["reviews", "diaries"])
        except Exception:
            await db.refresh(profile)

        await _reindex_profile_contact(db=db, profile=profile)
        after_detail = await get_shop_detail(db=db, shop_id=profile.id)
        await record_change(
            request,
            db,
            target_type="shop",
            target_id=profile.id,
            action="bulk_ingest",
            before=before_detail.model_dump(),
            after=after_detail.model_dump(),
        )

        processed.append(summary)

    return BulkShopContentResponse(processed=processed, errors=errors)


async def upsert_availability(
    *,
    request: Request,
    db: AsyncSession,
    shop_id: UUID,
    payload: AvailabilityUpsert,
) -> str:
    profile = await db.get(models.Profile, shop_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop not found")

    slots_json = _slots_to_json(payload.slots)
    stmt = (
        select(models.Availability)
        .where(models.Availability.profile_id == shop_id)
        .where(models.Availability.date == payload.date)
    )
    avail = (await db.execute(stmt)).scalar_one_or_none()
    before_slots = avail.slots_json if avail else None
    if avail:
        avail.slots_json = slots_json
        avail.is_today = payload.date == datetime.now(JST).date()
    else:
        avail = models.Availability(
            profile_id=shop_id,
            date=payload.date,
            slots_json=slots_json,
            is_today=payload.date == datetime.now(JST).date(),
        )
        db.add(avail)

    await db.commit()

    await record_change(
        request,
        db,
        target_type="availability",
        target_id=avail.id,
        action="upsert",
        before=before_slots,
        after=slots_json,
    )

    return str(avail.id)


async def get_availability_calendar(
    *, db: AsyncSession, shop_id: UUID, start_date: date | None = None, end_date: date | None = None
) -> AvailabilityCalendar | None:
    return await site_bridge.fetch_availability(db, shop_id, start_date=start_date, end_date=end_date)


async def resolve_profile_by_identifier(*, db: AsyncSession, identifier: str) -> models.Profile | None:
    try:
        profile_uuid = UUID(identifier)
    except (ValueError, TypeError):
        profile_uuid = None

    if profile_uuid:
        profile = await db.get(models.Profile, profile_uuid)
        if profile:
            return profile

    result = await db.execute(select(models.Profile).where(models.Profile.slug == identifier))
    return result.scalar_one_or_none()


async def _reindex_profile_contact(*, db: AsyncSession, profile: models.Profile) -> None:
    doc = await _build_profile_document(db=db, profile=profile)
    try:
        index_profile(doc)
    except Exception:  # pragma: no cover
        logger.exception("Failed to reindex profile %s", profile.id)


async def _build_profile_document(*, db: AsyncSession, profile: models.Profile) -> dict[str, Any]:
    today = datetime.now(JST).date()
    res_today = await db.execute(
        select(func.count())
        .select_from(models.Availability)
        .where(models.Availability.profile_id == profile.id, models.Availability.date == today)
    )
    has_today = (res_today.scalar_one() or 0) > 0
    res_out = await db.execute(select(models.Outlink).where(models.Outlink.profile_id == profile.id))
    outlinks = list(res_out.scalars().all())
    return build_profile_doc(
        profile,
        today=has_today,
        tag_score=0.0,
        ctr7d=0.0,
        outlinks=outlinks,
    )

def _slots_to_json(slots: List[AvailabilitySlotIn] | None) -> dict | None:
    if not slots:
        return None
    return {
        "slots": [
            {
                "start_at": slot.start_at.isoformat(),
                "end_at": slot.end_at.isoformat(),
                "status": slot.status,
                "staff_id": str(slot.staff_id) if slot.staff_id else None,
                "menu_id": str(slot.menu_id) if slot.menu_id else None,
            }
            for slot in slots
        ]
    }


async def _upsert_reviews(
    *,
    db: AsyncSession,
    profile: models.Profile,
    reviews: List[BulkReviewInput],
    summary: BulkShopIngestResult,
) -> None:
    for review in reviews:
        existing_review = None
        if review.external_id:
            stmt = select(models.Review).where(
                models.Review.profile_id == profile.id,
                models.Review.external_id == review.external_id,
            )
            existing_review = (await db.execute(stmt)).scalar_one_or_none()

        if existing_review:
            target_review = existing_review
            summary.reviews_updated += 1
        else:
            target_review = models.Review(profile_id=profile.id)
            summary.reviews_created += 1
            db.add(target_review)

        target_review.external_id = review.external_id
        target_review.score = review.score
        target_review.title = review.title
        target_review.body = review.body
        target_review.author_alias = review.author_alias
        target_review.visited_at = review.visited_at
        target_review.status = review.status
        target_review.aspect_scores = normalize_review_aspects(review.aspects or {})


async def _upsert_diaries(
    *,
    db: AsyncSession,
    profile: models.Profile,
    diaries: List[BulkDiaryInput],
    summary: BulkShopIngestResult,
) -> None:
    for diary in diaries:
        existing_diary = None
        if diary.external_id:
            stmt = select(models.Diary).where(
                models.Diary.profile_id == profile.id,
                models.Diary.external_id == diary.external_id,
            )
            existing_diary = (await db.execute(stmt)).scalar_one_or_none()

        if existing_diary:
            target_diary = existing_diary
            summary.diaries_updated += 1
        else:
            target_diary = models.Diary(profile_id=profile.id)
            summary.diaries_created += 1
            db.add(target_diary)

        target_diary.external_id = diary.external_id
        target_diary.title = diary.title
        target_diary.text = diary.body
        target_diary.photos = diary.photos or []
        target_diary.hashtags = diary.hashtags or []
        target_diary.status = diary.status
        if diary.created_at:
            created_at = diary.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            target_diary.created_at = created_at


async def _upsert_bulk_availability(
    *,
    db: AsyncSession,
    profile: models.Profile,
    availability: List[BulkAvailabilityInput],
    summary: BulkShopIngestResult,
) -> None:
    for entry in availability:
        slots_json = _slots_to_json(entry.slots)
        stmt = select(models.Availability).where(
            models.Availability.profile_id == profile.id,
            models.Availability.date == entry.date,
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            existing.slots_json = slots_json
            existing.is_today = entry.date == datetime.now(JST).date()
        else:
            db.add(
                models.Availability(
                    profile_id=profile.id,
                    date=entry.date,
                    slots_json=slots_json,
                    is_today=entry.date == datetime.now(JST).date(),
                )
            )
        summary.availability_upserts += 1
