import inspect

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
import uuid
import hashlib
from ..db import get_session
from .. import models
from ..meili import index_profile, index_bulk, purge_all
from ..utils.profiles import build_profile_doc, normalize_review_aspects
from ..schemas import (
    ProfileMarketingUpdate,
    ReservationAdminSummary,
    ReservationAdminList,
    ReservationAdminUpdate,
    AvailabilityCreate,
    AvailabilityUpsert,
    AvailabilitySlotIn,
    AvailabilityCalendar,
    ShopContentUpdate,
    ShopAdminSummary,
    ShopAdminList,
    ShopAdminDetail,
    MenuItem,
    StaffSummary,
    ReviewListResponse,
    ReviewItem,
    ReviewModerationRequest,
    BulkShopContentRequest,
    BulkShopContentResponse,
    BulkShopIngestResult,
    BulkMenuInput,
    BulkReviewInput,
    BulkDiaryInput,
    BulkAvailabilityInput,
)
from zoneinfo import ZoneInfo
from datetime import datetime, timezone, date
from typing import Optional, Any, List
import uuid
from ..deps import require_admin, audit_admin
from .shops import _fetch_availability, _normalize_menus, _normalize_staff, serialize_review
from ..utils.slug import slugify

router = APIRouter(dependencies=[Depends(require_admin), Depends(audit_admin)])
JST = ZoneInfo("Asia/Tokyo")

def _build_doc(
    p: models.Profile,
    has_today: bool,
    outlinks: list[models.Outlink],
) -> dict[str, Any]:
    return build_profile_doc(
        p,
        today=has_today,
        tag_score=0.0,
        ctr7d=0.0,
        outlinks=outlinks,
    )


async def _record_change(
    request: Request,
    db: AsyncSession,
    target_type: str,
    target_id: UUID | None,
    action: str,
    before: Any,
    after: Any,
) -> None:
    try:
        ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")
        ip_hash = hashlib.sha256(ip.encode("utf-8")).hexdigest() if ip else None
        key = request.headers.get("x-admin-key")
        key_hash = hashlib.sha256(key.encode("utf-8")).hexdigest() if key else None
        log = models.AdminChangeLog(
            target_type=target_type,
            target_id=target_id,
            action=action,
            before_json=jsonable_encoder(before) if before is not None else None,
            after_json=jsonable_encoder(after) if after is not None else None,
            admin_key_hash=key_hash,
            ip_hash=ip_hash,
        )
        db.add(log)
        await db.commit()
    except Exception:
        # Never block on audit logging
        pass


@router.post("/api/admin/profiles/{profile_id}/reindex", summary="Reindex single profile")
async def reindex_one(profile_id: str, db: AsyncSession = Depends(get_session)):
    # cast UUID in db-agnostic way is tricky; for Postgres UUID, string compare works with ::uuid
    res = await db.execute(select(models.Profile).where(models.Profile.id == profile_id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "profile not found")
    await db.refresh(p, attribute_names=["reviews"])
    today = datetime.now(JST).date()
    res = await db.execute(
        select(func.count())
        .select_from(models.Availability)
        .where(models.Availability.profile_id == p.id, models.Availability.date == today)
    )
    has_today = (res.scalar_one() or 0) > 0
    res3 = await db.execute(
        select(models.Outlink).where(models.Outlink.profile_id == p.id)
    )
    outlinks = list(res3.scalars().all())
    try:
        index_profile(_build_doc(p, has_today, outlinks))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"meili_unavailable: {e}")
    return {"ok": True}


@router.post("/api/admin/reindex", summary="Reindex all published profiles")
async def reindex_all(purge: bool = False, db: AsyncSession = Depends(get_session)):
    if purge:
        try:
            purge_all()
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"meili_unavailable: {e}")
    res = await db.execute(select(models.Profile).where(models.Profile.status == 'published'))
    profiles = res.scalars().all()
    today = datetime.now(JST).date()
    docs = []
    for p in profiles:
        await db.refresh(p, attribute_names=["reviews"])
        res2 = await db.execute(
            select(func.count())
            .select_from(models.Availability)
            .where(models.Availability.profile_id == p.id, models.Availability.date == today)
        )
        has_today = (res2.scalar_one() or 0) > 0
        res3 = await db.execute(
            select(models.Outlink).where(models.Outlink.profile_id == p.id)
        )
        outlinks = list(res3.scalars().all())
        docs.append(_build_doc(p, has_today, outlinks))
    try:
        index_bulk(docs)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"meili_unavailable: {e}")
    return {"indexed": len(docs), "purged": purge}


