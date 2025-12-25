"""Push notification API endpoints."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Annotated, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_session
from ...deps import get_optional_site_user
from ...models import User
from ...services.push_notification import push_notification_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/push",
    tags=["push"],
)


class PushSubscriptionRequest(BaseModel):
    """Push subscription request model."""

    endpoint: str
    keys: Dict[str, str]  # p256dh and auth
    expirationTime: int | None = None


class PushSubscriptionResponse(BaseModel):
    """Push subscription response model."""

    success: bool
    message: str


class TestNotificationRequest(BaseModel):
    """Test notification request model."""

    title: str = "テスト通知"
    body: str = "これはテスト通知です"
    url: str | None = None


@router.post("/subscribe", response_model=PushSubscriptionResponse)
async def subscribe_to_push(
    subscription: PushSubscriptionRequest,
    current_user: Annotated[User, Depends(get_optional_site_user)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> PushSubscriptionResponse:
    """Subscribe to push notifications.

    Args:
        subscription: Push subscription information from browser
        current_user: Current authenticated user
        db: Database session

    Returns:
        Success response
    """
    try:
        await push_notification_service.subscribe(
            user_id=current_user.id,
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": subscription.keys,
                "expirationTime": subscription.expirationTime,
            },
            db=db,
        )

        logger.info(f"User {current_user.id} subscribed to push notifications")

        return PushSubscriptionResponse(
            success=True,
            message="プッシュ通知の登録が完了しました",
        )

    except Exception as e:
        logger.error(f"Failed to subscribe to push notifications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="プッシュ通知の登録に失敗しました",
        )


@router.post("/unsubscribe", response_model=PushSubscriptionResponse)
async def unsubscribe_from_push(
    subscription: PushSubscriptionRequest,
    current_user: Annotated[User, Depends(get_optional_site_user)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> PushSubscriptionResponse:
    """Unsubscribe from push notifications.

    Args:
        subscription: Push subscription information
        current_user: Current authenticated user
        db: Database session

    Returns:
        Success response
    """
    try:
        success = await push_notification_service.unsubscribe(
            user_id=current_user.id,
            endpoint=subscription.endpoint,
            db=db,
        )

        if not success:
            return PushSubscriptionResponse(
                success=False,
                message="登録が見つかりませんでした",
            )

        logger.info(f"User {current_user.id} unsubscribed from push notifications")

        return PushSubscriptionResponse(
            success=True,
            message="プッシュ通知の登録を解除しました",
        )

    except Exception as e:
        logger.error(f"Failed to unsubscribe from push notifications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="プッシュ通知の登録解除に失敗しました",
        )


@router.post("/test", response_model=PushSubscriptionResponse)
async def send_test_notification(
    request: TestNotificationRequest,
    current_user: Annotated[User, Depends(get_optional_site_user)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> PushSubscriptionResponse:
    """Send a test push notification.

    Args:
        request: Test notification details
        current_user: Current authenticated user
        db: Database session

    Returns:
        Success response
    """
    try:
        sent_count = await push_notification_service.send_notification(
            user_id=current_user.id,
            title=request.title,
            body=request.body,
            db=db,
            url=request.url,
            tag="test-notification",
            data={
                "type": "test",
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

        if sent_count == 0:
            return PushSubscriptionResponse(
                success=False,
                message="プッシュ通知の登録がありません",
            )

        logger.info(f"Sent test notification to user {current_user.id}")

        return PushSubscriptionResponse(
            success=True,
            message=f"{sent_count}件のデバイスに通知を送信しました",
        )

    except Exception as e:
        logger.error(f"Failed to send test notification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="テスト通知の送信に失敗しました",
        )


@router.get("/vapid-key")
async def get_vapid_public_key() -> Dict[str, str]:
    """Get VAPID public key for push notifications.

    Returns:
        VAPID public key
    """
    from ...settings import settings

    if not settings.vapid_public_key:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="プッシュ通知は設定されていません",
        )

    return {
        "publicKey": settings.vapid_public_key,
    }
