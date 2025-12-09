"""Review notification utilities for notifying shops when new reviews are submitted."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from . import models
from .settings import settings

logger = logging.getLogger("app.review_notifications")

EMAIL_ENDPOINT = getattr(settings, "notify_email_endpoint", None)
LINE_ENDPOINT = getattr(settings, "notify_line_endpoint", None)


async def _post_json(url: str, payload: Dict[str, Any]) -> httpx.Response:
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response


def _build_review_notification_message(
    review: models.Review,
    shop_name: str,
) -> str:
    score_stars = "★" * review.score + "☆" * (5 - review.score)
    return (
        f"【新しい口コミが投稿されました】\n"
        f"店舗: {shop_name}\n"
        f"評価: {score_stars} ({review.score}点)\n"
        f"投稿者: {review.author_alias or '匿名'}\n"
        f"タイトル: {review.title or '-'}\n"
        f"内容: {review.body[:100]}{'...' if len(review.body) > 100 else ''}\n\n"
        f"ダッシュボードから承認・非承認を設定してください。"
    )


async def _send_review_notification_email(
    recipients: list[str],
    review: models.Review,
    shop_name: str,
) -> bool:
    if not EMAIL_ENDPOINT:
        logger.debug("email endpoint not configured, skipping email notification")
        return False

    if not recipients:
        return False

    message = _build_review_notification_message(review, shop_name)

    try:
        await _post_json(
            EMAIL_ENDPOINT,
            {
                "subject": f"【{shop_name}】新しい口コミが投稿されました",
                "message": message,
                "recipients": recipients,
                "review_id": str(review.id),
                "shop_id": str(review.profile_id),
            },
        )
        logger.info(
            "review_notification_email_sent",
            extra={
                "review_id": str(review.id),
                "shop_id": str(review.profile_id),
                "recipients": recipients,
            },
        )
        return True
    except Exception as exc:
        logger.warning(
            "review_notification_email_failed",
            extra={
                "review_id": str(review.id),
                "error": str(exc),
            },
        )
        return False


async def _send_review_notification_line(
    token: str,
    review: models.Review,
    shop_name: str,
) -> bool:
    if not LINE_ENDPOINT:
        logger.debug("line endpoint not configured, skipping line notification")
        return False

    if not token:
        return False

    message = _build_review_notification_message(review, shop_name)

    try:
        await _post_json(
            LINE_ENDPOINT,
            {
                "message": message,
                "token": token,
                "review_id": str(review.id),
                "shop_id": str(review.profile_id),
            },
        )
        logger.info(
            "review_notification_line_sent",
            extra={
                "review_id": str(review.id),
                "shop_id": str(review.profile_id),
            },
        )
        return True
    except Exception as exc:
        logger.warning(
            "review_notification_line_failed",
            extra={
                "review_id": str(review.id),
                "error": str(exc),
            },
        )
        return False


async def send_review_notification(
    db: AsyncSession,
    review: models.Review,
) -> Dict[str, bool]:
    """Send notifications to the shop when a new review is submitted.

    Looks up the shop's notification settings and sends to configured channels.
    Returns a dict indicating which channels were successfully notified.
    """
    results: Dict[str, bool] = {"email": False, "line": False}

    profile = await db.get(models.Profile, review.profile_id)
    if not profile:
        logger.warning(
            "profile not found for review notification",
            extra={"review_id": str(review.id)},
        )
        return results

    shop_name = profile.name or "店舗"

    stmt = select(models.DashboardNotificationSetting).where(
        models.DashboardNotificationSetting.profile_id == review.profile_id
    )
    result = await db.execute(stmt)
    notification_setting = result.scalar_one_or_none()

    if not notification_setting:
        logger.info(
            "no notification settings for shop",
            extra={"review_id": str(review.id), "shop_id": str(review.profile_id)},
        )
        return results

    channels = notification_setting.channels or {}

    email_config = channels.get("email", {})
    if email_config.get("enabled"):
        recipients = email_config.get("recipients", [])
        results["email"] = await _send_review_notification_email(
            recipients, review, shop_name
        )

    line_config = channels.get("line", {})
    if line_config.get("enabled"):
        token = line_config.get("token")
        if token:
            results["line"] = await _send_review_notification_line(
                token, review, shop_name
            )

    return results