@router.post("/api/admin/availabilities", summary="Create availability (seed)")
async def create_availability(profile_id: str, date: str, slots_json: Optional[dict] = None, db: AsyncSession = Depends(get_session)):
    res = await db.execute(select(models.Profile.id).where(models.Profile.id == profile_id))
    pid = res.scalar_one_or_none()
    if not pid:
        raise HTTPException(404, "profile not found")
    dt = datetime.strptime(date, "%Y-%m-%d").date()
    avail = models.Availability(profile_id=pid, date=dt, slots_json=slots_json or {}, is_today=False)
    db.add(avail)
    await db.commit()
    # reindex profile (today flag might change if date == today)
    res_p = await db.execute(select(models.Profile).where(models.Profile.id == pid))
    p = res_p.scalar_one()
    today = datetime.now(JST).date()
    res2 = await db.execute(
        select(func.count())
        .select_from(models.Availability)
        .where(models.Availability.profile_id == p.id, models.Availability.date == today)
    )
    has_today = (res2.scalar_one() or 0) > 0
    res3 = await db.execute(select(models.Outlink).where(models.Outlink.profile_id == p.id))
    outlinks = list(res3.scalars().all())
    try:
        index_profile(
            build_profile_doc(
                p,
                today=has_today,
                tag_score=0.0,
                ctr7d=0.0,
                outlinks=outlinks,
            )
        )
    except Exception:
        pass
    return {"id": str(avail.id)}


@router.post("/api/admin/availabilities/bulk", summary="Create availabilities from JSON")
async def create_availability_bulk(payload: list[AvailabilityCreate], db: AsyncSession = Depends(get_session)):
    created: list[str] = []
    today = datetime.now(JST).date()
    for item in payload:
        res = await db.execute(select(models.Profile.id).where(models.Profile.id == item.profile_id))
        pid = res.scalar_one_or_none()
        if not pid:
            raise HTTPException(404, f"profile {item.profile_id} not found")
        slots_json = None
        if item.slots:
            slots_json = {
                "slots": [
                    {
                        "start_at": slot.start_at.isoformat(),
                        "end_at": slot.end_at.isoformat(),
                        "status": slot.status,
                        "staff_id": str(slot.staff_id) if slot.staff_id else None,
                        "menu_id": str(slot.menu_id) if slot.menu_id else None,
                    }
                    for slot in item.slots
                ]
            }
        avail = models.Availability(profile_id=pid, date=item.date, slots_json=slots_json, is_today=item.date == today)
        db.add(avail)
        created.append(str(avail.id))

    await db.commit()
    return {"created": created}


@router.get("/api/admin/reviews", summary="List reviews", response_model=ReviewListResponse)
async def admin_list_reviews(
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_session),
):
    stmt = select(models.Review).order_by(models.Review.created_at.desc())
    count_stmt = select(func.count()).select_from(models.Review)
    if status:
        stmt = stmt.where(models.Review.status == status)
        count_stmt = count_stmt.where(models.Review.status == status)

    total = await db.scalar(count_stmt)
    offset = (page - 1) * page_size
    reviews = await db.scalars(stmt.offset(offset).limit(page_size))
    return ReviewListResponse(
        total=int(total or 0),
        items=[serialize_review(r) for r in reviews],
    )


