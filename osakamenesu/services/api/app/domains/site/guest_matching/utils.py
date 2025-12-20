"""Utility functions for guest matching."""

import logging
from datetime import date, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ....utils.datetime import JST
from .... import models
from .schemas import GuestMatchingRequest, MatchingCandidate


logger = logging.getLogger(__name__)


def combine_datetime(d: date | None, t: str | None) -> datetime | None:
    if not d or not t:
        return None
    try:
        hour, minute = map(int, t.split(":"))
        return datetime(
            d.year,
            d.month,
            d.day,
            hour,
            minute,
            tzinfo=JST,
        )
    except Exception:
        return None


def resolve_phase(payload: GuestMatchingRequest, parsed_date: date | None) -> str:
    """Resolve phase with fallbacks based on date/time presence."""
    requested = payload.phase
    has_time_window = bool(parsed_date and payload.time_from and payload.time_to)

    if requested == "book" and not has_time_window:
        requested = "explore"
    if requested in {"explore", "narrow", "book"}:
        return requested

    if has_time_window:
        return "book"
    return "explore"


def map_shop_to_candidate(shop: Any) -> dict[str, Any]:
    """Convert ShopSearchService result to candidate dict."""

    def getter(obj: Any, key: str, default: Any = None) -> Any:
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    staff = None
    staff_preview = getter(shop, "staff_preview", None) or []
    if staff_preview:
        staff = next((s for s in staff_preview if getter(s, "name", None)), None)

    therapist_id = getter(staff, "id", None) or getter(shop, "id", None)
    therapist_name = getter(staff, "name", None) or getter(shop, "name", "")

    slot = None
    staff_slot = getter(staff, "next_available_slot", None)
    shop_slot = getter(shop, "next_available_slot", None)
    slot = staff_slot or shop_slot

    slots: list[dict[str, Any]] = []
    if slot:
        slots.append(
            {
                "start_at": getter(slot, "start_at", None),
                "end_at": getter(slot, "end_at", None),
            }
        )

    photos = getter(staff, "photos", None) or getter(shop, "photo_urls", None) or []
    photo_embedding = getter(staff, "photo_embedding", None) or getter(
        shop, "photo_embedding", None
    )

    return {
        "therapist_id": str(therapist_id or ""),
        "therapist_name": therapist_name or "",
        "shop_id": str(getter(shop, "id", "")),
        "shop_name": getter(shop, "name", "") or "",
        "price_rank": getter(shop, "ranking_weight", None),
        "price_level": getter(shop, "price_band", None),
        "mood_tag": getter(staff, "mood_tag", None) or getter(shop, "mood_tag", None),
        "talk_level": getter(staff, "talk_level", None)
        or getter(shop, "talk_level", None),
        "style_tag": getter(staff, "style_tag", None)
        or getter(shop, "style_tag", None),
        "look_type": getter(staff, "look_type", None)
        or getter(shop, "look_type", None),
        "contact_style": getter(staff, "contact_style", None)
        or getter(shop, "contact_style", None),
        "hobby_tags": getter(staff, "hobby_tags", None)
        or getter(shop, "hobby_tags", None)
        or [],
        "age": getter(staff, "age", None) or getter(shop, "age", None),
        "photo_url": (photos or [None])[0],
        "photo_embedding": photo_embedding,
        "slots": slots,
    }


async def log_matching(
    db: AsyncSession,
    payload: GuestMatchingRequest,
    top_matches: list[MatchingCandidate],
    other_candidates: list[MatchingCandidate],
    guest_token: str | None = None,
    phase: str | None = None,
    step_index: int | None = None,
    entry_source: str | None = None,
) -> None:
    """Best-effort logging of matching input and candidates."""
    try:
        if not db or not hasattr(db, "add"):
            return
        log = models.GuestMatchLog(
            guest_token=guest_token,
            area=getattr(payload, "area", None),
            date=getattr(payload, "date", None),
            budget_level=getattr(payload, "budget_level", None),
            mood_pref=getattr(payload, "mood_pref", None),
            talk_pref=getattr(payload, "talk_pref", None),
            style_pref=getattr(payload, "style_pref", None),
            look_pref=getattr(payload, "look_pref", None),
            free_text=getattr(payload, "free_text", None),
            phase=phase,
            step_index=step_index,
            entry_source=entry_source,
            top_matches=[c.model_dump() for c in top_matches],
            other_candidates=[c.model_dump() for c in other_candidates],
            selected_therapist_id=None,
            selected_shop_id=None,
            selected_slot=None,
        )
        db.add(log)
        await db.commit()
    except Exception as exc:  # pragma: no cover - best effort
        await db.rollback()
        logger.warning("guest_matching_log_failed: %s", exc)
