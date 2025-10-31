
from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ... import models
from ...db import get_session
from ...deps import require_dashboard_user, require_site_user, get_optional_dashboard_user, get_optional_site_user
from ...schemas import AuthRequestLink, AuthVerifyRequest, AuthSessionStatus, UserPublic
from ...utils.email import send_email_async as _send_email_async
from .service import AuthMagicLinkService

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def send_email_async(**kwargs):
    return await _send_email_async(**kwargs)


_service = AuthMagicLinkService(mail_sender=lambda **kwargs: send_email_async(**kwargs))


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
]
