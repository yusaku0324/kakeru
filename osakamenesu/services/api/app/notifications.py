from __future__ import annotations

import asyncio
import logging
import json
from dataclasses import dataclass
from typing import Optional, Dict, Any, List

import httpx

from .settings import settings

logger = logging.getLogger("app.notifications")

SLACK_WEBHOOK = getattr(settings, "slack_webhook_url", None)
EMAIL_ENDPOINT = getattr(settings, "notify_email_endpoint", None)
LINE_ENDPOINT = getattr(settings, "notify_line_endpoint", None)


__all__ = (
    'ReservationNotification',
    'send_reservation_notification',
    'schedule_reservation_notification',
)


@dataclass
class ReservationNotification:
    reservation_id: str
    shop_id: str
    shop_name: str
    customer_name: str
    customer_phone: str
    desired_start: str
    desired_end: str
    status: str
    channel: Optional[str] = None
    notes: Optional[str] = None
    customer_email: Optional[str] = None
    shop_phone: Optional[str] = None
    shop_line_contact: Optional[str] = None
    email_recipients: Optional[List[str]] = None
    slack_webhook_url: Optional[str] = None
    line_notify_token: Optional[str] = None


async def _post_json(url: str, payload: Dict[str, Any]) -> None:
    async with httpx.AsyncClient(timeout=5.0) as client:
        await client.post(url, json=payload)


async def send_reservation_notification(payload: ReservationNotification) -> None:
    tasks = []
    message = (
        f"予約ID: {payload.reservation_id}\n"
        f"店舗: {payload.shop_name} ({payload.shop_id})\n"
        f"ステータス: {payload.status}\n"
        f"来店希望: {payload.desired_start} 〜 {payload.desired_end}\n"
        f"顧客: {payload.customer_name} ({payload.customer_phone})\n"
        f"メール: {payload.customer_email or '-'}\n"
        f"店舗電話: {payload.shop_phone or '-'}\n"
        f"店舗LINE: {payload.shop_line_contact or '-'}\n"
        f"メモ: {payload.notes or '-'}"
    )

    slack_url = payload.slack_webhook_url or SLACK_WEBHOOK
    if slack_url:
        slack_payload = {
            "text": f"*予約更新通知*: {payload.status}",
            "attachments": [
                {
                    "color": "#36a64f" if payload.status == "confirmed" else "#f4c542",
                    "text": message,
                }
            ],
        }
        tasks.append(_post_json(slack_url, slack_payload))

    email_recipients = payload.email_recipients or []
    if EMAIL_ENDPOINT:
        email_payload = {
            "subject": f"予約更新: {payload.shop_name} ({payload.status})",
            "message": message,
            "reservation_id": payload.reservation_id,
            "shop_id": payload.shop_id,
        }
        if email_recipients:
            email_payload["recipients"] = email_recipients
        tasks.append(_post_json(EMAIL_ENDPOINT, email_payload))

    line_token = payload.line_notify_token
    if LINE_ENDPOINT and line_token:
        line_payload = {
            "message": message,
            "reservation_id": payload.reservation_id,
            "shop_id": payload.shop_id,
            "token": line_token,
        }
        tasks.append(_post_json(LINE_ENDPOINT, line_payload))

    if not tasks:
        logger.info("reservation_notification", extra={"payload": json.dumps(message, ensure_ascii=False)})
        return

    try:
        await asyncio.gather(*tasks)
    except Exception as exc:
        logger.warning("notification dispatch failed: %s", exc)


def fire_and_forget(coro):
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
    except RuntimeError:
        asyncio.run(coro)


def schedule_reservation_notification(payload: ReservationNotification) -> None:
    fire_and_forget(send_reservation_notification(payload))
