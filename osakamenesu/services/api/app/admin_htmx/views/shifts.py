from __future__ import annotations

import logging
from datetime import date as date_type, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from time import perf_counter
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ... import models
from ...services.availability_sync import sync_availability_for_date
from ...domains.site.services.shop.availability import convert_slots

logger = logging.getLogger(__name__)

router = APIRouter()

templates_dir = Path(__file__).resolve().parents[1] / "templates"


@lru_cache(maxsize=1)
def get_templates() -> Jinja2Templates:
    return Jinja2Templates(directory=templates_dir)


def _format_slot(dt: datetime) -> str:
    try:
        return dt.isoformat()
    except Exception:
        return str(dt)


def _render_slots_table(slots: list[dict]) -> str:
    template = get_templates().env.get_template("shifts/_slots_table.html")
    return template.render({"slots": slots})


def _render_error_box(message: str | None) -> str:
    # hx-swap-oob updates the page-level error box without replacing the slots table.
    # When message is None/empty, it clears the error box.
    msg = message or ""
    msg_html = (
        f'<div class="panel" style="border-color:#fca5a5;background:#fef2f2;">{msg}</div>'
        if msg
        else ""
    )
    return f'<div id="error_box" hx-swap-oob="true">{msg_html}</div>'


async def _fetch_therapist(
    db: AsyncSession, therapist_id: UUID
) -> models.Therapist | None:
    res = await db.execute(
        select(models.Therapist).where(models.Therapist.id == therapist_id)
    )
    return res.scalar_one_or_none()


async def _load_cached_slots(
    db: AsyncSession, *, shop_id: UUID, therapist_id: UUID, target_date: date_type
) -> list[dict]:
    res = await db.execute(
        select(models.Availability).where(
            models.Availability.profile_id == shop_id,
            models.Availability.date == target_date,
        )
    )
    availability = res.scalar_one_or_none()
    if not availability or not availability.slots_json:
        return []
    slots = convert_slots(availability.slots_json)
    rows: list[dict] = []
    for slot in slots:
        if slot.staff_id is not None and slot.staff_id != therapist_id:
            continue
        rows.append(
            {
                "start_at": _format_slot(slot.start_at),
                "end_at": _format_slot(slot.end_at),
                "status": slot.status or "open",
            }
        )
    rows.sort(key=lambda r: r["start_at"])
    return rows


def _default_date_jst_iso() -> str:
    now_utc = datetime.now(timezone.utc)
    now_jst = now_utc + timedelta(hours=9)
    return now_jst.date().isoformat()


@router.get("/shifts", response_class=HTMLResponse)
async def shifts_index(
    request: Request,
    therapist_id: str | None = None,
    date: str | None = None,
):
    return get_templates().TemplateResponse(
        "shifts/index.html",
        {
            "request": request,
            "therapist_id": therapist_id or "",
            "date": date or _default_date_jst_iso(),
            "slots": [],
        },
    )


@router.post("/shifts/rebuild", response_class=HTMLResponse)
async def shifts_rebuild(
    request: Request,
    therapist_id: str = Form(...),
    date: str = Form(...),
    db: AsyncSession = Depends(get_session),
):
    started = perf_counter()
    correlation_id = request.headers.get("x-request-id") or request.headers.get(
        "cf-ray"
    )

    try:
        therapist_uuid = UUID(therapist_id)
    except ValueError:
        html = _render_slots_table([]) + _render_error_box(
            "Invalid therapist_id (UUID required)."
        )
        return HTMLResponse(html, status_code=status.HTTP_400_BAD_REQUEST)

    try:
        target_date = date_type.fromisoformat(date)
    except ValueError:
        html = _render_slots_table([]) + _render_error_box(
            "Invalid date (YYYY-MM-DD required)."
        )
        return HTMLResponse(html, status_code=status.HTTP_400_BAD_REQUEST)

    therapist = await _fetch_therapist(db, therapist_uuid)
    if not therapist:
        html = _render_slots_table([]) + _render_error_box("Therapist not found.")
        return HTMLResponse(html, status_code=status.HTTP_404_NOT_FOUND)

    shop_id = therapist.profile_id
    if not shop_id:
        html = _render_slots_table([]) + _render_error_box(
            "Therapist has no shop/profile_id."
        )
        return HTMLResponse(html, status_code=status.HTTP_400_BAD_REQUEST)

    logger.info(
        "admin_htmx_shifts_rebuild_start correlation_id=%s therapist_id=%s shop_id=%s date=%s",
        correlation_id,
        therapist_uuid,
        shop_id,
        target_date,
    )

    try:
        await sync_availability_for_date(db, shop_id, target_date)
        await db.commit()
        slots = await _load_cached_slots(
            db, shop_id=shop_id, therapist_id=therapist_uuid, target_date=target_date
        )
        elapsed_ms = int((perf_counter() - started) * 1000)
        logger.info(
            "admin_htmx_shifts_rebuild_done correlation_id=%s therapist_id=%s shop_id=%s date=%s slots=%d elapsed_ms=%d",
            correlation_id,
            therapist_uuid,
            shop_id,
            target_date,
            len(slots),
            elapsed_ms,
        )
        html = _render_slots_table(slots) + _render_error_box(None)
        return HTMLResponse(html, status_code=status.HTTP_200_OK)
    except Exception as exc:
        elapsed_ms = int((perf_counter() - started) * 1000)
        logger.exception(
            "admin_htmx_shifts_rebuild_failed correlation_id=%s therapist_id=%s shop_id=%s date=%s elapsed_ms=%d",
            correlation_id,
            therapist_uuid,
            shop_id,
            target_date,
            elapsed_ms,
        )
        html = _render_slots_table([]) + _render_error_box(
            "Rebuild failed. Check API logs."
        )
        return HTMLResponse(html, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