@router.patch("/api/admin/reviews/{review_id}", summary="Update review status", response_model=ReviewItem)
async def admin_update_review_status(
    review_id: UUID,
    payload: ReviewModerationRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
):
    review = await db.get(models.Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="review not found")

    before = serialize_review(review).model_dump()
    review.status = payload.status
    review.updated_at = models.now_utc()
    await db.commit()
    await db.refresh(review)

    await _record_change(
        request,
        db,
        target_type="review",
        target_id=review.id,
        action="moderate",
        before=before,
        after=serialize_review(review).model_dump(),
    )

    return serialize_review(review)


@router.post("/api/admin/outlinks", summary="Create outlink (seed)")
async def create_outlink(profile_id: str, kind: str, token: str, target_url: str,
                         db: AsyncSession = Depends(get_session)):
    # Ensure profile exists
    res = await db.execute(select(models.Profile.id).where(models.Profile.id == profile_id))
    pid = res.scalar_one_or_none()
    if not pid:
        raise HTTPException(404, "profile not found")
    ol = models.Outlink(profile_id=pid, kind=kind, token=token, target_url=target_url)
    db.add(ol)
    await db.commit()
    return {"id": str(ol.id)}


@router.post("/api/admin/profiles/{profile_id}/marketing", summary="Update marketing metadata")
async def update_marketing(profile_id: str, payload: ProfileMarketingUpdate, db: AsyncSession = Depends(get_session)):
    res = await db.execute(select(models.Profile).where(models.Profile.id == profile_id))
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "profile not found")

    if payload.discounts is not None:
        profile.discounts = [d.model_dump(exclude_none=True) for d in payload.discounts]
    if payload.ranking_badges is not None:
        profile.ranking_badges = payload.ranking_badges
    if payload.ranking_weight is not None:
        profile.ranking_weight = payload.ranking_weight

    await db.commit()
    await db.refresh(profile)

    today = datetime.now(JST).date()
    res_today = await db.execute(
        select(func.count())
        .select_from(models.Availability)
        .where(models.Availability.profile_id == profile.id, models.Availability.date == today)
    )
    has_today = (res_today.scalar_one() or 0) > 0
    res_out = await db.execute(select(models.Outlink).where(models.Outlink.profile_id == profile.id))
    outlinks = list(res_out.scalars().all())

    try:
        index_profile(_build_doc(profile, has_today, outlinks))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"meili_unavailable: {e}")

    return {"ok": True}


