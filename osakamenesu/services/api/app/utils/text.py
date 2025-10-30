from __future__ import annotations

from typing import Iterable, List, Optional


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


__all__ = [
    "strip_or_none",
    "sanitize_strings",
    "sanitize_photo_urls",
]
