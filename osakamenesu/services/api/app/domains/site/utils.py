from __future__ import annotations

from typing import Any, List
from uuid import UUID, uuid4, uuid5, NAMESPACE_URL

from ...schemas import BulkMenuInput, MenuInput, StaffInput, MenuItem, StaffSummary
from ...utils.text import normalize_contact_value


def normalize_contact(contact_json: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(contact_json, dict):
        return {}
    return {
        "phone": normalize_contact_value(
            contact_json.get("phone") or contact_json.get("tel"), allow_numeric=True
        ),
        "line_id": normalize_contact_value(
            contact_json.get("line_id") or contact_json.get("line")
        ),
        "website_url": normalize_contact_value(
            contact_json.get("website_url") or contact_json.get("web")
        ),
        "reservation_form_url": normalize_contact_value(
            contact_json.get("reservation_form_url")
        ),
        "sns": contact_json.get("sns") or [],
    }


def normalize_shop_menus(raw: Any, shop_id: UUID) -> List[MenuItem]:
    if not isinstance(raw, list):
        return []
    normalized: List[MenuItem] = []
    for idx, item in enumerate(raw):
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or f"メニュー{idx + 1}").strip()
        if not name:
            continue
        menu_id = _uuid_from_seed(
            f"{shop_id}:menu:{item.get('id') or item.get('name') or idx}",
            item.get("id"),
        )
        price = _safe_int(item.get("price"))
        duration = _safe_int(item.get("duration_minutes") or item.get("duration"))
        description = item.get("description")
        tags_source = item.get("tags") or []
        tags = [str(tag) for tag in tags_source if str(tag).strip()]
        reservable_flag = item.get("is_reservable_online")
        is_reservable_online = (
            reservable_flag if isinstance(reservable_flag, bool) else True
        )

        normalized.append(
            MenuItem(
                id=menu_id,
                name=name,
                description=description,
                duration_minutes=duration,
                price=price if price is not None else 0,
                currency=str(item.get("currency") or "JPY"),
                is_reservable_online=is_reservable_online,
                tags=tags,
            ),
        )
    return normalized


def normalize_shop_staff(raw: Any, shop_id: UUID) -> List[StaffSummary]:
    if not isinstance(raw, list):
        return []
    normalized: List[StaffSummary] = []
    for idx, item in enumerate(raw):
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or f"スタッフ{idx + 1}").strip()
        if not name:
            continue
        staff_id = _uuid_from_seed(
            f"{shop_id}:staff:{item.get('id') or item.get('name') or idx}",
            item.get("id"),
        )
        specialties_source = item.get("specialties") or []
        specialties = [str(tag) for tag in specialties_source if str(tag).strip()]
        rating = _safe_float(item.get("rating"))
        review_count = _safe_int(item.get("review_count"))

        normalized.append(
            StaffSummary(
                id=staff_id,
                name=name,
                alias=item.get("alias"),
                avatar_url=item.get("avatar_url"),
                headline=item.get("headline"),
                rating=rating,
                review_count=review_count,
                specialties=specialties,
            ),
        )
    return normalized


def serialize_menu_input(menu: MenuInput) -> dict[str, Any]:
    return {
        "id": str(menu.id or uuid4()),
        "name": menu.name,
        "price": menu.price,
        "duration_minutes": menu.duration_minutes,
        "description": menu.description,
        "tags": menu.tags,
        "is_reservable_online": menu.is_reservable_online,
    }


def serialize_menu_inputs(menus: List[MenuInput]) -> List[dict[str, Any]]:
    return [serialize_menu_input(menu) for menu in menus]


def serialize_bulk_menu(menu: BulkMenuInput, shop_id: UUID) -> dict[str, Any]:
    menu_uuid = menu.id or (
        uuid5(NAMESPACE_URL, f"{shop_id}:menu:{menu.external_id}")
        if menu.external_id
        else uuid5(NAMESPACE_URL, f"{shop_id}:menu:{menu.name}")
    )
    return {
        "id": str(menu_uuid),
        "name": menu.name,
        "price": menu.price,
        "duration_minutes": menu.duration_minutes,
        "description": menu.description,
        "tags": menu.tags,
        "is_reservable_online": menu.is_reservable_online,
    }


def serialize_staff_inputs(staff: List[StaffInput]) -> List[dict[str, Any]]:
    serialized: List[dict[str, Any]] = []
    for item in staff:
        serialized.append(
            {
                "id": str(item.id or uuid4()),
                "name": item.name,
                "alias": item.alias,
                "headline": item.headline,
                "specialties": item.specialties,
            }
        )
    return serialized


def _uuid_from_seed(seed: str, value: Any | None = None) -> UUID:
    if value:
        try:
            return UUID(str(value))
        except Exception:
            pass
    return uuid5(NAMESPACE_URL, seed)


def _safe_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except Exception:
        return None


def _safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None
