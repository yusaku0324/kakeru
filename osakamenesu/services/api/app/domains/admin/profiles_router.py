from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...schemas import (
    AvailabilityCalendar,
    AvailabilityCreate,
    AvailabilityUpsert,
    BulkShopContentRequest,
    BulkShopContentResponse,
    ProfileMarketingUpdate,
    ShopContentUpdate,
    ShopAdminDetail,
    ShopAdminList,
)
from .services import profile_service

router = APIRouter()


@router.post("/api/admin/profiles/{profile_id}/reindex", summary="Reindex single profile")
async def reindex_one(profile_id: UUID, db: AsyncSession = Depends(get_session)):
    await profile_service.reindex_profile(db=db, profile_id=profile_id)
    return {"ok": True}


@router.post("/api/admin/reindex", summary="Reindex all published profiles")
async def reindex_all(purge: bool = False, db: AsyncSession = Depends(get_session)):
    count = await profile_service.reindex_all_profiles(db=db, purge=purge)
    return {"indexed": count, "purged": purge}


@router.post("/api/admin/availabilities", summary="Create availability (seed)")
async def create_availability(
    profile_id: UUID,
    date: str,
    slots_json: dict | None = None,
    db: AsyncSession = Depends(get_session),
):
    try:
        date_value = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError as exc:  # pragma: no cover
        raise HTTPException(status_code=422, detail="invalid date format") from exc
    availability_id = await profile_service.create_single_availability(
        db=db,
        profile_id=profile_id,
        date_value=date_value,
        slots_json=slots_json,
    )
    return {"id": availability_id}

@router.post("/api/admin/availabilities/bulk", summary="Create availabilities from JSON")
async def create_availability_bulk_endpoint(
    payload: list[AvailabilityCreate],
    db: AsyncSession = Depends(get_session),
):
    created = await profile_service.create_availability_bulk(db=db, payload=payload)
    return {"created": created}


@router.post("/api/admin/outlinks", summary="Create outlink (seed)")
async def create_outlink(
    profile_id: UUID,
    kind: str,
    token: str,
    target_url: str,
    db: AsyncSession = Depends(get_session),
):
    outlink_id = await profile_service.create_outlink(
        db=db,
        profile_id=profile_id,
        kind=kind,
        token=token,
        target_url=target_url,
    )
    return {"id": outlink_id}


@router.post("/api/admin/profiles/{profile_id}/marketing", summary="Update marketing metadata")
async def update_marketing(
    profile_id: UUID,
    payload: ProfileMarketingUpdate,
    db: AsyncSession = Depends(get_session),
):
    await profile_service.update_marketing_metadata(db=db, profile_id=profile_id, payload=payload)
    return {"ok": True}


@router.get("/api/admin/shops", summary="List shops", response_model=ShopAdminList)
async def admin_list_shops(db: AsyncSession = Depends(get_session)):
    return await profile_service.list_shops(db=db)


@router.get("/api/admin/shops/{shop_id}", summary="Get shop detail", response_model=ShopAdminDetail)
async def admin_get_shop(shop_id: UUID, db: AsyncSession = Depends(get_session)):
    return await profile_service.get_shop_detail(db=db, shop_id=shop_id)


@router.get(
    "/api/admin/shops/{shop_id}/availability",
    summary="Get availability calendar",
    response_model=AvailabilityCalendar,
)
async def admin_get_shop_availability(
    shop_id: str,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_session),
):
    profile = await profile_service.resolve_profile_by_identifier(db=db, identifier=shop_id)
    if not profile:
        raise HTTPException(status_code=404, detail="shop not found")

    availability = await profile_service.get_availability_calendar(
        db=db,
        shop_id=profile.id,
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
async def admin_update_shop_content_endpoint(
    request: Request,
    shop_id: UUID,
    payload: ShopContentUpdate,
    db: AsyncSession = Depends(get_session),
):
    return await profile_service.update_shop_content(
        request=request,
        db=db,
        shop_id=shop_id,
        payload=payload,
    )


@router.post(
    "/api/admin/shops/content:bulk",
    summary="Bulk ingest shop content",
    response_model=BulkShopContentResponse,
)
async def admin_bulk_ingest_shop_content(
    request: Request,
    payload: BulkShopContentRequest,
    db: AsyncSession = Depends(get_session),
):
    return await profile_service.bulk_ingest_shop_content(request=request, db=db, payload=payload)


@router.put(
    "/api/admin/shops/{shop_id}/availability",
    summary="Upsert availability",
    response_model=dict,
)
async def admin_upsert_availability_endpoint(
    request: Request,
    shop_id: UUID,
    payload: AvailabilityUpsert,
    db: AsyncSession = Depends(get_session),
):
    availability_id = await profile_service.upsert_availability(
        request=request,
        db=db,
        shop_id=shop_id,
        payload=payload,
    )
    return {"id": availability_id}
