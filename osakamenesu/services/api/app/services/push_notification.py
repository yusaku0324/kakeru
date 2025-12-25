"""Push notification service for PWA."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional
import uuid

from pywebpush import webpush, WebPushException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models import PushSubscription, User
from ..settings import settings

logger = logging.getLogger(__name__)


class PushNotificationService:
    """Service for sending push notifications to PWA users."""

    def __init__(self):
        """Initialize push notification service."""
        self.vapid_private_key = settings.vapid_private_key
        self.vapid_public_key = settings.vapid_public_key
        self.vapid_claims = {
            "sub": f"mailto:{settings.mail_from_address}",
        }

    async def subscribe(
        self,
        user_id: uuid.UUID,
        subscription_info: Dict[str, Any],
        db: AsyncSession,
    ) -> PushSubscription:
        """Save push subscription for a user.

        Args:
            user_id: User ID
            subscription_info: Subscription info from browser
            db: Database session

        Returns:
            Created push subscription
        """
        # Check if subscription already exists
        existing = await db.execute(
            select(PushSubscription).where(
                PushSubscription.user_id == user_id,
                PushSubscription.endpoint == subscription_info["endpoint"],
            )
        )
        subscription = existing.scalar_one_or_none()

        if subscription:
            # Update existing subscription
            subscription.p256dh = subscription_info["keys"]["p256dh"]
            subscription.auth = subscription_info["keys"]["auth"]
            subscription.is_active = True
        else:
            # Create new subscription
            subscription = PushSubscription(
                user_id=user_id,
                endpoint=subscription_info["endpoint"],
                p256dh=subscription_info["keys"]["p256dh"],
                auth=subscription_info["keys"]["auth"],
                is_active=True,
            )
            db.add(subscription)

        await db.commit()
        await db.refresh(subscription)

        logger.info(f"Push subscription saved for user {user_id}")
        return subscription

    async def unsubscribe(
        self,
        user_id: uuid.UUID,
        endpoint: str,
        db: AsyncSession,
    ) -> bool:
        """Remove push subscription for a user.

        Args:
            user_id: User ID
            endpoint: Subscription endpoint
            db: Database session

        Returns:
            True if unsubscribed successfully
        """
        result = await db.execute(
            select(PushSubscription).where(
                PushSubscription.user_id == user_id,
                PushSubscription.endpoint == endpoint,
            )
        )
        subscription = result.scalar_one_or_none()

        if subscription:
            subscription.is_active = False
            await db.commit()
            logger.info(f"Push subscription removed for user {user_id}")
            return True

        return False

    async def send_notification(
        self,
        user_id: uuid.UUID,
        title: str,
        body: str,
        db: AsyncSession,
        url: Optional[str] = None,
        tag: Optional[str] = None,
        icon: Optional[str] = None,
        badge: Optional[str] = None,
        actions: Optional[List[Dict[str, str]]] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Send push notification to a user.

        Args:
            user_id: User ID
            title: Notification title
            body: Notification body
            db: Database session
            url: URL to open when notification is clicked
            tag: Notification tag for grouping
            icon: Icon URL
            badge: Badge icon URL
            actions: List of action buttons
            data: Additional data

        Returns:
            Number of notifications sent
        """
        # Get active subscriptions for user
        result = await db.execute(
            select(PushSubscription).where(
                PushSubscription.user_id == user_id,
                PushSubscription.is_active == True,
            )
        )
        subscriptions = result.scalars().all()

        if not subscriptions:
            logger.warning(f"No active push subscriptions for user {user_id}")
            return 0

        # Prepare notification payload
        payload = {
            "title": title,
            "body": body,
            "icon": icon or "/icons/icon-192x192.png",
            "badge": badge or "/icons/badge-72x72.png",
            "tag": tag,
            "data": {
                "url": url or "/",
                **(data or {}),
            },
        }

        if actions:
            payload["actions"] = actions

        sent_count = 0
        failed_endpoints = []

        # Send to all active subscriptions
        for subscription in subscriptions:
            try:
                self._send_webpush(
                    subscription_info={
                        "endpoint": subscription.endpoint,
                        "keys": {
                            "p256dh": subscription.p256dh,
                            "auth": subscription.auth,
                        },
                    },
                    data=json.dumps(payload),
                )
                sent_count += 1
                logger.debug(f"Push notification sent to {subscription.endpoint}")

            except WebPushException as e:
                logger.error(f"Failed to send push notification: {e}")

                # Handle invalid subscriptions
                if e.response and e.response.status_code in [404, 410]:
                    failed_endpoints.append(subscription.endpoint)

        # Remove failed subscriptions
        if failed_endpoints:
            await self._remove_failed_subscriptions(db, failed_endpoints)

        logger.info(f"Sent {sent_count} push notifications for user {user_id}")
        return sent_count

    async def send_bulk_notification(
        self,
        title: str,
        body: str,
        db: AsyncSession,
        user_ids: Optional[List[uuid.UUID]] = None,
        url: Optional[str] = None,
        tag: Optional[str] = None,
        **kwargs,
    ) -> int:
        """Send push notification to multiple users.

        Args:
            title: Notification title
            body: Notification body
            db: Database session
            user_ids: List of user IDs (None for all users)
            url: URL to open when notification is clicked
            tag: Notification tag
            **kwargs: Additional notification options

        Returns:
            Total number of notifications sent
        """
        # Build query
        query = select(PushSubscription).where(PushSubscription.is_active == True)

        if user_ids:
            query = query.where(PushSubscription.user_id.in_(user_ids))

        result = await db.execute(query)
        subscriptions = result.scalars().all()

        if not subscriptions:
            logger.warning("No active push subscriptions found")
            return 0

        # Group by user
        user_subscriptions = {}
        for subscription in subscriptions:
            if subscription.user_id not in user_subscriptions:
                user_subscriptions[subscription.user_id] = []
            user_subscriptions[subscription.user_id].append(subscription)

        # Send notifications
        total_sent = 0
        for user_id, user_subs in user_subscriptions.items():
            sent = await self.send_notification(
                user_id=user_id,
                title=title,
                body=body,
                db=db,
                url=url,
                tag=tag,
                **kwargs,
            )
            total_sent += sent

        logger.info(
            f"Sent {total_sent} push notifications to {len(user_subscriptions)} users"
        )
        return total_sent

    async def notify_reservation_confirmation(
        self,
        user_id: uuid.UUID,
        reservation_id: uuid.UUID,
        shop_name: str,
        therapist_name: str,
        date: str,
        time: str,
        db: AsyncSession,
    ) -> int:
        """Send reservation confirmation notification.

        Args:
            user_id: User ID
            reservation_id: Reservation ID
            shop_name: Shop name
            therapist_name: Therapist name
            date: Reservation date
            time: Reservation time
            db: Database session

        Returns:
            Number of notifications sent
        """
        return await self.send_notification(
            user_id=user_id,
            title="予約が確定しました",
            body=f"{shop_name}の{therapist_name}さん\n{date} {time}",
            db=db,
            url=f"/reservations/{reservation_id}",
            tag="reservation-confirmation",
            actions=[
                {
                    "action": "view",
                    "title": "詳細を見る",
                },
                {
                    "action": "calendar",
                    "title": "カレンダーに追加",
                },
            ],
            data={
                "type": "reservation_confirmation",
                "reservation_id": reservation_id,
            },
        )

    async def notify_reservation_reminder(
        self,
        user_id: uuid.UUID,
        reservation_id: uuid.UUID,
        shop_name: str,
        therapist_name: str,
        time_until: str,
        db: AsyncSession,
    ) -> int:
        """Send reservation reminder notification.

        Args:
            user_id: User ID
            reservation_id: Reservation ID
            shop_name: Shop name
            therapist_name: Therapist name
            time_until: Time until reservation (e.g., "1時間後")
            db: Database session

        Returns:
            Number of notifications sent
        """
        return await self.send_notification(
            user_id=user_id,
            title="予約のリマインダー",
            body=f"{shop_name}での予約が{time_until}にあります",
            db=db,
            url=f"/reservations/{reservation_id}",
            tag="reservation-reminder",
            data={
                "type": "reservation_reminder",
                "reservation_id": reservation_id,
            },
        )

    async def notify_new_review_reply(
        self,
        user_id: uuid.UUID,
        shop_name: str,
        db: AsyncSession,
    ) -> int:
        """Send notification for new review reply.

        Args:
            user_id: User ID
            shop_name: Shop name
            db: Database session

        Returns:
            Number of notifications sent
        """
        return await self.send_notification(
            user_id=user_id,
            title="レビューに返信がありました",
            body=f"{shop_name}からあなたのレビューに返信がありました",
            db=db,
            url="/reviews",
            tag="review-reply",
            data={
                "type": "review_reply",
            },
        )

    def _send_webpush(self, subscription_info: Dict[str, Any], data: str) -> None:
        """Send web push notification.

        Args:
            subscription_info: Subscription information
            data: Notification data as JSON string
        """
        webpush(
            subscription_info=subscription_info,
            data=data,
            vapid_private_key=self.vapid_private_key,
            vapid_claims=self.vapid_claims,
        )

    async def _remove_failed_subscriptions(
        self,
        db: AsyncSession,
        endpoints: List[str],
    ) -> None:
        """Remove failed subscriptions.

        Args:
            db: Database session
            endpoints: List of failed endpoints
        """
        result = await db.execute(
            select(PushSubscription).where(PushSubscription.endpoint.in_(endpoints))
        )
        subscriptions = result.scalars().all()

        for subscription in subscriptions:
            subscription.is_active = False

        await db.commit()
        logger.info(f"Removed {len(subscriptions)} failed push subscriptions")


# Service instance
push_notification_service = PushNotificationService()
