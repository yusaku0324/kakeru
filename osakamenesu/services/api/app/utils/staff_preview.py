from __future__ import annotations

from collections import defaultdict
from typing import Any, Optional

from .. import models

__all__ = [
    "_build_staff_preview",
    "_collect_staff_specialties",
    "_normalize_text",
    "_safe_float",
    "_safe_int",
]


def _normalize_text(value: Any) -> Optional[str]:
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed or None
    if value is None:
        return None
    candidate = str(value).strip()
    return candidate or None


def _collect_staff_specialties(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    cleaned: list[str] = []
    for entry in raw:
        normalized = _normalize_text(entry)
        if normalized:
            cleaned.append(normalized)
    return cleaned


def _safe_int(v: object) -> Optional[int]:
    try:
        if v is None:
            return None
        return int(v)  # type: ignore[arg-type]
    except Exception:
        return None


def _safe_float(v: object) -> Optional[float]:
    try:
        if v is None:
            return None
        return float(v)  # type: ignore[arg-type]
    except Exception:
        return None


def _build_staff_preview(
    profile: models.Profile,
    contact_json: dict[str, Any],
) -> list[dict[str, Any]]:
    """Serialize staff preview with therapist UUIDs when available."""

    therapists: list[models.Therapist] = []
    try:
        cached = profile.__dict__.get("therapists")
        if cached:
            therapists = list(cached or [])
    except Exception:
        therapists = []

    published = [t for t in therapists if getattr(t, "status", None) == "published"]
    therapist_by_id: dict[str, models.Therapist] = {str(t.id): t for t in published}
    therapist_by_name: dict[str, list[models.Therapist]] = defaultdict(list)
    for therapist in published:
        key = (_normalize_text(therapist.name) or "").casefold()
        if key:
            therapist_by_name[key].append(therapist)

    raw_staff = contact_json.get("staff") if isinstance(contact_json, dict) else None
    contact_entries: list[dict[str, Any]] = []
    if isinstance(raw_staff, list):
        contact_entries = [entry for entry in raw_staff if isinstance(entry, dict)]

    preview: list[dict[str, Any]] = []
    used_ids: set[str] = set()

    for entry in contact_entries:
        name = _normalize_text(entry.get("name") or entry.get("staff_name"))
        if not name:
            continue
        alias = _normalize_text(entry.get("alias"))
        headline = _normalize_text(entry.get("headline"))
        avatar_url = _normalize_text(
            entry.get("avatar_url") or entry.get("photo_url") or entry.get("image")
        )
        rating = _safe_float(entry.get("rating"))
        review_count = _safe_int(entry.get("review_count"))
        specialties = _collect_staff_specialties(entry.get("specialties"))

        raw_id = entry.get("id")
        therapist_id = _normalize_text(raw_id) if raw_id is not None else None
        matched: Optional[models.Therapist] = None
        if therapist_id and therapist_id in therapist_by_id:
            matched = therapist_by_id[therapist_id]
        else:
            key = name.casefold()
            candidates = therapist_by_name.get(key, [])
            matched = next(
                (
                    candidate
                    for candidate in candidates
                    if str(candidate.id) not in used_ids
                ),
                None,
            )

        if matched:
            therapist_id = str(matched.id)
            used_ids.add(therapist_id)

        preview.append(
            {
                "id": therapist_id,
                "name": name,
                "alias": alias,
                "headline": headline,
                "rating": rating,
                "review_count": review_count,
                "avatar_url": avatar_url,
                "specialties": specialties,
            }
        )

    unmatched = [t for t in published if str(t.id) not in used_ids]
    for therapist in unmatched:
        specialties = _collect_staff_specialties(
            list(getattr(therapist, "specialties", []) or [])
        )
        photo_urls = list(getattr(therapist, "photo_urls", []) or [])
        preview.append(
            {
                "id": str(therapist.id),
                "name": therapist.name,
                "alias": _normalize_text(therapist.alias),
                "headline": _normalize_text(therapist.headline),
                "rating": None,
                "review_count": None,
                "avatar_url": _normalize_text(photo_urls[0]) if photo_urls else None,
                "specialties": specialties,
            }
        )

    return preview
