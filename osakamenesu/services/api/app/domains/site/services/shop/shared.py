from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Set, Tuple
from uuid import UUID
import uuid

from app.schemas import Promotion


class ShopNotFoundError(Exception):
    """Raised when a requested shop cannot be located."""


class AvailabilityNotFoundError(Exception):
    """Raised when requested availability entries are missing."""


def safe_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except Exception:
        return None


def safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def normalize_date_string(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return None


def parse_review_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
            try:
                return datetime.strptime(value, fmt).date()
            except Exception:
                continue
        try:
            return datetime.fromisoformat(value).date()
        except Exception:
            return None
    return None


def normalize_promotions(*sources: Any) -> List[Promotion]:
    promotions: List[Promotion] = []
    seen: Set[Tuple[str, str | None, str | None]] = set()
    for source in sources:
        if not isinstance(source, list):
            continue
        for entry in source:
            if not isinstance(entry, dict):
                continue
            label_raw = entry.get("label") or entry.get("title") or entry.get("name")
            if not label_raw:
                continue
            label = str(label_raw).strip()
            if not label:
                continue
            description = entry.get("description") or entry.get("detail")
            expires_at = normalize_date_string(
                entry.get("expires_at") or entry.get("until")
            )
            key = (label, description, expires_at)
            if key in seen:
                continue
            seen.add(key)
            promotions.append(
                Promotion(
                    label=label,
                    description=str(description) if description else None,
                    expires_at=expires_at,
                    highlight=entry.get("highlight"),
                )
            )
    return promotions


def normalize_staff_uuid(value: Any) -> UUID | None:
    if value is None:
        return None
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except Exception:
        return None


def uuid_from_seed(seed: str, value: str | None = None) -> UUID:
    if value:
        try:
            return UUID(value)
        except Exception:
            pass
    return uuid.uuid5(uuid.NAMESPACE_URL, seed)


__all__ = [
    "ShopNotFoundError",
    "AvailabilityNotFoundError",
    "safe_int",
    "safe_float",
    "normalize_date_string",
    "parse_review_date",
    "normalize_promotions",
    "normalize_staff_uuid",
    "uuid_from_seed",
]
