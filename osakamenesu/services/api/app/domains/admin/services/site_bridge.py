"""Bridge helpers for reusing site-domain utilities from admin services."""

from __future__ import annotations

from datetime import date
from typing import Any, List
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from ...site import shops as site_shops
from ...site import utils as site_utils
from ....schemas import (
    AvailabilityCalendar,
    BulkMenuInput,
    MenuInput,
    MenuItem,
    ReviewItem,
    StaffInput,
    StaffSummary,
)


async def fetch_availability(
    db: AsyncSession,
    shop_id: UUID,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
) -> AvailabilityCalendar | None:
    return await site_shops._fetch_availability(db, shop_id, start_date=start_date, end_date=end_date)


def normalize_contact(contact_json: dict[str, Any] | None) -> dict[str, Any]:
    return site_utils.normalize_contact(contact_json)


def normalize_menus(raw: Any, shop_id: UUID) -> List[MenuItem]:
    return site_utils.normalize_shop_menus(raw, shop_id)


def normalize_staff(raw: Any) -> List[StaffSummary]:
    return site_utils.normalize_shop_staff(raw)


def serialize_review(review: Any) -> ReviewItem:
    return site_shops.serialize_review(review)


def serialize_menu_inputs(menus: List[MenuInput]) -> List[dict[str, Any]]:
    return site_utils.serialize_menu_inputs(menus)


def serialize_bulk_menu(menu: BulkMenuInput, shop_id: UUID) -> dict[str, Any]:
    return site_utils.serialize_bulk_menu(menu, shop_id)


def serialize_staff_inputs(staff: List[StaffInput]) -> List[dict[str, Any]]:
    return site_utils.serialize_staff_inputs(staff)
