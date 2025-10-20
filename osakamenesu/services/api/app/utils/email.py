from __future__ import annotations

import asyncio
import logging
from typing import Iterable, Sequence

import httpx

from ..settings import settings

logger = logging.getLogger("app.mail")


class MailNotConfiguredError(RuntimeError):
    """Raised when MAIL_APIKEY が未設定の場合に送信を試みたことを示す。"""


def _normalize_recipients(to: str | Iterable[str]) -> list[str]:
    if isinstance(to, str):
        recipients = [to]
    else:
        recipients = [addr for addr in to if addr]

    if not recipients:
        raise ValueError("recipient list is empty")

    return recipients


async def send_email_async(
    *,
    to: str | Sequence[str],
    subject: str,
    html: str,
    text: str | None = None,
    tags: Sequence[str] | None = None,
) -> dict:
    """
    Resend API を利用してメールを送信する。

    Returns:
        Resend API が返す JSON レスポンス。
    Raises:
        MailNotConfiguredError: API キーが設定されていない場合。
        httpx.HTTPStatusError: Resend がエラーを返した場合。
    """

    if not settings.mail_api_key:
        raise MailNotConfiguredError("MAIL_APIKEY is not configured")

    recipients = _normalize_recipients(to)

    payload: dict[str, object] = {
        "from": settings.mail_from_address,
        "to": recipients,
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    if tags:
        payload["tags"] = [{"name": tag} for tag in tags]

    headers = {
        "Authorization": f"Bearer {settings.mail_api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(base_url=settings.mail_provider_base_url, timeout=10.0) as client:
        response = await client.post("/emails", json=payload, headers=headers)

    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error(
            "mail_send_failed",
            extra={
                "status_code": exc.response.status_code,
                "body": exc.response.text,
                "subject": subject,
                "recipients": recipients,
            },
        )
        raise

    logger.info("mail_sent", extra={"recipients": recipients, "subject": subject})
    return response.json()


def send_email(
    *,
    to: str | Sequence[str],
    subject: str,
    html: str,
    text: str | None = None,
    tags: Sequence[str] | None = None,
) -> dict:
    """
    非同期関数のラッパ。同期コンテキストから呼び出すためのヘルパー。

    FastAPI のエンドポイント内では send_email_async を await すること。
    """

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(send_email_async(to=to, subject=subject, html=html, text=text, tags=tags))
    else:
        raise RuntimeError("send_email cannot be used inside an active event loop; use send_email_async instead")
