from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

JST = ZoneInfo("Asia/Tokyo")


def ensure_aware_datetime(value: datetime) -> datetime:
    """Ensure datetime is timezone-aware (UTC if naive)."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def ensure_jst_datetime(value: datetime) -> datetime:
    """Return a timezone-aware datetime normalized to Asia/Tokyo."""
    if value.tzinfo is None:
        return value.replace(tzinfo=JST)
    return value.astimezone(JST)


def now_jst() -> datetime:
    """Current Asia/Tokyo timestamp."""
    return datetime.now(JST)


def isoformat_jst(value: datetime) -> str:
    """Serialize datetime as ISO8601 string with Asia/Tokyo offset."""
    return ensure_jst_datetime(value).isoformat()


def parse_jst_isoformat(value: str) -> datetime:
    """Parse ISO8601 string and normalize to Asia/Tokyo."""
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = f"{normalized[:-1]}+00:00"
    dt = datetime.fromisoformat(normalized)
    return ensure_jst_datetime(dt)


__all__ = [
    "ensure_aware_datetime",
    "ensure_jst_datetime",
    "isoformat_jst",
    "now_jst",
    "parse_jst_isoformat",
    "JST",
]
