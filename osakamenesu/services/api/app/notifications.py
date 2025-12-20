"""Legacy notification system - deprecated and stubbed out.

The notification system that was previously used for old Reservation notifications
has been removed. A new notification system for GuestReservation may be added later.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger("app.notifications")

__all__ = (
    "ReservationNotification",
    "is_notification_worker_enabled",
)


@dataclass
class ReservationNotification:
    """Legacy notification payload - kept for backward compatibility."""

    reservation_id: str = ""
    shop_id: str = ""
    shop_name: str = ""
    customer_name: str = ""
    customer_phone: str = ""
    desired_start: str = ""
    desired_end: str = ""
    status: str = ""
    channel: Optional[str] = None
    notes: Optional[str] = None
    customer_email: Optional[str] = None
    shop_phone: Optional[str] = None
    shop_line_contact: Optional[str] = None
    email_recipients: Optional[List[str]] = None
    slack_webhook_url: Optional[str] = None
    line_notify_token: Optional[str] = None
    reminder_at: Optional[str] = None
    audience: Optional[str] = None
    event: Optional[str] = None


def is_notification_worker_enabled() -> bool:
    """Legacy notification worker is always disabled."""
    return False
