
from __future__ import annotations

from datetime import datetime, UTC
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from ... import models
from ...db import get_session
from ...deps import require_dashboard_user, require_site_user, get_optional_dashboard_user, get_optional_site_user
from ...schemas import AuthRequestLink, AuthVerifyRequest, AuthSessionStatus, UserPublic
from ...utils.auth import generate_token, hash_token, session_expiry
from ...utils.email import send_email_async as _send_email_async
from ...settings import settings
from .service import AuthMagicLinkService, _set_session_cookie

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def send_email_async(**kwargs):
    return await _send_email_async(**kwargs)


_service = AuthMagicLinkService(mail_sender=lambda **kwargs: send_email_async(**kwargs))


class TestLoginRequest(BaseModel):
    email: EmailStr
    display_name: str | None = None
    scope: Literal["site", "dashboard"] = "site"


@router.post("/request-link", status_code=status.HTTP_202_ACCEPTED)
async def request_link(
    payload: AuthRequestLink,
    request: Request,
    db: AsyncSession = Depends(get_session),
):
    return await _service.request_link(payload, request, db)


@router.post("/verify")
async def verify_token(
    payload: AuthVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> JSONResponse:
    return await _service.verify_token(payload, request, db)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, db: AsyncSession = Depends(get_session)) -> Response:
    return await _service.logout(request, db)


def _to_user_public(user: models.User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


@router.get("/session", response_model=AuthSessionStatus)
async def session_status(
    site_user: models.User | None = Depends(get_optional_site_user),
    dashboard_user: models.User | None = Depends(get_optional_dashboard_user),
) -> AuthSessionStatus:
    site_authenticated = site_user is not None
    dashboard_authenticated = dashboard_user is not None
    scopes: list[str] = []
    if site_authenticated:
        scopes.append("site")
    if dashboard_authenticated:
        scopes.append("dashboard")

    if scopes:
        primary_user = site_user or dashboard_user
        assert primary_user is not None
        return AuthSessionStatus(
            authenticated=True,
            site_authenticated=site_authenticated,
            dashboard_authenticated=dashboard_authenticated,
            scopes=scopes,
            user=_to_user_public(primary_user),
        )

    return AuthSessionStatus(
        authenticated=False,
        site_authenticated=False,
        dashboard_authenticated=False,
        scopes=[],
        user=None,
    )


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


@router.post("/test-login")
async def test_login(
    payload: TestLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> JSONResponse:
    if not settings.test_auth_enabled or not settings.test_auth_secret:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    provided_secret = request.headers.get("x-test-auth-secret") or request.query_params.get("secret")
    if provided_secret != settings.test_auth_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid_test_auth_secret")

    email = payload.email.strip().lower()
    stmt = select(models.User).where(models.User.email == email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    created = False

    if not user:
        display_name = payload.display_name or email.split("@", 1)[0]
        user = models.User(email=email, display_name=display_name)
        db.add(user)
        await db.flush()
        created = True
    elif payload.display_name:
        user.display_name = payload.display_name

    now = datetime.now(UTC)
    session_token = generate_token()
    session_hash = hash_token(session_token)
    session = models.UserSession(
        user_id=user.id,
        token_hash=session_hash,
        issued_at=now,
        expires_at=session_expiry(now),
        scope=payload.scope,
        ip_hash=None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(session)
    user.last_login_at = now
    if created and not user.email_verified_at:
        user.email_verified_at = now

    await db.commit()

    response = JSONResponse({
        "ok": True,
        "scope": payload.scope,
        "email": user.email,
    })
    _set_session_cookie(response, session_token, scope=payload.scope)
    return response


__all__ = [
    "router",
    "request_link",
    "verify_token",
    "logout",
    "session_status",
    "get_me",
    "get_me_site",
    "send_email_async",
    "AuthMagicLinkService",
    "test_login",
]