@router.get("/api/admin/reservations", summary="List reservations", response_model=ReservationAdminList)
async def list_reservations(
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_session),
):
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    stmt = select(models.Reservation).order_by(models.Reservation.created_at.desc())
    count_stmt = select(func.count()).select_from(models.Reservation)
    if status:
        stmt = stmt.where(models.Reservation.status == status)
        count_stmt = count_stmt.where(models.Reservation.status == status)

    result = await db.execute(stmt.offset(offset).limit(limit))
    reservations = result.scalars().all()

    total = (await db.execute(count_stmt)).scalar_one()

    shop_ids = [r.shop_id for r in reservations]
    shop_names: dict[UUID, str] = {}
    if shop_ids:
        res = await db.execute(
            select(models.Profile.id, models.Profile.name).where(models.Profile.id.in_(shop_ids))
        )
        shop_names = dict(res.all())

    items: list[ReservationAdminSummary] = []
    for r in reservations:
        normalized_status = r.status if r.status in _RESERVATION_ADMIN_STATUSES else "pending"
        items.append(
            ReservationAdminSummary(
                id=r.id,
                shop_id=r.shop_id,
                shop_name=shop_names.get(r.shop_id, "") or "",
                status=normalized_status,  # type: ignore[arg-type]
                desired_start=r.desired_start,
                desired_end=r.desired_end,
                channel=r.channel or None,
                notes=r.notes or None,
                customer_name=r.customer_name or "",
                customer_phone=r.customer_phone or "",
                customer_email=r.customer_email or None,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
        )

    return ReservationAdminList(total=total, items=items)


@router.patch("/api/admin/reservations/{reservation_id}", summary="Update reservation status")
async def update_reservation_admin(
    request: Request,
    reservation_id: UUID,
    payload: ReservationAdminUpdate,
    db: AsyncSession = Depends(get_session),
):
    if payload.status is None and payload.notes is None:
        raise HTTPException(status_code=400, detail="no updates provided")

    reservation = await db.get(models.Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="reservation not found")

    before = {
        "status": reservation.status,
        "notes": reservation.notes,
        "desired_start": reservation.desired_start.isoformat(),
        "desired_end": reservation.desired_end.isoformat(),
    }

    status_changed = False
    if payload.status is not None and payload.status != reservation.status:
        if payload.status not in {"pending", "confirmed", "declined", "cancelled", "expired"}:
            raise HTTPException(status_code=400, detail="invalid status")
        reservation.status = payload.status
        status_changed = True

    if payload.notes is not None:
        reservation.notes = payload.notes

    if status_changed or payload.notes is not None:
        event = models.ReservationStatusEvent(
            reservation_id=reservation.id,
            status=reservation.status,
            changed_at=datetime.now(timezone.utc),
            changed_by="admin",
            note=payload.notes,
        )
        db.add(event)

    await db.commit()
    await db.refresh(reservation)

    after = {
        "status": reservation.status,
        "notes": reservation.notes,
        "desired_start": reservation.desired_start.isoformat(),
        "desired_end": reservation.desired_end.isoformat(),
    }
    await _record_change(request, db, "reservation", reservation.id, "update", before, after)

    return {
        "id": str(reservation.id),
        "status": reservation.status,
        "notes": reservation.notes,
    }


@router.get("/api/admin/shops", summary="List shops", response_model=ShopAdminList)
async def admin_list_shops(db: AsyncSession = Depends(get_session)):
    res = await db.execute(select(models.Profile))
    profiles = res.scalars().all()
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


def _prepare_contact_output(contact_json: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(contact_json, dict):
        return {}
    return {
        "phone": contact_json.get("phone") or contact_json.get("tel"),
        "line_id": contact_json.get("line_id") or contact_json.get("line"),
        "website_url": contact_json.get("website_url") or contact_json.get("web"),
        "reservation_form_url": contact_json.get("reservation_form_url"),
        "sns": contact_json.get("sns") or [],
    }


async def _resolve_profile(db: AsyncSession, identifier: str) -> models.Profile | None:
    """Resolve shop by UUID or slug."""
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


@router.get("/api/admin/shops/{shop_id}", summary="Get shop detail", response_model=ShopAdminDetail)
async def admin_get_shop(shop_id: UUID, db: AsyncSession = Depends(get_session)):
    profile = await db.get(models.Profile, shop_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop not found")

    contact_json = profile.contact_json or {}
    service_tags = contact_json.get("service_tags") or profile.body_tags or []
    menus = _normalize_menus(contact_json.get("menus"), profile.id)
    staff_members = _normalize_staff(contact_json.get("staff"), profile.id)
    availability_calendar = await _fetch_availability(db, profile.id)

    contact = _prepare_contact_output(contact_json)
    availability = availability_calendar.days if availability_calendar else []
    photos = profile.photos or []

    return ShopAdminDetail(
        id=profile.id,
        name=profile.name,
        slug=profile.slug,
        area=profile.area,
        price_min=profile.price_min,
        price_max=profile.price_max,
        service_type=profile.service_type,
        service_tags=[str(tag) for tag in service_tags],
        contact=contact,
        description=contact_json.get("description"),
        catch_copy=contact_json.get("catch_copy"),
        address=contact_json.get("address"),
        photos=[str(p) for p in photos],
        menus=menus,
        staff=staff_members,
        availability=availability,
    )


@router.get(
    "/api/admin/shops/{shop_id}/availability",
    summary="Get availability calendar",
    response_model=AvailabilityCalendar,
)
async def admin_get_shop_availability(
    shop_id: str,
    start_date: date | None = Query(default=None, description="Filter availability from this date (inclusive)"),
    end_date: date | None = Query(default=None, description="Filter availability until this date (inclusive)"),
    db: AsyncSession = Depends(get_session),
):
    profile = await _resolve_profile(db, shop_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop not found")

    availability = await _fetch_availability(
        db,
        profile.id,
        start_date=start_date,
        end_date=end_date,
    )

    if not availability:
        return AvailabilityCalendar(
            shop_id=profile.id,
            generated_at=datetime.now(timezone.utc),
            days=[],
        )

    return availability


@router.patch("/api/admin/shops/{shop_id}/content", summary="Update shop content")
async def admin_update_shop_content(
    request: Request,
    shop_id: UUID,
    payload: ShopContentUpdate,
    db: AsyncSession = Depends(get_session),
):
    profile = await db.get(models.Profile, shop_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop not found")

    before_detail = await admin_get_shop(shop_id, db)

    contact_json = dict(profile.contact_json or {})

    if payload.name is not None:
        profile.name = payload.name.strip()

    if payload.area is not None:
        profile.area = payload.area.strip()

    if payload.price_min is not None:
        profile.price_min = max(0, int(payload.price_min))

    if payload.price_max is not None:
        profile.price_max = max(0, int(payload.price_max))

    if payload.service_type is not None:
        service_type = payload.service_type if payload.service_type in {'store', 'dispatch'} else 'store'
        profile.service_type = service_type

    if payload.slug is not None:
        normalized = slugify(payload.slug)
        conflict = None
        if normalized:
            res_slug = await db.execute(
                select(models.Profile.id).where(
                    models.Profile.slug == normalized,
                    models.Profile.id != profile.id,
                )
            )
            conflict = res_slug.scalar_one_or_none()
        if conflict:
            raise HTTPException(status_code=400, detail="slug already exists")
        profile.slug = normalized or None

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
        contact_json["menus"] = [
            {
                "id": str(item.id or uuid.uuid4()),
                "name": item.name,
                "price": item.price,
                "duration_minutes": item.duration_minutes,
                "description": item.description,
                "tags": item.tags,
                "is_reservable_online": item.is_reservable_online,
            }
            for item in payload.menus
        ]

    if payload.staff is not None:
        contact_json["staff"] = [
            {
                "id": str(item.id or uuid.uuid4()),
                "name": item.name,
                "alias": item.alias,
                "headline": item.headline,
                "specialties": item.specialties,
            }
            for item in payload.staff
        ]

    if payload.service_tags is not None:
        contact_json["service_tags"] = payload.service_tags
        profile.body_tags = payload.service_tags

    profile.contact_json = contact_json

    await db.commit()
    await db.refresh(profile)

    # reindex
    today = datetime.now(JST).date()
    res_today = await db.execute(
        select(func.count())
        .select_from(models.Availability)
        .where(models.Availability.profile_id == profile.id, models.Availability.date == today)
    )
    has_today = (res_today.scalar_one() or 0) > 0
    res_out = await db.execute(select(models.Outlink).where(models.Outlink.profile_id == profile.id))
    outlinks = list(res_out.scalars().all())
    index_profile(_build_doc(profile, has_today, outlinks))

    detail = await admin_get_shop(profile.id, db)
    await _record_change(
        request,
        db,
        "shop",
        profile.id,
        "content_update",
        before_detail.model_dump() if hasattr(before_detail, "model_dump") else jsonable_encoder(before_detail),
        detail.model_dump() if hasattr(detail, "model_dump") else jsonable_encoder(detail),
    )
    return detail


def _menu_to_dict(menu: BulkMenuInput, shop_id: UUID) -> dict[str, Any]:
    menu_uuid = menu.id or (
        uuid.uuid5(uuid.NAMESPACE_URL, f"{shop_id}:menu:{menu.external_id}")
        if menu.external_id
        else uuid.uuid5(uuid.NAMESPACE_URL, f"{shop_id}:menu:{menu.name}")
    )
    return {
        "id": str(menu_uuid),
        "name": menu.name,
        "price": menu.price,
        "duration_minutes": menu.duration_minutes,
        "description": menu.description,
        "tags": menu.tags,
        "is_reservable_online": menu.is_reservable_online,
    }


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


@router.post(
    "/api/admin/shops/content:bulk",
    summary="Bulk ingest shop content",
    response_model=BulkShopContentResponse,
)
async def admin_bulk_ingest_shop_content(
    request: Request,
    payload: BulkShopContentRequest,
    db: AsyncSession = Depends(get_session),
) -> BulkShopContentResponse:
    processed: List[BulkShopIngestResult] = []
    errors: List[dict[str, Any]] = []

    for entry in payload.shops:
        profile = await db.get(models.Profile, entry.shop_id)
        if not profile:
            errors.append({"shop_id": str(entry.shop_id), "error": "shop_not_found"})
            continue

        summary = BulkShopIngestResult(shop_id=entry.shop_id)
        before_detail = await admin_get_shop(entry.shop_id, db)

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
            contact_json["menus"] = [_menu_to_dict(menu, profile.id) for menu in entry.menus]
            summary.menus_updated = True

        profile.contact_json = contact_json

        if entry.reviews:
            for review in entry.reviews:
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

        if entry.diaries:
            for diary in entry.diaries:
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

        if entry.availability:
            for availability in entry.availability:
                slots_json = _slots_to_json(availability.slots)
                stmt = select(models.Availability).where(
                    models.Availability.profile_id == profile.id,
                    models.Availability.date == availability.date,
                )
                existing_availability = (await db.execute(stmt)).scalar_one_or_none()
                if existing_availability:
                    existing_availability.slots_json = slots_json
                    existing_availability.is_today = availability.date == datetime.now(JST).date()
                else:
                    db.add(
                        models.Availability(
                            profile_id=profile.id,
                            date=availability.date,
                            slots_json=slots_json,
                            is_today=availability.date == datetime.now(JST).date(),
                        )
                    )
                summary.availability_upserts += 1

        try:
            await db.commit()
        except Exception as exc:
            await db.rollback()
            errors.append({"shop_id": str(entry.shop_id), "error": str(exc)})
            continue

        try:
            await db.refresh(profile, attribute_names=["reviews", "diaries"])
        except Exception:
            await db.refresh(profile)

        today = datetime.now(JST).date()
        res_today = await db.execute(
            select(func.count())
            .select_from(models.Availability)
            .where(models.Availability.profile_id == profile.id, models.Availability.date == today)
        )
        has_today = (res_today.scalar_one() or 0) > 0
        res_out = await db.execute(select(models.Outlink).where(models.Outlink.profile_id == profile.id))
        outlinks = list(res_out.scalars().all())
        index_profile(_build_doc(profile, has_today, outlinks))

        after_detail = await admin_get_shop(profile.id, db)
        await _record_change(
            request,
            db,
            "shop",
            profile.id,
            "bulk_ingest",
            before_detail.model_dump() if hasattr(before_detail, "model_dump") else jsonable_encoder(before_detail),
            after_detail.model_dump() if hasattr(after_detail, "model_dump") else jsonable_encoder(after_detail),
        )

        processed.append(summary)

    return BulkShopContentResponse(processed=processed, errors=errors)


@router.put("/api/admin/shops/{shop_id}/availability", summary="Upsert availability", response_model=dict)
async def admin_upsert_availability(
    request: Request,
    shop_id: UUID,
    payload: AvailabilityUpsert,
    db: AsyncSession = Depends(get_session),
):
    profile = await db.get(models.Profile, shop_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop not found")

    slots_json = None
    if payload.slots:
        slots_json = {
            "slots": [
                {
                    "start_at": slot.start_at.isoformat(),
                    "end_at": slot.end_at.isoformat(),
                    "status": slot.status,
                    "staff_id": str(slot.staff_id) if slot.staff_id else None,
                    "menu_id": str(slot.menu_id) if slot.menu_id else None,
                }
                for slot in payload.slots
            ]
        }

    res = await db.execute(
        select(models.Availability)
        .where(models.Availability.profile_id == shop_id)
        .where(models.Availability.date == payload.date)
    )
    avail = res.scalar_one_or_none()
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

    await _record_change(
        request,
        db,
        "availability",
        avail.id,
        "upsert",
        before_slots,
        slots_json,
    )

    return {"id": str(avail.id)}
