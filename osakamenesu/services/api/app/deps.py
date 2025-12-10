from typing import Optional
from datetime import datetime, UTC
from uuid import UUID

import logging

from fastapi import Header, HTTPException, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .settings import settings
from .db import get_session
from . import models
from .utils.auth import hash_token
import hashlib

logger = logging.getLogger(__name__)


async def _get_session_user(
    request: Request,
    db: AsyncSession,
    *,
    cookie_name: str | None,
    scope: str | None = None,
) -> Optional[models.User]:
    if not cookie_name:
        return None
    raw_token = request.cookies.get(cookie_name)
    if not raw_token:
        return None

    token_hash = hash_token(raw_token)
    stmt = select(models.UserSession).where(models.UserSession.token_hash == token_hash)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    if not session:
        return None

    if scope and getattr(session, "scope", scope) != scope:
        return None

    now = datetime.now(UTC)
    if session.revoked_at or session.expires_at < now:
        return None

    user = await db.get(models.User, session.user_id)
    return user


async def get_optional_admin_user(
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> Optional[models.User]:
    """Get admin user from admin session cookie.

    Admin sessions are created via specific admin login routes,
    so having a valid admin-scoped session implies admin access.
    """
    return await _get_session_user(
        request,
        db,
        cookie_name=settings.admin_session_cookie_name,
        scope="admin",
    )


async def require_admin(
    request: Request,
    db: AsyncSession = Depends(get_session),
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
) -> Optional[models.User]:
    """
    Require admin authentication.

    Supports two authentication methods (checked in order):
    1. Cookie-based session with admin scope (preferred)
    2. X-Admin-Key header (legacy, for backwards compatibility)

    Returns the admin user if cookie auth is used, None if API key auth.
    """
    # Try cookie-based auth first
    admin_user = await get_optional_admin_user(request, db)
    if admin_user:
        return admin_user

    # Fall back to API key auth
    if settings.admin_api_key and x_admin_key == settings.admin_api_key:
        return None  # API key auth doesn't have a user object

    # Neither auth method succeeded
    if not settings.admin_api_key:
        raise HTTPException(status_code=503, detail="admin_not_configured")
    raise HTTPException(status_code=401, detail="unauthorized")


def _hash_ip(ip: Optional[str]) -> Optional[str]:
    if not ip:
        return None
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()


async def audit_admin(
    request: Request,
    db: AsyncSession = Depends(get_session),
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
) -> None:
    try:
        # Compute ip hash like outlink logging
        ip = request.headers.get("x-forwarded-for") or (
            request.client.host if request.client else ""
        )
        ip_hash = _hash_ip(ip)
        key_hash = (
            hashlib.sha256((x_admin_key or "").encode("utf-8")).hexdigest()
            if x_admin_key
            else None
        )
        details = {
            "query": dict(request.query_params or {}),
            "path_params": dict(request.path_params or {}),
        }
        log = models.AdminLog(
            method=request.method,
            path=request.url.path,
            ip_hash=ip_hash,
            admin_key_hash=key_hash,
            details=details,
        )
        db.add(log)
        await db.commit()
    except Exception:
        # Best-effort; never block admin action
        pass


async def get_optional_dashboard_user(
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> Optional[models.User]:
    try:
        logger.info("[dashboard auth] incoming cookies=%s", dict(request.cookies or {}))
    except Exception:
        logger.info("[dashboard auth] failed to log cookies")
    return await _get_session_user(
        request,
        db,
        cookie_name=settings.dashboard_session_cookie_name,
        scope="dashboard",
    )


async def get_optional_site_user(
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> Optional[models.User]:
    """Get site user from site session cookie only. No fallback to dashboard."""
    return await _get_session_user(
        request,
        db,
        cookie_name=settings.site_session_cookie_name,
        scope="site",
    )


async def require_dashboard_user(
    user: Optional[models.User] = Depends(get_optional_dashboard_user),
) -> models.User:
    if not user:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return user


async def require_site_user(
    user: Optional[models.User] = Depends(get_optional_site_user),
) -> models.User:
    if not user:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return user


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> Optional[models.User]:
    """Get user from site session cookie. Use scope-specific functions for strict auth."""
    return await _get_session_user(
        request,
        db,
        cookie_name=settings.site_session_cookie_name,
        scope="site",
    )


async def require_user(
    user: Optional[models.User] = Depends(get_optional_user),
) -> models.User:
    if not user:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return user


async def verify_shop_manager(
    db: AsyncSession,
    user_id: UUID,
    shop_id: UUID,
    required_roles: list[str] | None = None,
) -> models.ShopManager:
    """
    ユーザーが指定した店舗の管理者かどうかを確認する。

    Args:
        db: データベースセッション
        user_id: ユーザーID
        shop_id: 店舗ID (profile_id)
        required_roles: 必要なロールのリスト (None の場合はすべてのロールを許可)

    Returns:
        ShopManager: 店舗管理者レコード

    Raises:
        HTTPException: 403 (権限なし) または 404 (店舗が見つからない)
    """
    stmt = select(models.ShopManager).where(
        models.ShopManager.user_id == user_id,
        models.ShopManager.shop_id == shop_id,
    )
    result = await db.execute(stmt)
    manager = result.scalar_one_or_none()

    if not manager:
        raise HTTPException(status_code=403, detail="not_shop_manager")

    if required_roles and manager.role not in required_roles:
        raise HTTPException(status_code=403, detail="insufficient_role")

    return manager


async def get_user_managed_shops(
    db: AsyncSession,
    user_id: UUID,
) -> list[models.ShopManager]:
    """ユーザーが管理している店舗のリストを取得する。"""
    stmt = select(models.ShopManager).where(models.ShopManager.user_id == user_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())
