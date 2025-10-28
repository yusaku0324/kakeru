#!/usr/bin/env python3
"""Background scheduler to escalate pending reservations."""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.settings import settings
from app.db import engine
from app import models
from app.notifications import (
    ReservationNotification,
    enqueue_reservation_notification,
    process_pending_notifications,
)

logger = logging.getLogger("escalation")

POLL_INTERVAL = max(1, settings.escalation_check_interval_minutes) * 60
THRESHOLD = timedelta(minutes=max(1, settings.escalation_pending_threshold_minutes))
SLACK_WEBHOOK = settings.slack_webhook_url


async def escalate(session: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    threshold_time = now - THRESHOLD
    stmt = (
        select(models.Reservation)
        .where(models.Reservation.status == 'pending')
        .where(models.Reservation.created_at <= threshold_time)
    )
    res = await session.execute(stmt)
    pending = res.scalars().all()
    if not pending:
        return

    logger.warning("found %d pending reservations exceeding threshold", len(pending))

    created_jobs = False
    for reservation in pending:
        shop_res = await session.execute(select(models.Profile).where(models.Profile.id == reservation.shop_id))
        shop = shop_res.scalar_one_or_none()
        payload = ReservationNotification(
            reservation_id=str(reservation.id),
            shop_id=str(reservation.shop_id),
            shop_name=shop.name if shop else 'unknown',
            customer_name=reservation.customer_name,
            customer_phone=reservation.customer_phone,
            desired_start=reservation.desired_start.isoformat(),
            desired_end=reservation.desired_end.isoformat(),
            status=reservation.status,
            notes=reservation.notes,
            channel=reservation.channel or "web",
        )
        await enqueue_reservation_notification(session, payload)
        created_jobs = True

        if SLACK_WEBHOOK:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    SLACK_WEBHOOK,
                    json={
                        "text": f":rotating_light: 未処理予約アラート ({reservation.id})",
                        "attachments": [
                            {
                                "color": "#ff0033",
                                "fields": [
                                    {"title": "店舗", "value": payload.shop_name, "short": True},
                                    {"title": "顧客", "value": payload.customer_name, "short": True},
                                    {"title": "希望日時", "value": f"{payload.desired_start}〜", "short": False},
                                    {"title": "登録日時", "value": reservation.created_at.isoformat(), "short": False},
                                ],
                            }
                        ],
                    },
                )

    if created_jobs:
        await session.commit()
        await process_pending_notifications()


async def run_loop() -> None:
    while True:
        try:
            async with AsyncSession(engine) as session:
                await escalate(session)
        except Exception as exc:  # pragma: no cover - production diagnostic
            logger.exception("escalation loop error: %s", exc)
        await asyncio.sleep(POLL_INTERVAL)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    logger.info("starting escalation service (interval=%ss, threshold=%s)", POLL_INTERVAL, THRESHOLD)
    asyncio.run(run_loop())


if __name__ == "__main__":
    main()
