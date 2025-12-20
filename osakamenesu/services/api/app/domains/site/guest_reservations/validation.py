"""Validation functions for guest reservations."""

from datetime import datetime
from typing import Any, Optional

from .utils import parse_datetime


def validate_request(payload: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """
    Validate and normalize reservation request.

    Returns (normalized_data, rejected_reasons).
    """
    reasons: list[str] = []
    normalized: dict[str, Any] = {}

    shop_id = payload.get("shop_id")
    start_raw = payload.get("start_at")
    end_raw = payload.get("end_at")
    start_at = parse_datetime(start_raw)
    end_at = parse_datetime(end_raw) if end_raw is not None else None

    if not shop_id:
        reasons.append("shop_id_required")
    if not start_at:
        reasons.append("invalid_start_or_end")
    elif end_raw is not None and not end_at:
        reasons.append("invalid_start_or_end")
    elif end_at and start_at >= end_at:
        reasons.append("end_before_start")

    normalized["shop_id"] = shop_id
    normalized["therapist_id"] = payload.get("therapist_id")
    normalized["start_at"] = start_at
    normalized["end_at"] = end_at
    normalized["course_id"] = payload.get("course_id")
    normalized["price"] = payload.get("price")
    normalized["payment_method"] = payload.get("payment_method")
    normalized["contact_info"] = payload.get("contact_info")
    normalized["guest_token"] = payload.get("guest_token")
    normalized["user_id"] = payload.get("user_id")
    normalized["notes"] = payload.get("notes")
    normalized["base_staff_id"] = payload.get("base_staff_id")

    duration = payload.get("duration_minutes")
    if duration is None and start_at and end_at:
        duration = int((end_at - start_at).total_seconds() // 60)
    normalized["duration_minutes"] = duration

    if duration is None and not normalized.get("course_id"):
        reasons.append("duration_missing")

    return normalized, reasons


def check_deadline(
    start_at: datetime,
    now: datetime,
    shop_settings: Optional[dict[str, Any]] = None,
) -> list[str]:
    """
    Check reservation deadline.

    Returns list of rejection reasons if deadline is exceeded.
    """
    if not start_at:
        return ["invalid_start_time"]
    cutoff_minutes = 60
    if shop_settings and isinstance(shop_settings.get("deadline_minutes"), int):
        cutoff_minutes = max(0, shop_settings["deadline_minutes"])
    delta = (start_at - now).total_seconds() / 60
    if delta < cutoff_minutes:
        return ["deadline_over"]
    return []
