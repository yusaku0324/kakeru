from __future__ import annotations

from typing import Any, Iterable, List, Optional


def strip_or_none(value: Optional[str]) -> Optional[str]:
    """Trim whitespace and convert empty strings to None."""
    if value is None:
        return None
    text = value.strip()
    return text or None


def sanitize_strings(values: Iterable[str] | None) -> List[str]:
    """Return a list of trimmed, non-empty strings."""
    if not values:
        return []
    sanitized: list[str] = []
    for value in values:
        if not isinstance(value, str):
            continue
        text = value.strip()
        if text:
            sanitized.append(text)
    return sanitized


def sanitize_photo_urls(values: Iterable[str] | None) -> List[str]:
    """Alias for sanitize_strings kept for readability."""
    return sanitize_strings(values)


def normalize_contact_value(
    value: Any, *, allow_numeric: bool = False
) -> Optional[str]:
    """Trim contact fields and optionally coerce numeric types to strings."""
    if allow_numeric and isinstance(value, (int, float)):
        value = str(value)
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned or None
    return None


__all__ = [
    "strip_or_none",
    "sanitize_strings",
    "sanitize_photo_urls",
    "normalize_contact_value",
]
