from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from http import HTTPStatus
from typing import Any, List, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models
from ....meili import index_bulk, purge_all
from ....schemas import (
    AvailabilityCalendar,
    AvailabilityCreate,
    AvailabilityOut,
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
    ProfileDetail,
    ProfileMarketingUpdate,
    ShopContentUpdate,
    ShopAdminDetail,
    ShopAdminList,
    ShopAdminSummary,
    StaffSummary,
)
from ....utils.datetime import (
    JST,
    ensure_jst_datetime,
    now_jst,
)
from ....utils.profiles import (
    infer_height_age,
    infer_store_name,
    normalize_review_aspects,
)
from ....utils.slug import slugify
from .audit import AdminAuditContext, record_change
from .errors import AdminServiceError
from . import site_bridge
from .profile_availability import (
    ProfileServiceError,
    create_availability_bulk as _create_availability_bulk,
    create_single_availability as _create_single_availability,
    get_availability_calendar as _get_availability_calendar,
    slots_to_json,
    upsert_availability as _upsert_availability,
    upsert_bulk_availability,
)
from .profile_indexing import build_profile_document, reindex_profile_contact

logger = logging.getLogger("app.admin.profile_service")


async def reindex_profile(*, db: AsyncSession, profile_id: UUID) -> None:
    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise ProfileServiceError(HTTPStatus.NOT_FOUND, detail="profile not found")
    await db.refresh(profile, attribute_names=["reviews"])
    try:
        await _reindex_profile_contact(db=db, profile=profile)
    except Exception as exc:  # pragma: no cover - meili failure path
        raise ProfileServiceError(
            HTTPStatus.SERVICE_UNAVAILABLE, detail=f"meili_unavailable: {exc}"
        ) from exc


async def reindex_all_profiles(*, db: AsyncSession, purge: bool = False) -> int:
    from .. import router as admin_router  # local import to avoid circular deps

    purge_callable = getattr(admin_router, "purge_all", purge_all)
    if purge:
        try:
            purge_callable()
        except Exception as exc:  # pragma: no cover
            raise ProfileServiceError(
                HTTPStatus.SERVICE_UNAVAILABLE, detail=f"meili_unavailable: {exc}"
            ) from exc

    result = await db.execute(
        select(models.Profile).where(models.Profile.status == "published")
    )
    profiles = list(result.scalars().all())
    docs = []
    for profile in profiles:
        await db.refresh(profile, attribute_names=["reviews"])
        docs.append(await _build_profile_document(db=db, profile=profile))

    if not docs:
        return 0

    index_callable = getattr(admin_router, "index_bulk", index_bulk)
    try:
        index_callable(docs)
    except Exception as exc:  # pragma: no cover
        raise ProfileServiceError(
            HTTPStatus.SERVICE_UNAVAILABLE, detail=f"meili_unavailable: {exc}"
        ) from exc
    return len(docs)


async def create_single_availability(
    *,
    db: AsyncSession,
    profile_id: UUID,
    date_value: date,
    slots_json: Optional[dict[str, Any]] = None,
) -> str:
    return await _create_single_availability(
        db=db,
        profile_id=profile_id,
        date_value=date_value,
        slots_json=slots_json,
        reindex=_reindex_profile_contact,
    )


async def create_availability_bulk(
    *, db: AsyncSession, payload: List[AvailabilityCreate]
) -> List[str]:
    return await _create_availability_bulk(db=db, payload=payload)


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
        raise ProfileServiceError(HTTPStatus.NOT_FOUND, detail="profile not found")
    outlink = models.Outlink(
        profile_id=profile.id, kind=kind, token=token, target_url=target_url
    )
    db.add(outlink)
    await db.commit()
    return str(outlink.id)


async def update_marketing_metadata(
    *, db: AsyncSession, profile_id: UUID, payload: ProfileMarketingUpdate
) -> None:
    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise ProfileServiceError(HTTPStatus.NOT_FOUND, detail="profile not found")

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
        raise ProfileServiceError(HTTPStatus.NOT_FOUND, detail="shop not found")

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
    audit_context: AdminAuditContext | None,
    db: AsyncSession,
    shop_id: UUID,
    payload: ShopContentUpdate,
) -> ShopAdminDetail:
    profile = await db.get(models.Profile, shop_id)
    if not profile:
        raise ProfileServiceError(HTTPStatus.NOT_FOUND, detail="shop not found")

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
        profile.service_type = (
            payload.service_type
            if payload.service_type in {"store", "dispatch"}
            else "store"
        )

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
            raise ProfileServiceError(
                HTTPStatus.BAD_REQUEST, detail="slug already exists"
            )
        profile.slug = normalized or None

    profile.contact_json = contact_json

    await db.commit()
    await db.refresh(profile)
    await _reindex_profile_contact(db=db, profile=profile)

    detail = await get_shop_detail(db=db, shop_id=profile.id)
    await record_change(
        db,
        context=audit_context,
        target_type="shop",
        target_id=profile.id,
        action="content_update",
        before=before_detail.model_dump(),
        after=detail.model_dump(),
    )
    return detail


