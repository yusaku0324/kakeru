from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from .. import models
from ..notifications import ReservationNotification, enqueue_reservation_notification
from ..utils.text import normalize_contact_value

_DEFAULT_NOTIFICATION_STATUSES = ("pending", "confirmed")


async def resolve_notification_channels(
    db: AsyncSession,
    shop_id: UUID,
    status: str,
) -> dict[str, Any]:
    setting = await db.get(models.DashboardNotificationSetting, shop_id)
    if not setting:
        return {"emails": [], "slack": None, "line": None}

    if setting.trigger_status is None:
        trigger_status = list(_DEFAULT_NOTIFICATION_STATUSES)
    else:
        trigger_status = list(setting.trigger_status)

    if status not in trigger_status:
        return {"emails": [], "slack": None, "line": None}

    channels = setting.channels or {}

    email_conf = channels.get("email") or {}
    emails = email_conf.get("recipients", []) if email_conf.get("enabled") else []
    if not isinstance(emails, list):
        emails = []

    slack_conf = channels.get("slack") or {}
    slack_url = slack_conf.get("webhook_url") if slack_conf.get("enabled") else None
    if isinstance(slack_url, str):
        slack_url = slack_url.strip() or None
    else:
        slack_url = None

    line_conf = channels.get("line") or {}
    line_token = line_conf.get("token") if line_conf.get("enabled") else None
    if isinstance(line_token, str):
        line_token = line_token.strip() or None
    else:
        line_token = None

    return {"emails": emails, "slack": slack_url, "line": line_token}


def build_reservation_notification_payload(
    reservation: models.Reservation,
    shop: models.Profile,
    channels_config: dict[str, Any],
    *,
    note_override: Optional[str] = None,
) -> ReservationNotification:
    contact = getattr(shop, "contact_json", None) or {}
    shop_phone = contact.get("phone") or contact.get("tel")
    shop_phone = normalize_contact_value(shop_phone, allow_numeric=True)

    shop_line_contact = (
        contact.get("line") or contact.get("line_url") or contact.get("line_id")
    )
    shop_line_contact = normalize_contact_value(shop_line_contact)

    notes = note_override or reservation.notes

    return ReservationNotification(
        reservation_id=str(reservation.id),
        shop_id=str(reservation.shop_id),
        shop_name=getattr(shop, "name", None) or str(reservation.shop_id),
        customer_name=reservation.customer_name,
        customer_phone=reservation.customer_phone,
        desired_start=reservation.desired_start.isoformat(),
        desired_end=reservation.desired_end.isoformat(),
        status=reservation.status,
        channel=reservation.channel or "web",
        notes=notes,
        customer_email=reservation.customer_email,
        shop_phone=shop_phone,
        shop_line_contact=shop_line_contact,
        email_recipients=[
            addr for addr in channels_config.get("emails", []) if isinstance(addr, str)
        ],
        slack_webhook_url=channels_config.get("slack"),
        line_notify_token=channels_config.get("line"),
    )


async def enqueue_reservation_notification_for_reservation(
    db: AsyncSession,
    reservation: models.Reservation,
    shop: models.Profile,
    *,
    note_override: Optional[str] = None,
) -> ReservationNotification:
    channels_config = await resolve_notification_channels(
        db, reservation.shop_id, reservation.status
    )
    notification = build_reservation_notification_payload(
        reservation,
        shop,
        channels_config,
        note_override=note_override,
    )
    await enqueue_reservation_notification(db, notification)
    return notification


__all__ = [
    "resolve_notification_channels",
    "build_reservation_notification_payload",
    "enqueue_reservation_notification_for_reservation",
]
