from __future__ import annotations

import logging
import time
import uuid
from datetime import date, datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...deps import require_admin
from ...models import Availability, Therapist
from ...services.availability_sync import sync_availability_for_date
from ..router import templates

logger = logging.getLogger(__name__)


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


def _is_hx(request: Request) -> bool:
    return request.headers.get("HX-Request", "").lower() == "true"


def _error_response(request: Request, message: str, status_code: int) -> HTMLResponse:
    return templates.TemplateResponse(
        request,
        "shifts/_error.html",
        {"message": message},
        status_code=status_code,
    )


async def _with_advisory_lock(session: AsyncSession, key1: int, key2: int) -> bool:
    res = await session.execute(
        text("SELECT pg_try_advisory_lock(:k1, :k2)").bindparams(k1=key1, k2=key2)
    )
    value = res.scalar()
    return bool(value)


async def _release_advisory_lock(session: AsyncSession, key1: int, key2: int) -> None:
    await session.execute(
        text("SELECT pg_advisory_unlock(:k1, :k2)").bindparams(k1=key1, k2=key2)
    )


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
    target_date: str = Form(...),
    therapist_id: str = Form(...),
):
    hx_request = _is_hx(request)
    correlation_id = uuid.uuid4().hex
    started_at = time.monotonic()

    try:
        therapist_uuid = UUID(therapist_id)
    except ValueError:
        return _error_response(request, "セラピストIDが不正です。", status_code=400)

    try:
        parsed_date = datetime.strptime(target_date, "%Y-%m-%d").date()
    except Exception:
        return _error_response(request, "日付の形式が不正です。", status_code=400)

    therapist = await _get_therapist(session, therapist_uuid)
    if not therapist:
        return _error_response(
            request, "該当するセラピストが見つかりません。", status_code=404
        )

    lock_key1 = therapist_uuid.int & 0x7FFFFFFF
    lock_key2 = parsed_date.toordinal() & 0x7FFFFFFF
    locked = False
    try:
        locked = await _with_advisory_lock(session, lock_key1, lock_key2)
        if not locked:
            return _error_response(
                request, "同一の対象を処理中です。少し待って再実行してください。", 409
            )

        try:
            await sync_availability_for_date(
                db=session, shop_id=therapist.profile_id, target_date=parsed_date
            )
            await session.commit()
        except Exception:  # pragma: no cover - defensive logging
            logger.exception(
                "htmx.rebuild.failed correlation_id=%s therapist_id=%s date=%s",
                correlation_id,
                therapist_id,
                parsed_date,
            )
            return _error_response(
                request, "スロット再生成に失敗しました。", status_code=500
            )

        slots = await _get_slots_for_profile_date(
            session, profile_id=therapist.profile_id, target_date=parsed_date
        )
        elapsed_ms = int((time.monotonic() - started_at) * 1000)
        logger.info(
            "htmx.rebuild.ok correlation_id=%s therapist_id=%s date=%s slots=%s elapsed_ms=%s",
            correlation_id,
            therapist_id,
            parsed_date,
            len(slots),
            elapsed_ms,
        )

        response = templates.TemplateResponse(
            request,
            "shifts/_slots_table.html",
            {
                "slots": _as_slot_rows(slots, therapist_id),
            },
        )
        if not hx_request:
            return templates.TemplateResponse(
                request,
                "shifts/index.html",
                {"today": parsed_date, "slots": _as_slot_rows(slots, therapist_id)},
            )
        return response
    finally:
        if locked:
            await _release_advisory_lock(session, lock_key1, lock_key2)