async def bulk_ingest_shop_content(
    *,
    audit_context: AdminAuditContext | None,
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
            contact_json["menus"] = [
                site_bridge.serialize_bulk_menu(menu, profile.id)
                for menu in entry.menus
            ]
            summary.menus_updated = True

        profile.contact_json = contact_json

        if entry.reviews:
            await _upsert_reviews(
                db=db, profile=profile, reviews=entry.reviews, summary=summary
            )

        if entry.diaries:
            await _upsert_diaries(
                db=db, profile=profile, diaries=entry.diaries, summary=summary
            )

        if entry.availability:
            await upsert_bulk_availability(
                db=db, profile=profile, availability=entry.availability, summary=summary
            )

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
            db,
            context=audit_context,
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
    audit_context: AdminAuditContext | None,
    db: AsyncSession,
    shop_id: UUID,
    payload: AvailabilityUpsert,
) -> str:
    return await _upsert_availability(
        audit_context=audit_context,
        db=db,
        shop_id=shop_id,
        payload=payload,
        record_change=record_change,
    )


async def get_availability_calendar(
    *,
    db: AsyncSession,
    shop_id: UUID,
    start_date: date | None = None,
    end_date: date | None = None,
) -> AvailabilityCalendar | None:
    return await _get_availability_calendar(
        db=db, shop_id=shop_id, start_date=start_date, end_date=end_date
    )


async def resolve_profile_by_identifier(
    *, db: AsyncSession, identifier: str
) -> models.Profile | None:
    try:
        profile_uuid = UUID(identifier)
    except (ValueError, TypeError):
        profile_uuid = None

    if profile_uuid:
        profile = await db.get(models.Profile, profile_uuid)
        if profile:
            return profile

    result = await db.execute(
        select(models.Profile).where(models.Profile.slug == identifier)
    )
    profile = result.scalar_one_or_none()
    if profile:
        return profile

    if not identifier:
        return None

    result = await db.execute(
        select(models.Profile).where(models.Profile.name == identifier)
    )
    return result.scalar_one_or_none()


async def get_profile_detail(*, db: AsyncSession, identifier: str) -> ProfileDetail:
    profile = await resolve_profile_by_identifier(db=db, identifier=identifier)
    if not profile:
        raise ProfileServiceError(HTTPStatus.NOT_FOUND, detail="profile not found")

    today = now_jst().date()
    today_availability = await db.execute(
        select(models.Availability)
        .where(
            models.Availability.profile_id == profile.id,
            models.Availability.date == today,
        )
        .limit(1)
    )
    availability = today_availability.scalar_one_or_none()
    availability_out: AvailabilityOut | None = None
    has_today = False
    if availability:
        has_today = True
        availability_out = AvailabilityOut(
            date=availability.date.isoformat(),
            is_today=True,
            slots_json=availability.slots_json or None,
        )

    outlinks_result = await db.execute(
        select(models.Outlink).where(models.Outlink.profile_id == profile.id)
    )
    outlinks = list(outlinks_result.scalars().all())
    height_cm, age = infer_height_age(profile)
    store_name = infer_store_name(profile, outlinks)

    detail = ProfileDetail(
        id=str(profile.id),
        slug=profile.slug,
        name=profile.name,
        area=profile.area,
        price_min=profile.price_min,
        price_max=profile.price_max,
        bust_tag=profile.bust_tag,
        service_type=profile.service_type,
        body_tags=profile.body_tags or [],
        height_cm=height_cm,
        age=age,
        photos=profile.photos or [],
        discounts=profile.discounts or [],
        ranking_badges=profile.ranking_badges or [],
        ranking_weight=profile.ranking_weight,
        status=profile.status,
        store_name=store_name,
        today=has_today,
        availability_today=availability_out,
        outlinks=[{"kind": o.kind, "token": o.token} for o in outlinks],
    )
    return detail


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


# Backwards compatibility aliases for tests and routers
_reindex_profile_contact = reindex_profile_contact
_build_profile_document = build_profile_document
_slots_to_json = slots_to_json
_upsert_bulk_availability = upsert_bulk_availability
