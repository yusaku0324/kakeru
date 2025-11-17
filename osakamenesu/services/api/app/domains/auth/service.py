from __future__ import annotations

import logging
import sys
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from http import HTTPStatus
from importlib import import_module
from typing import Mapping, Optional
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from ... import models
from ...schemas import AuthRequestLink, AuthVerifyRequest, AuthTestLoginRequest
from ...settings import settings
from ...utils.auth import generate_token, hash_token, magic_link_expiry, session_expiry
from ...utils.email import MailNotConfiguredError, send_email_async

logger = logging.getLogger("app.auth")


class AuthServiceError(Exception):
    def __init__(self, status_code: int | HTTPStatus, detail: str) -> None:
        super().__init__(detail)
        self.status_code = int(status_code)
        self.detail = detail


@dataclass(frozen=True)
class AuthRequestContext:
    headers: Mapping[str, str]
    cookies: Mapping[str, str]
    client_host: str | None = None


@dataclass(frozen=True)
class AuthVerificationResult:
    scope: str
    session_token: str


def _settings_candidates():
    seen: set[int] = set()
    primaries = [
        globals().get("settings"),
        getattr(import_module("app.settings"), "settings", None),
    ]
    for candidate in primaries:
        if candidate is not None and id(candidate) not in seen:
            seen.add(id(candidate))
            yield candidate
    for module in list(sys.modules.values()):
        candidate = getattr(module, "settings", None)
        if candidate is not None and id(candidate) not in seen:
            seen.add(id(candidate))
            yield candidate


def _resolve_settings():
    return next(_settings_candidates(), settings)


def _ip_from_context(context: AuthRequestContext) -> Optional[str]:
    return context.headers.get("x-forwarded-for") or context.client_host


def _hash_ip(ip: Optional[str]) -> Optional[str]:
    if not ip:
        return None
    return hash_token(ip)


def _session_cookie_names(scope: str | None = None) -> list[str]:
    names: list[str] = []

    def _append(value: str | None) -> None:
        if value and value not in names:
            names.append(value)

    for candidate in _settings_candidates():
        if scope == "dashboard":
            _append(getattr(candidate, "dashboard_session_cookie_name", None))
        elif scope == "site":
            _append(getattr(candidate, "site_session_cookie_name", None))
        else:
            _append(getattr(candidate, "dashboard_session_cookie_name", None))
            _append(getattr(candidate, "site_session_cookie_name", None))

        if scope in (None, "dashboard"):
            _append(getattr(candidate, "auth_session_cookie_name", None))

    if not names:
        if scope == "site":
            names.append("osakamenesu_session")
        else:
            names.append("osakamenesu_session")
    return names


async def _get_session_from_cookie(
    context: AuthRequestContext, db: AsyncSession
) -> Optional[models.UserSession]:
    for cookie_name in _session_cookie_names():
        raw_token = context.cookies.get(cookie_name)
        if not raw_token:
            continue
        token_hash = hash_token(raw_token)
        stmt = select(models.UserSession).where(
            models.UserSession.token_hash == token_hash
        )
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()
        if session:
            return session
    return None


def _build_magic_link(token: str) -> str:
    resolved = _resolve_settings()
    base_url = (
        getattr(resolved, "site_base_url", None)
        or getattr(resolved, "api_origin", None)
        or "http://localhost:3000"
    )
    path = getattr(resolved, "auth_magic_link_redirect_path", None) or "/auth/complete"
    if base_url.endswith("/") and path.startswith("/"):
        link = f"{base_url[:-1]}{path}"
    elif not base_url.endswith("/") and not path.startswith("/"):
        link = f"{base_url}/{path}"
    else:
        link = f"{base_url}{path}"
    return f"{link}?token={token}"


async def _enforce_rate_limit(
    user_id: Optional[UUID], ip_hash: Optional[str], db: AsyncSession
) -> None:
    window_start = datetime.now(UTC) - timedelta(minutes=10)
    conditions = []
    if user_id:
        conditions.append(models.UserAuthToken.user_id == user_id)
    if ip_hash:
        conditions.append(models.UserAuthToken.ip_hash == ip_hash)

    if not conditions:
        return

    stmt = select(func.count(models.UserAuthToken.id)).where(
        models.UserAuthToken.created_at >= window_start
    )
    stmt = (
        stmt.where(or_(*conditions))
        if len(conditions) > 1
        else stmt.where(conditions[0])
    )
    issued_recently = (await db.execute(stmt)).scalar() or 0
    resolved = _resolve_settings()
    rate_limit = getattr(resolved, "auth_magic_link_rate_limit", 5)
    if issued_recently >= max(1, rate_limit):
        raise AuthServiceError(HTTPStatus.TOO_MANY_REQUESTS, detail="too_many_requests")


def _log_magic_link(email: str, link: str) -> None:
    message = f"MAGIC_LINK_DEBUG {link}"
    logger.info(message, extra={"email": email})


