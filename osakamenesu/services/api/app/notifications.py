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
from .utils.email import send_email_async, MailNotConfiguredError

logger = logging.getLogger("app.notifications")

SLACK_WEBHOOK = getattr(settings, "slack_webhook_url", None)
EMAIL_ENDPOINT = getattr(settings, "notify_email_endpoint", None)
LINE_ENDPOINT = getattr(settings, "notify_line_endpoint", None)
# Check if Resend email is configured
RESEND_CONFIGURED = bool(settings.mail_api_key)


__all__ = (
    "ReservationNotification",
    "enqueue_reservation_notification",
    "dispatch_delivery_by_id",
    "process_pending_notifications",
    "start_notification_worker",
    "stop_notification_worker",
    "is_notification_worker_enabled",
    "run_worker_forever",
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
    reminder_at: Optional[str] = None
    audience: Optional[str] = None
    event: Optional[str] = None

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


def _channel_configs(
    payload: ReservationNotification,
) -> List[tuple[str, Dict[str, Any]]]:
    configs: List[tuple[str, Dict[str, Any]]] = []

    slack_url = payload.slack_webhook_url or SLACK_WEBHOOK
    if slack_url:
        configs.append(("slack", {"webhook_url": slack_url}))

    # Email channel: prefer Resend direct send, fall back to endpoint if configured
    recipients = [
        addr for addr in (payload.email_recipients or []) if isinstance(addr, str)
    ]
    if recipients and (RESEND_CONFIGURED or EMAIL_ENDPOINT):
        configs.append(
            ("email", {"recipients": recipients, "use_resend": RESEND_CONFIGURED})
        )

    # LINE Notify: direct API call (no endpoint needed)
    line_token = payload.line_notify_token
    if line_token:
        configs.append(("line", {"token": line_token}))

    if not configs:
        configs.append(("log", {}))

    return configs


async def enqueue_reservation_notification(
    db: AsyncSession,
    payload: ReservationNotification,
    *,
    schedule_at: datetime | None = None,
) -> List[models.ReservationNotificationDelivery]:
    configs = _channel_configs(payload)
    if not configs:
        return []

    deliveries: List[models.ReservationNotificationDelivery] = []
    message = _build_message(payload)
    base_payload = payload.to_dict()
    now = _now()
    scheduled_for = schedule_at.astimezone(UTC) if schedule_at else now

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
            next_attempt_at=scheduled_for,
        )
        deliveries.append(delivery)

    db.add_all(deliveries)
    await db.flush()
    return deliveries


def _retry_delay_seconds(attempt: int) -> float:
    base = max(1, int(settings.reservation_notification_retry_base_seconds))
    multiplier = max(
        1.0, float(settings.reservation_notification_retry_backoff_multiplier)
    )
    attempt_index = max(0, attempt - 1)
    delay = base * (multiplier**attempt_index)
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


