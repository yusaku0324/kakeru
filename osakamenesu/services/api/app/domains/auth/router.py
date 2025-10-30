from __future__ import annotations

import logging
from datetime import datetime, UTC, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ... import models
from ...db import get_session
from ...deps import require_dashboard_user, require_site_user
from ...schemas import AuthRequestLink, AuthVerifyRequest, UserPublic
from ...settings import settings
from ...utils.auth import generate_token, hash_token, magic_link_expiry, session_expiry
from ...utils.email import MailNotConfiguredError, send_email_async

logger = logging.getLogger("app.auth")

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _ip_from_request(request: Request) -> Optional[str]:
    return request.headers.get("x-forwarded-for") or (request.client.host if request.client else None)


def _hash_ip(ip: Optional[str]) -> Optional[str]:
    if not ip:
        return None
    return hash_token(ip)


def _build_magic_link(token: str) -> str:
    base_url = settings.site_base_url or settings.api_origin or "http://localhost:3000"
    path = settings.auth_magic_link_redirect_path or "/auth/complete"
    if base_url.endswith('/') and path.startswith('/'):
        link = f"{base_url[:-1]}{path}"
    elif not base_url.endswith('/') and not path.startswith('/'):
        link = f"{base_url}/{path}"
    else:
        link = f"{base_url}{path}"
    return f"{link}?token={token}"


async def _enforce_rate_limit(user_id: Optional[UUID], ip_hash: Optional[str], db: AsyncSession) -> None:
    window_start = datetime.now(UTC) - timedelta(minutes=10)
    conditions = []
    if user_id:
        conditions.append(models.UserAuthToken.user_id == user_id)
    if ip_hash:
        conditions.append(models.UserAuthToken.ip_hash == ip_hash)

    if not conditions:
        return

    stmt = select(func.count(models.UserAuthToken.id)).where(models.UserAuthToken.created_at >= window_start)
    stmt = stmt.where(or_(*conditions)) if len(conditions) > 1 else stmt.where(conditions[0])
    issued_recently = (await db.execute(stmt)).scalar() or 0
    if issued_recently >= max(1, settings.auth_magic_link_rate_limit):
        raise HTTPException(status_code=429, detail="too_many_requests")


def _session_cookie_names(scope: str | None = None) -> list[str]:
    names: list[str] = []
    if scope == "dashboard":
        candidates = [getattr(settings, "dashboard_session_cookie_name", None)]
    elif scope == "site":
        candidates = [getattr(settings, "site_session_cookie_name", None)]
    else:
        candidates = [
            getattr(settings, "dashboard_session_cookie_name", None),
            getattr(settings, "site_session_cookie_name", None),
        ]

    for name in candidates:
        if name and name not in names:
            names.append(name)
    # Backwards compatibility for legacy dashboard cookie name
    if scope in (None, "dashboard"):
        legacy = getattr(settings, "auth_session_cookie_name", None)
        if legacy and legacy not in names:
            names.append(legacy)
    return names


def _set_session_cookie(response: Response, token: str, *, scope: str | None = None) -> None:
    max_age = settings.auth_session_ttl_days * 24 * 60 * 60
    names = _session_cookie_names(scope)
    if not names:
        names = _session_cookie_names()
    same_site_raw = (settings.auth_session_cookie_same_site or "lax").strip().lower()
    same_site = same_site_raw if same_site_raw in {"lax", "strict", "none"} else "lax"
    secure = settings.auth_session_cookie_secure or same_site == "none"

    for name in names:
        response.set_cookie(
            key=name,
            value=token,
            max_age=max_age,
            httponly=True,
            secure=secure,
            samesite=same_site,
            domain=settings.auth_session_cookie_domain,
            path="/",
        )


async def _get_session_from_cookie(request: Request, db: AsyncSession) -> Optional[models.UserSession]:
    for cookie_name in _session_cookie_names():
        raw_token = request.cookies.get(cookie_name)
        if not raw_token:
            continue
        token_hash = hash_token(raw_token)
        stmt = select(models.UserSession).where(models.UserSession.token_hash == token_hash)
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()
        if session:
            return session
    return None


def _log_magic_link(email: str, link: str) -> None:
    message = f"MAGIC_LINK_DEBUG {link}"
    logger.info(message, extra={"email": email})


