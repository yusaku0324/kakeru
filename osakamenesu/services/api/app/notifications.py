from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Awaitable, Callable, Dict, List, Optional
import uuid

import httpx
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from . import models
from .db import SessionLocal
from .settings import settings

logger = logging.getLogger("app.notifications")

SLACK_WEBHOOK = getattr(settings, "slack_webhook_url", None)
EMAIL_ENDPOINT = getattr(settings, "notify_email_endpoint", None)
LINE_ENDPOINT = getattr(settings, "notify_line_endpoint", None)


__all__ = (
    "ReservationNotification",
    "enqueue_reservation_notification",
    "process_pending_notifications",
    "start_notification_worker",
    "stop_notification_worker",
)


def _now() -> datetime:
    return datetime.now(UTC)


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

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


async def _post_json(url: str, payload: Dict[str, Any]) -> httpx.Response:
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response


def _build_message(payload: ReservationNotification) -> str:
    return (
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


def _coerce_uuid(value: Any) -> uuid.UUID:
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(str(value))


def _channel_configs(payload: ReservationNotification) -> List[tuple[str, Dict[str, Any]]]:
    configs: List[tuple[str, Dict[str, Any]]] = []

    slack_url = payload.slack_webhook_url or SLACK_WEBHOOK
    if slack_url:
        configs.append(("slack", {"webhook_url": slack_url}))

    if EMAIL_ENDPOINT:
        recipients = [addr for addr in (payload.email_recipients or []) if isinstance(addr, str)]
        configs.append(("email", {"recipients": recipients}))

    line_token = payload.line_notify_token
    if LINE_ENDPOINT and line_token:
        configs.append(("line", {"token": line_token}))

    if not configs:
        configs.append(("log", {}))

    return configs


async def enqueue_reservation_notification(
    db: AsyncSession,
    payload: ReservationNotification,
) -> List[models.ReservationNotificationDelivery]:
    configs = _channel_configs(payload)
    if not configs:
        return []

    deliveries: List[models.ReservationNotificationDelivery] = []
    message = _build_message(payload)
    base_payload = payload.to_dict()
    now = _now()

    reservation_uuid = _coerce_uuid(payload.reservation_id)

    for channel, config in configs:
        job_payload = {
            "notification": base_payload,
            "config": config,
            "message": message,
        }
        delivery = models.ReservationNotificationDelivery(
            reservation_id=reservation_uuid,
            channel=channel,
            status="pending",
            payload=job_payload,
            attempt_count=0,
            next_attempt_at=now,
        )
        deliveries.append(delivery)

    db.add_all(deliveries)
    await db.flush()
    return deliveries


def _retry_delay_seconds(attempt: int) -> float:
    base = max(1, int(settings.reservation_notification_retry_base_seconds))
    multiplier = max(1.0, float(settings.reservation_notification_retry_backoff_multiplier))
    attempt_index = max(0, attempt - 1)
    delay = base * (multiplier ** attempt_index)
    return float(min(delay, 3600))


async def _send_via_slack(
    payload: ReservationNotification,
    message: str,
    config: Dict[str, Any],
) -> Optional[httpx.Response]:
    webhook = config.get("webhook_url")
    if not webhook:
        raise ValueError("slack webhook url is required")

    slack_payload = {
        "text": f"*予約更新通知*: {payload.status}",
        "attachments": [
            {
                "color": "#36a64f" if payload.status == "confirmed" else "#f4c542",
                "text": message,
            }
        ],
    }
    return await _post_json(webhook, slack_payload)


async def _send_via_email(
    payload: ReservationNotification,
    message: str,
    config: Dict[str, Any],
) -> Optional[httpx.Response]:
    if not EMAIL_ENDPOINT:
        raise RuntimeError("email notification endpoint is not configured")

    email_payload: Dict[str, Any] = {
        "subject": f"予約更新: {payload.shop_name} ({payload.status})",
        "message": message,
        "reservation_id": payload.reservation_id,
        "shop_id": payload.shop_id,
    }
    recipients = [addr for addr in config.get("recipients", []) if isinstance(addr, str)]
    if recipients:
        email_payload["recipients"] = recipients

    return await _post_json(EMAIL_ENDPOINT, email_payload)


async def _send_via_line(
    payload: ReservationNotification,
    message: str,
    config: Dict[str, Any],
) -> Optional[httpx.Response]:
    if not LINE_ENDPOINT:
        raise RuntimeError("line notification endpoint is not configured")

    token = config.get("token")
    if not token:
        raise ValueError("line notify token is required")

    line_payload = {
        "message": message,
        "reservation_id": payload.reservation_id,
        "shop_id": payload.shop_id,
        "token": token,
    }
    return await _post_json(LINE_ENDPOINT, line_payload)


async def _send_via_log(
    payload: ReservationNotification,
    message: str,
    config: Dict[str, Any],
) -> None:
    logger.info("reservation_notification_log", extra={"reservation_id": payload.reservation_id, "message": message})
    return None


ChannelSender = Callable[[ReservationNotification, str, Dict[str, Any]], Awaitable[Optional[httpx.Response]]]

CHANNEL_SENDERS: Dict[str, ChannelSender] = {
    "slack": _send_via_slack,
    "email": _send_via_email,
    "line": _send_via_line,
    "log": _send_via_log,
}


async def _dispatch_delivery(
    session: AsyncSession,
    delivery: models.ReservationNotificationDelivery,
    *,
    senders: Optional[Dict[str, ChannelSender]] = None,
    now: Optional[datetime] = None,
) -> bool:
    now = now or _now()
    senders = senders or CHANNEL_SENDERS

    if delivery.status not in {"pending", "in_progress"}:
        return False

    payload_dict: Dict[str, Any] = delivery.payload or {}
    notification_data = payload_dict.get("notification", {})
    message = payload_dict.get("message")
    config = payload_dict.get("config", {})

    notification = ReservationNotification(**notification_data)
    if not message:
        message = _build_message(notification)

    delivery.status = "in_progress"
    delivery.attempt_count = (delivery.attempt_count or 0) + 1
    delivery.last_attempt_at = now

    attempt = models.ReservationNotificationAttempt(
        delivery_id=delivery.id,
        status="failure",
        attempted_at=now,
    )
    session.add(attempt)

    sender = senders.get(delivery.channel)
    if sender is None:
        raise RuntimeError(f"unsupported notification channel: {delivery.channel}")

    try:
        response = await sender(notification, message, config)
    except Exception as exc:  # pragma: no cover - exercised via tests for retry logic
        delivery.last_error = str(exc)
        max_attempts = max(1, int(settings.reservation_notification_max_attempts))
        if delivery.attempt_count >= max_attempts:
            delivery.status = "failed"
            delivery.next_attempt_at = None
        else:
            delivery.status = "pending"
            delay = _retry_delay_seconds(delivery.attempt_count)
            delivery.next_attempt_at = now + timedelta(seconds=delay)
        attempt.status = "failure"
        attempt.error_message = str(exc)
        await session.flush()
        logger.warning(
            "reservation_notification_failed",
            extra={
                "delivery_id": str(delivery.id),
                "channel": delivery.channel,
                "attempt": delivery.attempt_count,
                "error": str(exc),
            },
        )
        return False

    delivery.status = "succeeded"
    delivery.next_attempt_at = None
    delivery.last_error = None
    attempt.status = "success"
    if response is not None:
        attempt.response_status = getattr(response, "status_code", None)

    await session.flush()
    return True


async def process_pending_notifications(
    *,
    batch_size: Optional[int] = None,
    senders: Optional[Dict[str, ChannelSender]] = None,
) -> int:
    processed = 0
    batch_limit = batch_size or settings.reservation_notification_batch_size
    now = _now()

    async with SessionLocal() as session:
        stmt = (
            select(models.ReservationNotificationDelivery)
            .where(
                models.ReservationNotificationDelivery.status == "pending",
                or_(
                    models.ReservationNotificationDelivery.next_attempt_at.is_(None),
                    models.ReservationNotificationDelivery.next_attempt_at <= now,
                ),
            )
            .order_by(models.ReservationNotificationDelivery.next_attempt_at)
            .limit(batch_limit)
        )
        result = await session.execute(stmt)
        deliveries = list(result.scalars())
        if not deliveries:
            return 0

        for delivery in deliveries:
            handled = await _dispatch_delivery(session, delivery, senders=senders, now=now)
            if handled:
                processed += 1

        await session.commit()

    return processed


_worker_task: Optional[asyncio.Task] = None
_worker_stop: Optional[asyncio.Event] = None


async def _worker_loop(stop_event: asyncio.Event) -> None:
    interval = max(0.5, float(settings.reservation_notification_worker_interval_seconds))
    batch_size = settings.reservation_notification_batch_size

    while not stop_event.is_set():
        try:
            processed = await process_pending_notifications(batch_size=batch_size)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.exception("notification worker iteration failed: %s", exc)
            processed = 0

        if processed == 0:
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=interval)
            except asyncio.TimeoutError:
                continue


async def start_notification_worker() -> None:
    global _worker_task, _worker_stop
    if _worker_task and not _worker_task.done():
        return

    _worker_stop = asyncio.Event()
    _worker_task = asyncio.create_task(_worker_loop(_worker_stop))


async def stop_notification_worker() -> None:
    global _worker_task, _worker_stop
    if _worker_stop is not None:
        _worker_stop.set()
    if _worker_task is not None:
        try:
            await _worker_task
        finally:
            _worker_task = None
            _worker_stop = None
