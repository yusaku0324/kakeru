from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models, schemas
from ....db import get_session
from ....deps import require_dashboard_user, verify_shop_manager
from ....utils.datetime import ensure_aware_datetime
from ....utils.text import strip_or_none


router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

_ALLOWED_STATUSES = {"pending", "confirmed", "declined", "cancelled", "expired"}
_DEFAULT_TRIGGER_STATUS = ["pending", "confirmed"]
_DEFAULT_CHANNELS: Dict[str, Dict[str, Any]] = {
    "email": {"enabled": False, "recipients": []},
    "line": {"enabled": False, "token": None},
    "slack": {"enabled": False, "webhook_url": None},
}


def _default_channels_dict() -> Dict[str, Dict[str, Any]]:
    return deepcopy(_DEFAULT_CHANNELS)


def _normalize_trigger_status(statuses: List[str]) -> List[str]:
    unique: List[str] = []
    seen = set()
    for value in statuses:
        if value not in _ALLOWED_STATUSES:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "field": "trigger_status",
                    "message": "不正なステータスが含まれています。",
                },
            )
        if value not in seen:
            seen.add(value)
            unique.append(value)
    if not unique:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "field": "trigger_status",
                "message": "少なくとも 1 つのステータスを選択してください。",
            },
        )
    return unique


def _sanitize_email_recipients(recipients: List[str]) -> List[str]:
    cleaned: List[str] = []
    lowered = set()
    for item in recipients:
        candidate = strip_or_none(item)
        if not candidate:
            continue
        lowered_key = candidate.lower()
        if lowered_key in lowered:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"field": "email", "message": "メール宛先が重複しています。"},
            )
        lowered.add(lowered_key)
        cleaned.append(candidate)
    if not cleaned:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field": "email", "message": "メール宛先を入力してください。"},
        )
    if len(cleaned) > 5:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field": "email", "message": "メール宛先は最大 5 件までです。"},
        )
    return cleaned


def _normalize_channels(
    channels: schemas.DashboardNotificationChannels,
) -> Dict[str, Dict[str, Any]]:
    normalized = _default_channels_dict()

    if channels.email.enabled:
        normalized["email"]["enabled"] = True
        normalized["email"]["recipients"] = _sanitize_email_recipients(
            channels.email.recipients
        )
    else:
        normalized["email"]["enabled"] = False
        normalized["email"]["recipients"] = []

    if channels.line.enabled:
        token = strip_or_none(channels.line.token)
        if not token:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "field": "line",
                    "message": "LINE Notify トークンを入力してください。",
                },
            )
        if (
            len(token) < 40
            or len(token) > 60
            or not all(c.isalnum() or c in "-_" for c in token)
        ):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "field": "line",
                    "message": "LINE Notify トークンの形式が正しくありません。",
                },
            )
        normalized["line"] = {"enabled": True, "token": token}
    else:
        normalized["line"] = {"enabled": False, "token": None}

    if channels.slack.enabled:
        url = strip_or_none(channels.slack.webhook_url)
        if not url:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "field": "slack",
                    "message": "Slack Webhook URL を入力してください。",
                },
            )
        if not url.startswith("https://hooks.slack.com/"):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "field": "slack",
                    "message": "Slack Webhook URL の形式が正しくありません。",
                },
            )
        normalized["slack"] = {"enabled": True, "webhook_url": url}
    else:
        normalized["slack"] = {"enabled": False, "webhook_url": None}

    return normalized


def _build_channels_response(
    raw: Dict[str, Any],
) -> schemas.DashboardNotificationChannels:
    merged = _default_channels_dict()
    for key, value in raw.items():
        if key in merged and isinstance(value, dict):
            merged[key].update(value)
    return schemas.DashboardNotificationChannels(
        email=schemas.DashboardNotificationChannelEmail(**merged["email"]),
        line=schemas.DashboardNotificationChannelLine(**merged["line"]),
        slack=schemas.DashboardNotificationChannelSlack(**merged["slack"]),
    )


def _serialize(
    setting: models.DashboardNotificationSetting,
) -> schemas.DashboardNotificationSettingsResponse:
    trigger_status = setting.trigger_status or []
    if not trigger_status:
        trigger_status = _DEFAULT_TRIGGER_STATUS.copy()
    channels = _build_channels_response(setting.channels or {})
    return schemas.DashboardNotificationSettingsResponse(
        profile_id=setting.profile_id,
        updated_at=setting.updated_at,
        trigger_status=trigger_status,
        channels=channels,
    )


async def _ensure_profile(db: AsyncSession, profile_id: UUID) -> models.Profile:
    profile = await db.get(models.Profile, profile_id)
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="profile_not_found")
    return profile


async def _get_or_create_setting(
    db: AsyncSession,
    profile: models.Profile,
) -> models.DashboardNotificationSetting:
    setting = await db.get(models.DashboardNotificationSetting, profile.id)
    if setting:
        return setting

    setting = models.DashboardNotificationSetting(
        profile_id=profile.id,
        trigger_status=_DEFAULT_TRIGGER_STATUS.copy(),
        channels=_default_channels_dict(),
        updated_at=models.now_utc(),
        updated_by=None,
    )
    db.add(setting)
    await db.commit()
    await db.refresh(setting)
    return setting


@router.get(
    "/shops/{profile_id}/notifications",
    response_model=schemas.DashboardNotificationSettingsResponse,
)
async def get_dashboard_notifications(
    profile_id: UUID,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> schemas.DashboardNotificationSettingsResponse:
    await verify_shop_manager(db, user.id, profile_id)
    profile = await _ensure_profile(db, profile_id)
    setting = await _get_or_create_setting(db, profile)
    return _serialize(setting)


@router.put(
    "/shops/{profile_id}/notifications",
    response_model=schemas.DashboardNotificationSettingsResponse,
)
async def update_dashboard_notifications(
    profile_id: UUID,
    payload: schemas.DashboardNotificationSettingsUpdatePayload,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> schemas.DashboardNotificationSettingsResponse:
    await verify_shop_manager(db, user.id, profile_id)
    profile = await _ensure_profile(db, profile_id)
    setting = await _get_or_create_setting(db, profile)

    current_updated_at = ensure_aware_datetime(setting.updated_at)
    incoming_updated_at = ensure_aware_datetime(payload.updated_at)
    if incoming_updated_at != current_updated_at:
        current = _serialize(setting)
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"current": current.dict()},
        )

    trigger_status = _normalize_trigger_status(list(payload.trigger_status))
    channels = _normalize_channels(payload.channels)

    setting.trigger_status = trigger_status
    setting.channels = channels
    setting.updated_at = models.now_utc()
    setting.updated_by = user.id
    await db.commit()
    await db.refresh(setting)
    return _serialize(setting)


@router.post(
    "/shops/{profile_id}/notifications/test", status_code=status.HTTP_204_NO_CONTENT
)
async def test_dashboard_notifications(
    profile_id: UUID,
    payload: schemas.DashboardNotificationSettingsTestPayload,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> Response:
    await verify_shop_manager(db, user.id, profile_id)
    profile = await _ensure_profile(db, profile_id)
    await _get_or_create_setting(db, profile)

    _normalize_trigger_status(list(payload.trigger_status))
    _ = _normalize_channels(payload.channels)

    return Response(status_code=status.HTTP_204_NO_CONTENT)