@router.post("/request-link", status_code=status.HTTP_202_ACCEPTED)
async def request_link(
    payload: AuthRequestLink,
    request: Request,
    db: AsyncSession = Depends(get_session),
):
    scope = payload.scope or "dashboard"
    email = payload.email.strip().lower()
    stmt = select(models.User).where(models.User.email == email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        display_name = email.split("@", 1)[0]
        user = models.User(email=email, display_name=display_name)
        db.add(user)
        await db.flush()

    ip = _ip_from_request(request)
    ip_hash = _hash_ip(ip)
    await _enforce_rate_limit(user.id, ip_hash, db)

    token_raw = generate_token()
    token_hash = hash_token(token_raw)

    magic = models.UserAuthToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=magic_link_expiry(),
        scope=scope,
        ip_hash=ip_hash,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(magic)
    await db.commit()

    link = _build_magic_link(token_raw)
    if settings.auth_magic_link_debug:
        _log_magic_link(email, link)

    mail_sent = False
    mail_message: str | None = None
    if scope == "site":
        subject = "[大阪メンズエステ] ログインリンクのお知らせ"
        html_body = f"""
            <p>大阪メンズエステサイトへのログインリクエストを受け付けました。</p>
            <p>下記のリンクを開くとログインが完了します。リンクの有効期限は約 {settings.auth_magic_link_expire_minutes} 分です。</p>
            <p><a href="{link}">{link}</a></p>
            <p>このメールに心当たりがない場合は破棄してください。</p>
            <p>--<br/>大阪メンズエステ運営</p>
        """
        text_body = (
            "大阪メンズエステサイトへのログインリクエストを受け付けました。\n\n"
            f"下記のリンクを開くとログインが完了します（有効期限: 約 {settings.auth_magic_link_expire_minutes} 分）。\n"
            f"{link}\n\n"
            "このメールに心当たりがない場合は破棄してください。\n\n"
            "--\n大阪メンズエステ運営"
        )
    else:
        subject = "[大阪メンズエステ] ログインリンクのお知らせ"
        html_body = f"""
            <p>大阪メンズエステ ダッシュボードへのログインリクエストを受け付けました。</p>
            <p>下記のリンクを開くとログインが完了します。リンクの有効期限は約 {settings.auth_magic_link_expire_minutes} 分です。</p>
            <p><a href="{link}">{link}</a></p>
            <p>このメールに心当たりがない場合は破棄してください。</p>
            <p>--<br/>大阪メンズエステ運営</p>
        """
        text_body = (
            "大阪メンズエステ ダッシュボードへのログインリクエストを受け付けました。\n\n"
            f"下記のリンクを開くとログインが完了します（有効期限: 約 {settings.auth_magic_link_expire_minutes} 分）。\n"
            f"{link}\n\n"
            "このメールに心当たりがない場合は破棄してください。\n\n"
            "--\n大阪メンズエステ運営"
        )

    try:
        await send_email_async(
            to=email,
            subject=subject,
            html=html_body,
            text=text_body,
            tags=["auth", "magic_link"],
        )
        mail_sent = True
    except MailNotConfiguredError:
        mail_message = "mail_not_configured"
        logger.warning("mail_not_configured", extra={"email": email})
    except Exception:
        mail_message = "mail_send_failed"
        logger.exception("magic_link_mail_failed", extra={"email": email})

    response: dict[str, object] = {"ok": True, "mail_sent": mail_sent}
    if mail_message:
        response["message"] = mail_message
    return response


@router.post("/verify")
async def verify_token(
    payload: AuthVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
):
    try:
        now = datetime.now(UTC)
        token_hash = hash_token(payload.token)
        stmt = select(models.UserAuthToken).where(models.UserAuthToken.token_hash == token_hash)
        result = await db.execute(stmt)
        auth_token = result.scalar_one_or_none()
        if not auth_token or auth_token.consumed_at or auth_token.expires_at < now:
            raise HTTPException(status_code=400, detail="invalid_or_expired_token")

        user = await db.get(models.User, auth_token.user_id)
        if not user:
            raise HTTPException(status_code=400, detail="user_not_found")

        auth_token.consumed_at = now
        auth_token.ip_hash = _hash_ip(_ip_from_request(request)) or auth_token.ip_hash
        auth_token.user_agent = request.headers.get("user-agent")

        session_token = generate_token()
        session_hash = hash_token(session_token)
        session_scope = getattr(auth_token, "scope", "dashboard") or "dashboard"
        session = models.UserSession(
            user_id=user.id,
            token_hash=session_hash,
            issued_at=now,
            expires_at=session_expiry(now),
            scope=session_scope,
            ip_hash=_hash_ip(_ip_from_request(request)),
            user_agent=request.headers.get("user-agent"),
        )
        db.add(session)
        user.last_login_at = now
        if not user.email_verified_at:
            user.email_verified_at = now

        await db.commit()

        response = JSONResponse({"ok": True, "scope": session_scope})
        _set_session_cookie(response, session_token, scope=session_scope)
        return response
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("magic_link_verify_failed")
        raise HTTPException(status_code=500, detail="verification_failed") from exc


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, db: AsyncSession = Depends(get_session)):
    session = await _get_session_from_cookie(request, db)
    if session:
        session.revoked_at = datetime.now(UTC)
        await db.commit()

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    for name in _session_cookie_names():
        response.delete_cookie(
            key=name,
            domain=settings.auth_session_cookie_domain,
            path="/",
        )
    return response


@router.get("/me", response_model=UserPublic)
async def get_me(user: models.User = Depends(require_dashboard_user)):
    return UserPublic(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


@router.get("/me/site", response_model=UserPublic)
async def get_me_site(user: models.User = Depends(require_site_user)):
    return UserPublic(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )
