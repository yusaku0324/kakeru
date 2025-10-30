from __future__ import annotations

from datetime import datetime, timezone


def ensure_aware_datetime(value: datetime) -> datetime:
    """Ensure datetime is timezone-aware (UTC if naive)."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


__all__ = ["ensure_aware_datetime"]