class AuthMagicLinkService:
    """Contain business logic for auth magic link operations."""

    def __init__(self, *, mail_sender=send_email_async) -> None:
        self._mail_sender = mail_sender

    def set_mail_sender(self, mail_sender) -> None:
        self._mail_sender = mail_sender

    async def request_link(
        self,
        payload: AuthRequestLink,
        context: AuthRequestContext,
        db: AsyncSession,
    ) -> dict[str, object]:
        resolved = _resolve_settings()
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

        ip = _ip_from_context(context)
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
            user_agent=context.headers.get("user-agent"),
        )
        db.add(magic)
        await db.commit()

        link = _build_magic_link(token_raw)
        if getattr(resolved, "auth_magic_link_debug", False):
            _log_magic_link(email, link)

        mail_sent = False
        mail_message: Optional[str] = None
        expire_minutes = getattr(resolved, "auth_magic_link_expire_minutes", 15)
        if scope == "site":
            subject = "[大阪メンズエステ] ログインリンクのお知らせ"
            html_body = f"""
                <p>大阪メンズエステサイトへのログインリクエストを受け付けました。</p>
                <p>下記のリンクを開くとログインが完了します。リンクの有効期限は約 {expire_minutes} 分です。</p>
                <p><a href="{link}">{link}</a></p>
                <p>このメールに心当たりがない場合は破棄してください。</p>
                <p>--<br/>大阪メンズエステ運営</p>
            """
            text_body = (
                "大阪メンズエステサイトへのログインリクエストを受け付けました。\n\n"
                f"下記のリンクを開くとログインが完了します（有効期限: 約 {expire_minutes} 分）。\n"
                f"{link}\n\n"
                "このメールに心当たりがない場合は破棄してください。\n\n"
                "--\n大阪メンズエステ運営"
            )
        else:
            subject = "[大阪メンズエステ] ログインリンクのお知らせ"
            html_body = f"""
                <p>大阪メンズエステ ダッシュボードへのログインリクエストを受け付けました。</p>
                <p>下記のリンクを開くとログインが完了します。リンクの有効期限は約 {expire_minutes} 分です。</p>
                <p><a href="{link}">{link}</a></p>
                <p>このメールに心当たりがない場合は破棄してください。</p>
                <p>--<br/>大阪メンズエステ運営</p>
            """
            text_body = (
                "大阪メンズエステ ダッシュボードへのログインリクエストを受け付けました。\n\n"
                f"下記のリンクを開くとログインが完了します（有効期限: 約 {expire_minutes} 分）。\n"
                f"{link}\n\n"
                "このメールに心当たりがない場合は破棄してください。\n\n"
                "--\n大阪メンズエステ運営"
            )

        try:
            await self._mail_sender(
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

    async def verify_token(
        self,
        payload: AuthVerifyRequest,
        context: AuthRequestContext,
        db: AsyncSession,
    ) -> AuthVerificationResult:
        try:
            now = datetime.now(UTC)
            token_hash_value = hash_token(payload.token)
            stmt = select(models.UserAuthToken).where(
                models.UserAuthToken.token_hash == token_hash_value
            )
            result = await db.execute(stmt)
            auth_token = result.scalar_one_or_none()
            if not auth_token or auth_token.consumed_at or auth_token.expires_at < now:
                raise AuthServiceError(
                    HTTPStatus.BAD_REQUEST, detail="invalid_or_expired_token"
                )

            user = await db.get(models.User, auth_token.user_id)
            if not user:
                raise AuthServiceError(HTTPStatus.BAD_REQUEST, detail="user_not_found")

            auth_token.consumed_at = now
            ip_hash = _hash_ip(_ip_from_context(context))
            auth_token.ip_hash = ip_hash or auth_token.ip_hash
            auth_token.user_agent = context.headers.get("user-agent")

            session_token = generate_token()
            session_hash = hash_token(session_token)
            session_scope = getattr(auth_token, "scope", "dashboard") or "dashboard"
            session = models.UserSession(
                user_id=user.id,
                token_hash=session_hash,
                issued_at=now,
                expires_at=session_expiry(now),
                scope=session_scope,
                ip_hash=ip_hash,
                user_agent=context.headers.get("user-agent"),
            )
            db.add(session)
            user.last_login_at = now
            if not user.email_verified_at:
                user.email_verified_at = now

            await db.commit()

            return AuthVerificationResult(
                scope=session_scope, session_token=session_token
            )
        except AuthServiceError:
            raise
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.exception("magic_link_verify_failed")
            raise AuthServiceError(
                HTTPStatus.INTERNAL_SERVER_ERROR, detail="verification_failed"
            ) from exc

    async def logout(self, context: AuthRequestContext, db: AsyncSession) -> None:
        session = await _get_session_from_cookie(context, db)
        if session:
            session.revoked_at = datetime.now(UTC)
            await db.commit()

    async def test_login(
        self,
        payload: AuthTestLoginRequest,
        context: AuthRequestContext,
        db: AsyncSession,
    ) -> tuple[str, str, models.User]:
        email = payload.email.strip().lower()
        stmt = select(models.User).where(models.User.email == email)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        display_name = (payload.display_name or email.split("@", 1)[0]).strip()

        if not user:
            user = models.User(email=email, display_name=display_name)
            db.add(user)
            try:
                await db.flush()
            except IntegrityError:
                await db.rollback()
                result = await db.execute(stmt)
                user = result.scalar_one()
        if display_name and user.display_name != display_name:
            user.display_name = display_name

        now = datetime.now(UTC)
        session_token = generate_token()
        session_hash = hash_token(session_token)
        scope = payload.scope or "site"
        session = models.UserSession(
            user_id=user.id,
            token_hash=session_hash,
            issued_at=now,
            expires_at=session_expiry(now),
            scope=scope,
            ip_hash=_hash_ip(_ip_from_context(context)),
            user_agent=context.headers.get("user-agent"),
        )
        db.add(session)
        user.last_login_at = now
        if not user.email_verified_at:
            user.email_verified_at = now

        await db.commit()
        return session_token, scope, user


__all__ = [
    "AuthMagicLinkService",
    "AuthRequestContext",
    "AuthServiceError",
    "AuthVerificationResult",
    "_get_session_from_cookie",
    "_session_cookie_names",
]
