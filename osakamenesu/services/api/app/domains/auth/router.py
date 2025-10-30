
from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ... import models
from ...db import get_session
from ...deps import require_dashboard_user, require_site_user
from ...schemas import AuthRequestLink, AuthVerifyRequest, UserPublic
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
    "get_me",
    "get_me_site",
    "send_email_async",
    "AuthMagicLinkService",
]
