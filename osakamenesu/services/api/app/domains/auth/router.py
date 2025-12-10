from __future__ import annotations

import os
from importlib import import_module
from typing import Awaitable, TypeVar

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ... import models
from ...db import get_session
from ...deps import (
    require_dashboard_user,
    require_site_user,
    get_optional_dashboard_user,
    get_optional_site_user,
)
from ...schemas import (
    AuthRequestLink,
    AuthVerifyRequest,
    AuthSessionStatus,
    AuthTestLoginRequest,
    UserPublic,
)
from ...utils.email import send_email_async as _send_email_async
from ...settings import settings as default_settings
from ...rate_limiters import rate_limit_auth
from .service import (
    AuthMagicLinkService,
    AuthRequestContext,
    AuthServiceError,
    AuthVerificationResult,
    _session_cookie_names,
    _settings_candidates,
)
from .line import LineAuthService, LineAuthError, line_auth_service
from .google import GoogleAuthService, GoogleAuthError, google_auth_service

_T = TypeVar("_T")


def _settings():
    for candidate in _settings_candidates():
        if getattr(candidate, "test_auth_secret", None) is not None:
            return candidate
    return next(_settings_candidates(), default_settings)


router = APIRouter(prefix="/api/auth", tags=["auth"])


async def send_email_async(**kwargs):
    return await _send_email_async(**kwargs)


_service = AuthMagicLinkService(mail_sender=lambda **kwargs: send_email_async(**kwargs))


def _resolve_cookie_settings():
    return next(_settings_candidates(), default_settings)


def _build_request_context(request: Request) -> AuthRequestContext:
    headers = {key.lower(): value for key, value in request.headers.items()}
    cookies = dict(request.cookies)
    client_host = request.client.host if request.client else None
    return AuthRequestContext(headers=headers, cookies=cookies, client_host=client_host)


async def _run_service(call: Awaitable[_T]):
    try:
        return await call
    except AuthServiceError as exc:  # pragma: no cover - HTTP adapter
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _set_session_cookie(
    response: Response, token: str, *, scope: str | None = None
) -> None:
    resolved = _resolve_cookie_settings()
    ttl_days = getattr(resolved, "auth_session_ttl_days", 30)
    max_age = max(1, ttl_days) * 24 * 60 * 60
    names = _session_cookie_names(scope) or _session_cookie_names()
    same_site_raw = (
        (getattr(resolved, "auth_session_cookie_same_site", "lax") or "lax")
        .strip()
        .lower()
    )
    same_site = same_site_raw if same_site_raw in {"lax", "strict", "none"} else "lax"
    secure = (
        bool(getattr(resolved, "auth_session_cookie_secure", False))
        or same_site == "none"
    )

    for name in names:
        response.set_cookie(
            key=name,
            value=token,
            max_age=max_age,
            httponly=True,
            secure=secure,
            samesite=same_site,
            domain=getattr(resolved, "auth_session_cookie_domain", None),
            path="/",
        )


@router.post("/request-link", status_code=status.HTTP_202_ACCEPTED)
async def request_link(
    payload: AuthRequestLink,
    request: Request,
    db: AsyncSession = Depends(get_session),
    _: None = Depends(rate_limit_auth),
):
    context = _build_request_context(request)
    return await _run_service(_service.request_link(payload, context, db))


@router.post("/verify")
async def verify_token(
    payload: AuthVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
    _: None = Depends(rate_limit_auth),
) -> JSONResponse:
    context = _build_request_context(request)
    result: AuthVerificationResult = await _run_service(
        _service.verify_token(payload, context, db)
    )
    response = JSONResponse({"ok": True, "scope": result.scope})
    _set_session_cookie(response, result.session_token, scope=result.scope)
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, db: AsyncSession = Depends(get_session)) -> Response:
    context = _build_request_context(request)
    await _run_service(_service.logout(context, db))

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    resolved = _resolve_cookie_settings()
    for name in _session_cookie_names():
        response.delete_cookie(
            key=name,
            domain=getattr(resolved, "auth_session_cookie_domain", None),
            path="/",
        )
    return response


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
    payload: AuthTestLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_session),
    x_test_auth_secret: str | None = Header(default=None, alias="X-Test-Auth-Secret"),
):
    settings_obj = _settings()
    expected_secret = getattr(settings_obj, "test_auth_secret", None) or os.getenv(
        "E2E_TEST_AUTH_SECRET"
    )
    if not expected_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_test_auth_secret"
        )
    if x_test_auth_secret != expected_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_test_auth_secret"
        )

    context = _build_request_context(request)
    session_token, scope, user = await _run_service(
        _service.test_login(payload, context, db)
    )
    response = JSONResponse(
        jsonable_encoder(
            {
                "ok": True,
                "scope": scope,
                "user": _to_user_public(user),
            }
        )
    )
    _set_session_cookie(response, session_token, scope=scope)
    return response


