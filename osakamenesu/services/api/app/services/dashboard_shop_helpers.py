from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from ..schemas import DashboardShopContact, DashboardShopMenu, DashboardShopStaff
from ..utils.text import normalize_contact_value, sanitize_strings, strip_or_none


def extract_contact(
    contact_json: Dict[str, Any] | None,
) -> Optional[DashboardShopContact]:
    if not isinstance(contact_json, dict):
        return None
    phone = normalize_contact_value(
        contact_json.get("phone") or contact_json.get("tel"), allow_numeric=True
    )
    line_id = normalize_contact_value(
        contact_json.get("line_id") or contact_json.get("line")
    )
    website_url = contact_json.get("website_url") or contact_json.get("web")
    reservation_form_url = contact_json.get("reservation_form_url")
    if not any([phone, line_id, website_url, reservation_form_url]):
        return None
    return DashboardShopContact(
        phone=phone,
        line_id=line_id,
        website_url=website_url,
        reservation_form_url=reservation_form_url,
    )


def extract_menus(raw: Any) -> List[DashboardShopMenu]:
    if not isinstance(raw, list):
        return []
    items: List[DashboardShopMenu] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        name = strip_or_none(entry.get("name"))
        if not name:
            continue
        try:
            price = int(entry.get("price") or 0)
        except Exception:
            price = 0
        try:
            duration = entry.get("duration_minutes")
            duration_value = int(duration) if duration is not None else None
        except Exception:
            duration_value = None
        tags: List[str] = []
        raw_tags = entry.get("tags") or []
        if isinstance(raw_tags, list):
            tags = [tag for tag in sanitize_strings([str(item) for item in raw_tags])]
        items.append(
            DashboardShopMenu(
                id=str(entry.get("id")) if entry.get("id") else None,
                name=name,
                price=max(0, price),
                duration_minutes=duration_value,
                description=strip_or_none(entry.get("description")),
                tags=tags,
                is_reservable_online=entry.get("is_reservable_online", True),
            )
        )
    return items


def extract_staff(raw: Any) -> List[DashboardShopStaff]:
    if not isinstance(raw, list):
        return []
    members: List[DashboardShopStaff] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        name = strip_or_none(entry.get("name"))
        if not name:
            continue
        specialties: List[str] = []
        raw_specialties = entry.get("specialties") or []
        if isinstance(raw_specialties, list):
            specialties = [
                cleaned
                for cleaned in (strip_or_none(str(item)) for item in raw_specialties)
                if cleaned
            ]
        members.append(
            DashboardShopStaff(
                id=str(entry.get("id")) if entry.get("id") else None,
                name=name,
                alias=strip_or_none(entry.get("alias")),
                headline=strip_or_none(entry.get("headline")),
                specialties=specialties,
            )
        )
    return members


def sanitize_service_tags(raw: Optional[List[str]]) -> List[str]:
    if not raw:
        return []
    return sanitize_strings([str(item) for item in raw])


def sanitize_photos(raw: Optional[List[str]]) -> List[str]:
    if not raw:
        return []
    photos: List[str] = []
    for url in raw:
        cleaned = strip_or_none(url if isinstance(url, str) else str(url))
        if cleaned:
            photos.append(cleaned)
    return photos


def menus_to_contact_json(items: List[DashboardShopMenu]) -> List[Dict[str, Any]]:
    payload: List[Dict[str, Any]] = []
    for item in items:
        name = strip_or_none(item.name)
        if not name:
            continue
        try:
            price = int(item.price)
        except Exception:
            price = 0
        try:
            duration = (
                int(item.duration_minutes)
                if item.duration_minutes is not None
                else None
            )
        except Exception:
            duration = None
        tags = sanitize_strings(item.tags or [])
        payload.append(
            {
                "id": item.id or str(uuid.uuid4()),
                "name": name,
                "price": max(0, price),
                "duration_minutes": duration,
                "description": item.description,
                "tags": tags,
                "is_reservable_online": item.is_reservable_online,
            }
        )
    return payload


def staff_to_contact_json(items: List[DashboardShopStaff]) -> List[Dict[str, Any]]:
    payload: List[Dict[str, Any]] = []
    for member in items:
        name = strip_or_none(member.name)
        if not name:
            continue
        specialties = sanitize_strings(member.specialties or [])
        payload.append(
            {
                "id": member.id or str(uuid.uuid4()),
                "name": name,
                "alias": member.alias or None,
                "headline": member.headline or None,
                "specialties": specialties,
            }
        )
    return payload


def update_contact_json(
    contact_json: Dict[str, Any], contact: Optional[DashboardShopContact]
) -> None:
    if contact is None:
        for key in [
            "phone",
            "tel",
            "line_id",
            "line",
            "website_url",
            "web",
            "reservation_form_url",
        ]:
            contact_json.pop(key, None)
        return

    if contact.phone is not None:
        if contact.phone:
            contact_json["phone"] = contact.phone
            contact_json["tel"] = contact.phone
        else:
            contact_json.pop("phone", None)
            contact_json.pop("tel", None)
    if contact.line_id is not None:
        if contact.line_id:
            contact_json["line_id"] = contact.line_id
            contact_json["line"] = contact.line_id
        else:
            contact_json.pop("line_id", None)
            contact_json.pop("line", None)
    if contact.website_url is not None:
        if contact.website_url:
            contact_json["website_url"] = contact.website_url
            contact_json["web"] = contact.website_url
        else:
            contact_json.pop("website_url", None)
            contact_json.pop("web", None)
    if contact.reservation_form_url is not None:
        if contact.reservation_form_url:
            contact_json["reservation_form_url"] = contact.reservation_form_url
        else:
            contact_json.pop("reservation_form_url", None)


def update_optional_field(
    contact_json: Dict[str, Any], key: str, value: Optional[str]
) -> None:
    if value:
        contact_json[key] = value
    else:
        contact_json.pop(key, None)


__all__ = [
    "extract_contact",
    "extract_menus",
    "extract_staff",
    "sanitize_service_tags",
    "sanitize_photos",
    "menus_to_contact_json",
    "staff_to_contact_json",
    "update_contact_json",
    "update_optional_field",
]