def _build_email_html(payload: ReservationNotification, message: str) -> str:
    """Build HTML email body for reservation notification."""
    status_label = {
        "pending": "受付中",
        "confirmed": "確定",
        "declined": "お断り",
        "cancelled": "キャンセル",
        "expired": "期限切れ",
    }.get(payload.status, payload.status)

    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: sans-serif; line-height: 1.6; color: #333; }}
    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
    .header {{ background: #4A90A4; color: white; padding: 20px; text-align: center; }}
    .content {{ padding: 20px; background: #f9f9f9; }}
    .info-row {{ padding: 8px 0; border-bottom: 1px solid #eee; }}
    .label {{ font-weight: bold; color: #666; }}
    .status {{ display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; }}
    .status-pending {{ background: #FEF3C7; color: #92400E; }}
    .status-confirmed {{ background: #D1FAE5; color: #065F46; }}
    .status-declined {{ background: #FEE2E2; color: #991B1B; }}
    .footer {{ padding: 20px; text-align: center; font-size: 12px; color: #666; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>予約通知</h1>
    </div>
    <div class="content">
      <div class="info-row">
        <span class="label">店舗:</span> {payload.shop_name}
      </div>
      <div class="info-row">
        <span class="label">ステータス:</span>
        <span class="status status-{payload.status}">{status_label}</span>
      </div>
      <div class="info-row">
        <span class="label">来店希望日時:</span> {payload.desired_start} 〜 {payload.desired_end}
      </div>
      <div class="info-row">
        <span class="label">お客様名:</span> {payload.customer_name}
      </div>
      <div class="info-row">
        <span class="label">電話番号:</span> {payload.customer_phone}
      </div>
      {f'<div class="info-row"><span class="label">メモ:</span> {payload.notes}</div>' if payload.notes else ""}
    </div>
    <div class="footer">
      このメールは大阪メンエス.comから自動送信されています。
    </div>
  </div>
</body>
</html>
"""


async def _send_via_email(
    payload: ReservationNotification,
    message: str,
    config: Dict[str, Any],
) -> Optional[httpx.Response]:
    recipients = [
        addr for addr in config.get("recipients", []) if isinstance(addr, str)
    ]
    if not recipients:
        raise ValueError("email recipients list is empty")

    use_resend = config.get("use_resend", False)
    subject = f"予約更新: {payload.shop_name} ({payload.status})"

    # Use Resend direct send if configured
    if use_resend:
        html = _build_email_html(payload, message)
        try:
            await send_email_async(
                to=recipients,
                subject=subject,
                html=html,
                text=message,
                tags=["reservation", payload.status],
            )
            logger.info(
                "email_sent_via_resend",
                extra={
                    "recipients": recipients,
                    "reservation_id": payload.reservation_id,
                },
            )
            return None  # Resend doesn't return httpx.Response
        except MailNotConfiguredError:
            logger.warning("resend_not_configured, falling back to endpoint")
            # Fall through to endpoint-based send

    # Fallback to endpoint-based send
    if not EMAIL_ENDPOINT:
        raise RuntimeError("email notification endpoint is not configured")

    email_payload: Dict[str, Any] = {
        "subject": subject,
        "message": message,
        "reservation_id": payload.reservation_id,
        "shop_id": payload.shop_id,
        "recipients": recipients,
    }

    return await _post_json(EMAIL_ENDPOINT, email_payload)


LINE_NOTIFY_API_URL = "https://notify-api.line.me/api/notify"


async def _send_via_line(
    payload: ReservationNotification,
    message: str,
    config: Dict[str, Any],
) -> Optional[httpx.Response]:
    token = config.get("token")
    if not token:
        raise ValueError("line notify token is required")

    # Use direct LINE Notify API call
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    # Build LINE-formatted message
    line_message = _build_line_message(payload, message)

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            LINE_NOTIFY_API_URL,
            headers=headers,
            data={"message": line_message},
        )
        response.raise_for_status()

    logger.info(
        "line_notify_sent",
        extra={
            "reservation_id": payload.reservation_id,
            "shop_id": payload.shop_id,
            "status_code": response.status_code,
        },
    )
    return response


def _build_line_message(payload: ReservationNotification, message: str) -> str:
    """Build a formatted message for LINE Notify."""
    status_label = {
        "pending": "受付中",
        "confirmed": "確定",
        "declined": "お断り",
        "cancelled": "キャンセル",
        "expired": "期限切れ",
    }.get(payload.status, payload.status)

    status_emoji = {
        "pending": "🔔",
        "confirmed": "✅",
        "declined": "❌",
        "cancelled": "🚫",
        "expired": "⏰",
    }.get(payload.status, "📋")

    return f"""
{status_emoji} 予約通知: {status_label}

📍 {payload.shop_name}
👤 {payload.customer_name}
📞 {payload.customer_phone}
🕐 {payload.desired_start} 〜 {payload.desired_end}
{f"📝 {payload.notes}" if payload.notes else ""}
""".strip()


async def _send_via_log(
    payload: ReservationNotification,
    message: str,
    config: Dict[str, Any],
) -> None:
    logger.info(
        "reservation_notification_log: %s",
        message,
        extra={
            "reservation_id": payload.reservation_id,
            "shop_id": payload.shop_id,
        },
    )
    return None


ChannelSender = Callable[
    [ReservationNotification, str, Dict[str, Any]], Awaitable[Optional[httpx.Response]]
]

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


async def dispatch_delivery_by_id(
    session: AsyncSession,
    delivery_id: uuid.UUID,
    *,
    senders: Optional[Dict[str, ChannelSender]] = None,
) -> bool:
    result = await session.execute(
        select(models.ReservationNotificationDelivery).where(
            models.ReservationNotificationDelivery.id == delivery_id
        )
    )
    delivery = result.scalar_one_or_none()
    if delivery is None:
        raise LookupError("delivery_not_found")
    return await _dispatch_delivery(session, delivery, senders=senders)


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
            handled = await _dispatch_delivery(
                session, delivery, senders=senders, now=now
            )
            if handled:
                processed += 1

        await session.commit()

    return processed


_worker_task: Optional[asyncio.Task] = None
_worker_stop: Optional[asyncio.Event] = None


async def _worker_loop(stop_event: asyncio.Event) -> None:
    interval = max(
        0.5, float(settings.reservation_notification_worker_interval_seconds)
    )
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
    logger.warning(
        "start_notification_worker is deprecated. Launch the dedicated notifications worker process instead.",
    )
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


def is_notification_worker_enabled() -> bool:
    return _worker_task is not None and not _worker_task.done()


async def run_worker_forever(stop_event: asyncio.Event | None = None) -> None:
    """Entry point for the standalone notifications worker process."""
    event = stop_event or asyncio.Event()
    await _worker_loop(event)
