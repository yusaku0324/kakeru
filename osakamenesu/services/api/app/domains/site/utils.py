from __future__ import annotations

from typing import Any, List
from uuid import UUID, uuid4, uuid5, NAMESPACE_URL

from ...schemas import BulkMenuInput, MenuInput, StaffInput, MenuItem, StaffSummary


def normalize_contact(contact_json: dict[str, Any] | None) -> dict[str, Any]:
  if not isinstance(contact_json, dict):
    return {}
  return {
    "phone": contact_json.get("phone") or contact_json.get("tel"),
    "line_id": contact_json.get("line_id") or contact_json.get("line"),
    "website_url": contact_json.get("website_url") or contact_json.get("web"),
    "reservation_form_url": contact_json.get("reservation_form_url"),
    "sns": contact_json.get("sns") or [],
  }


def normalize_shop_menus(raw: Any, shop_id: UUID) -> List[MenuItem]:
  if not raw:
    return []
  items = raw if isinstance(raw, list) else []
  normalized: List[MenuItem] = []
  for item in items:
    if not isinstance(item, dict):
      continue
    name = (item.get("name") or "").strip()
    if not name:
      continue
    normalized.append(
      MenuItem(
        id=item.get("id"),
        name=name,
        price=item.get("price") or 0,
        duration_minutes=item.get("duration_minutes"),
        description=item.get("description"),
        tags=item.get("tags") or [],
        is_reservable_online=item.get("is_reservable_online"),
      )
    )
  return normalized


def normalize_shop_staff(raw: Any) -> List[StaffSummary]:
  if not raw:
    return []
  items = raw if isinstance(raw, list) else []
  normalized: List[StaffSummary] = []
  for item in items:
    if not isinstance(item, dict):
      continue
    name = (item.get("name") or "").strip()
    if not name:
      continue
    normalized.append(
      StaffSummary(
        id=item.get("id"),
        name=name,
        alias=item.get("alias"),
        headline=item.get("headline"),
        specialties=item.get("specialties") or [],
      )
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
