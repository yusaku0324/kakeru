from typing import Optional
from datetime import datetime, UTC

from fastapi import Header, HTTPException, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .settings import settings
from .db import get_session
from . import models
from .utils.auth import hash_token
import hashlib


async def _get_session_user(
    request: Request,
    db: AsyncSession,
    *,
    cookie_name: str | None,
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

    now = datetime.now(UTC)
    if session.revoked_at or session.expires_at < now:
        return None

    user = await db.get(models.User, session.user_id)
    return user


async def require_admin(x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key")) -> None:
    if not settings.admin_api_key:
        raise HTTPException(status_code=503, detail="admin_not_configured")
    if not x_admin_key or x_admin_key != settings.admin_api_key:
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
        ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")
        ip_hash = _hash_ip(ip)
        key_hash = hashlib.sha256((x_admin_key or "").encode("utf-8")).hexdigest() if x_admin_key else None
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
    return await _get_session_user(
        request,
        db,
        cookie_name=settings.dashboard_session_cookie_name,
    )


async def get_optional_site_user(
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> Optional[models.User]:
    user = await _get_session_user(
        request,
        db,
        cookie_name=settings.site_session_cookie_name,
    )
    if user:
        return user

    if settings.site_session_cookie_name != settings.dashboard_session_cookie_name:
        # Allow legacy dashboard cookie to authenticate until new site cookie is issued
        return await _get_session_user(
            request,
            db,
            cookie_name=settings.dashboard_session_cookie_name,
        )
    return None


async def require_dashboard_user(user: Optional[models.User] = Depends(get_optional_dashboard_user)) -> models.User:
    if not user:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return user


async def require_site_user(user: Optional[models.User] = Depends(get_optional_site_user)) -> models.User:
    if not user:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return user


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> Optional[models.User]:
    user = await _get_session_user(
        request,
        db,
        cookie_name=settings.site_session_cookie_name,
    )
    if user:
        return user

    if settings.site_session_cookie_name != settings.dashboard_session_cookie_name:
        # Fallback to dashboard cookie so existing sessions remain valid after rename
        return await _get_session_user(
            request,
            db,
            cookie_name=settings.dashboard_session_cookie_name,
        )
    return None


async def require_user(user: Optional[models.User] = Depends(get_optional_user)) -> models.User:
    if not user:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return user
