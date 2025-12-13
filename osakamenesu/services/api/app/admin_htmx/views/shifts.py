from datetime import date
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...deps import require_admin
from ...models import Availability, Therapist
from ...services.availability_sync import sync_availability_for_date
from ..router import templates


router = APIRouter(
    prefix="/shifts",
    tags=["admin_htmx_shifts"],
    dependencies=[Depends(require_admin)],
)


def _as_slot_rows(raw_slots: List[dict], therapist_id: str) -> List[dict]:
    filtered = [
        slot
        for slot in raw_slots
        if str(slot.get("therapist_id")) == therapist_id
        or slot.get("therapist_id") is None
    ]
    return [
        {
            "start_at": slot.get("start_at"),
            "end_at": slot.get("end_at"),
            "therapist_id": slot.get("therapist_id") or therapist_id,
            "status": slot.get("status"),
        }
        for slot in filtered
    ]


async def _get_therapist(session: AsyncSession, therapist_id: UUID) -> Therapist | None:
    result = await session.execute(
        select(Therapist).where(Therapist.id == therapist_id)
    )
    return result.scalar_one_or_none()


async def _get_slots_for_profile_date(
    session: AsyncSession, profile_id: UUID, target_date: date
) -> list[dict]:
    availability_stmt = select(Availability).where(
        Availability.profile_id == profile_id, Availability.date == target_date
    )
    availability_res = await session.execute(availability_stmt)
    availability = availability_res.scalar_one_or_none()
    if not availability or not availability.slots_json:
        return []
    return availability.slots_json.get("slots", []) or []


@router.get("", response_class=HTMLResponse)
async def shifts_index(request: Request):
    today = date.today()
    return templates.TemplateResponse(
        request,
        "shifts/index.html",
        {"today": today, "slots": [], "query": {}},
    )


@router.post("/rebuild", response_class=HTMLResponse)
async def shifts_rebuild(
    request: Request,
    session: AsyncSession = Depends(get_session),
    target_date: date = Form(...),
    therapist_id: str = Form(...),
):
    try:
        therapist_uuid = UUID(therapist_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid_therapist_id") from exc

    therapist = await _get_therapist(session, therapist_uuid)
    if not therapist:
        raise HTTPException(status_code=404, detail="therapist_not_found")

    try:
        await sync_availability_for_date(
            db=session, shop_id=therapist.profile_id, target_date=target_date
        )
        await session.commit()
    except Exception as exc:  # pragma: no cover - defensive logging
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    slots = await _get_slots_for_profile_date(
        session, profile_id=therapist.profile_id, target_date=target_date
    )

    return templates.TemplateResponse(
        request,
        "shifts/_slots_table.html",
        {
            "slots": _as_slot_rows(slots, therapist_id),
        },
    )
