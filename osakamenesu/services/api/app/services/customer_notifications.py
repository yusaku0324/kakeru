"""Customer notification services for reservation confirmations."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from ..models import Reservation, Profile
from ..settings import settings
from ..utils.email import send_email_async, MailNotConfiguredError

logger = logging.getLogger("app.customer_notifications")


def _format_datetime_jp(dt: datetime) -> str:
    """Format datetime in Japanese style."""
    return dt.strftime("%Y年%m月%d日 %H:%M")


def _build_customer_confirmation_html(
    reservation: Reservation,
    shop: Profile,
) -> str:
    """Build HTML email for customer reservation confirmation."""
    status_label = {
        "pending": "受付中",
        "confirmed": "確定",
        "declined": "お断り",
        "cancelled": "キャンセル",
    }.get(reservation.status, reservation.status)

    status_message = {
        "pending": "ご予約を受け付けました。店舗からの確認をお待ちください。",
        "confirmed": "ご予約が確定しました。ご来店をお待ちしております。",
        "declined": "申し訳ございませんが、ご希望の日時でのご予約をお受けすることができませんでした。",
        "cancelled": "ご予約がキャンセルされました。",
    }.get(reservation.status, "")

    contact = getattr(shop, "contact_json", None) or {}
    shop_phone = contact.get("phone") or contact.get("tel") or "-"
    shop_line = contact.get("line") or contact.get("line_id") or ""

    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }}
    .header {{ background: linear-gradient(135deg, #4A90A4, #357A8C); color: white; padding: 30px 20px; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 24px; }}
    .status-badge {{ display: inline-block; margin-top: 10px; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; }}
    .status-pending {{ background: rgba(255,255,255,0.2); }}
    .status-confirmed {{ background: #10B981; }}
    .status-declined {{ background: #EF4444; }}
    .content {{ padding: 30px 20px; background: #fff; }}
    .message {{ background: #F3F4F6; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; }}
    .details {{ border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; }}
    .detail-row {{ display: flex; border-bottom: 1px solid #E5E7EB; }}
    .detail-row:last-child {{ border-bottom: none; }}
    .detail-label {{ background: #F9FAFB; padding: 12px 15px; width: 120px; font-weight: 600; color: #6B7280; }}
    .detail-value {{ padding: 12px 15px; flex: 1; }}
    .shop-info {{ margin-top: 20px; padding: 15px; background: #FEF3C7; border-radius: 8px; }}
    .shop-info h3 {{ margin: 0 0 10px 0; font-size: 14px; color: #92400E; }}
    .footer {{ padding: 20px; text-align: center; font-size: 12px; color: #9CA3AF; background: #F9FAFB; }}
    .footer a {{ color: #4A90A4; }}
  </style>
</head>
<body>
  <div class="header">
    <h1>ご予約{status_label}</h1>
    <span class="status-badge status-{reservation.status}">{status_label}</span>
  </div>
  <div class="content">
    <div class="message">
      {status_message}
    </div>
    <div class="details">
      <div class="detail-row">
        <div class="detail-label">店舗名</div>
        <div class="detail-value">{shop.name}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">ご予約日時</div>
        <div class="detail-value">{_format_datetime_jp(reservation.desired_start)} 〜 {_format_datetime_jp(reservation.desired_end)}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">お名前</div>
        <div class="detail-value">{reservation.customer_name} 様</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">電話番号</div>
        <div class="detail-value">{reservation.customer_phone}</div>
      </div>
      {f'<div class="detail-row"><div class="detail-label">備考</div><div class="detail-value">{reservation.notes}</div></div>' if reservation.notes else ""}
    </div>
    <div class="shop-info">
      <h3>店舗連絡先</h3>
      <p style="margin: 5px 0;">電話: {shop_phone}</p>
      {f'<p style="margin: 5px 0;">LINE: {shop_line}</p>' if shop_line else ""}
    </div>
  </div>
  <div class="footer">
    <p>このメールは大阪メンエス.comから自動送信されています。</p>
    <p>ご不明な点がございましたら、店舗まで直接お問い合わせください。</p>
  </div>
</body>
</html>
"""


def _build_customer_confirmation_text(
    reservation: Reservation,
    shop: Profile,
) -> str:
    """Build plain text email for customer reservation confirmation."""
    status_label = {
        "pending": "受付中",
        "confirmed": "確定",
        "declined": "お断り",
        "cancelled": "キャンセル",
    }.get(reservation.status, reservation.status)

    contact = getattr(shop, "contact_json", None) or {}
    shop_phone = contact.get("phone") or contact.get("tel") or "-"

    return f"""
【ご予約{status_label}】{shop.name}

{reservation.customer_name} 様

ご予約いただきありがとうございます。

■ ご予約内容
━━━━━━━━━━━━━━━━━━━━━
店舗名: {shop.name}
日時: {_format_datetime_jp(reservation.desired_start)} 〜 {_format_datetime_jp(reservation.desired_end)}
お名前: {reservation.customer_name}
電話番号: {reservation.customer_phone}
{f"備考: {reservation.notes}" if reservation.notes else ""}
━━━━━━━━━━━━━━━━━━━━━

■ 店舗連絡先
電話: {shop_phone}

--
このメールは大阪メンエス.comから自動送信されています。
ご不明な点がございましたら、店舗まで直接お問い合わせください。
"""


async def send_customer_reservation_email(
    reservation: Reservation,
    shop: Profile,
    *,
    event: str = "created",
) -> bool:
    """
    Send reservation confirmation email to customer.

    Args:
        reservation: The reservation object
        shop: The shop profile
        event: Event type (created, confirmed, declined, cancelled)

    Returns:
        True if email was sent successfully, False otherwise
    """
    if not reservation.customer_email:
        logger.debug(
            "skip_customer_email: no email address",
            extra={"reservation_id": str(reservation.id)},
        )
        return False

    subject_prefix = {
        "created": "【予約受付】",
        "confirmed": "【予約確定】",
        "declined": "【予約不可】",
        "cancelled": "【予約キャンセル】",
        "reminder": "【ご予約リマインダー】",
    }.get(event, "【予約通知】")

    subject = f"{subject_prefix} {shop.name} - 大阪メンエス.com"
    html = _build_customer_confirmation_html(reservation, shop)
    text = _build_customer_confirmation_text(reservation, shop)

    try:
        await send_email_async(
            to=reservation.customer_email,
            subject=subject,
            html=html,
            text=text,
            tags=["customer", "reservation", event],
        )
        logger.info(
            "customer_email_sent",
            extra={
                "reservation_id": str(reservation.id),
                "customer_email": reservation.customer_email,
                "event": event,
            },
        )
        return True
    except MailNotConfiguredError:
        logger.warning(
            "customer_email_skipped: mail not configured",
            extra={"reservation_id": str(reservation.id)},
        )
        return False
    except Exception as exc:
        logger.error(
            "customer_email_failed",
            extra={
                "reservation_id": str(reservation.id),
                "error": str(exc),
            },
        )
        return False


__all__ = ["send_customer_reservation_email"]