# =============================================================================
# LINE OAuth Endpoints
# =============================================================================


from pydantic import BaseModel


class LineLoginUrlRequest(BaseModel):
    redirect_path: str = "/therapist/settings"


class LineLoginUrlResponse(BaseModel):
    login_url: str
    state: str


class LineCallbackRequest(BaseModel):
    code: str
    state: str


class LineConnectionStatusResponse(BaseModel):
    connected: bool
    line_user_id: str | None = None
    display_name: str | None = None


@router.post("/line/login-url", response_model=LineLoginUrlResponse)
async def line_login_url(
    payload: LineLoginUrlRequest,
    _: None = Depends(rate_limit_auth),
):
    """Generate LINE OAuth authorization URL.

    Returns a URL that the client should redirect the user to for LINE authentication.
    """
    try:
        login_url, state = line_auth_service.generate_login_url(
            redirect_path=payload.redirect_path
        )
        return LineLoginUrlResponse(login_url=login_url, state=state)
    except LineAuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.post("/line/callback")
async def line_callback(
    payload: LineCallbackRequest,
    db: AsyncSession = Depends(get_session),
    _: None = Depends(rate_limit_auth),
) -> JSONResponse:
    """Handle LINE OAuth callback.

    Exchanges authorization code for access token, fetches user profile,
    and creates/updates user session.
    """
    try:
        result = await line_auth_service.authenticate(
            code=payload.code,
            db=db,
        )

        response = JSONResponse(
            {
                "ok": True,
                "scope": "site",
                "is_new_user": result.is_new_user,
                "session_token": result.session_token,
                "user": {
                    "id": str(result.user.id),
                    "display_name": result.user.display_name,
                },
            }
        )
        _set_session_cookie(response, result.session_token, scope="site")
        return response
    except LineAuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.get("/line/status", response_model=LineConnectionStatusResponse)
async def line_connection_status(
    user: models.User = Depends(require_site_user),
):
    """Get LINE connection status for the current user."""
    status = await line_auth_service.get_connection_status(user)
    return LineConnectionStatusResponse(**status)


# =============================================================================
# Google OAuth Endpoints
# =============================================================================


class GoogleLoginUrlRequest(BaseModel):
    redirect_path: str = "/therapist/settings"


class GoogleLoginUrlResponse(BaseModel):
    login_url: str
    state: str


class GoogleCallbackRequest(BaseModel):
    code: str
    state: str


class GoogleConnectionStatusResponse(BaseModel):
    connected: bool
    email: str | None = None
    display_name: str | None = None


@router.post("/google/login-url", response_model=GoogleLoginUrlResponse)
async def google_login_url(
    payload: GoogleLoginUrlRequest,
    _: None = Depends(rate_limit_auth),
):
    """Generate Google OAuth authorization URL.

    Returns a URL that the client should redirect the user to for Google authentication.
    """
    try:
        login_url, state = google_auth_service.generate_login_url(
            redirect_path=payload.redirect_path
        )
        return GoogleLoginUrlResponse(login_url=login_url, state=state)
    except GoogleAuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.post("/google/callback")
async def google_callback(
    payload: GoogleCallbackRequest,
    db: AsyncSession = Depends(get_session),
    _: None = Depends(rate_limit_auth),
) -> JSONResponse:
    """Handle Google OAuth callback.

    Exchanges authorization code for access token, fetches user profile,
    and creates/updates user session.
    """
    try:
        result = await google_auth_service.authenticate(
            code=payload.code,
            db=db,
        )

        response = JSONResponse(
            {
                "ok": True,
                "scope": "site",
                "is_new_user": result.is_new_user,
                "session_token": result.session_token,
                "user": {
                    "id": str(result.user.id),
                    "email": result.user.email,
                    "display_name": result.user.display_name,
                },
            }
        )
        _set_session_cookie(response, result.session_token, scope="site")
        return response
    except GoogleAuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.get("/google/status", response_model=GoogleConnectionStatusResponse)
async def google_connection_status(
    user: models.User = Depends(require_site_user),
):
    """Get Google connection status for the current user."""
    status = await google_auth_service.get_connection_status(user)
    return GoogleConnectionStatusResponse(**status)


__all__ = [
    "router",
    "request_link",
    "verify_token",
    "logout",
    "session_status",
    "get_me",
    "get_me_site",
    "test_login",
    "send_email_async",
    "AuthMagicLinkService",
    "line_login_url",
    "line_callback",
    "line_connection_status",
    "google_login_url",
    "google_callback",
    "google_connection_status",
]
