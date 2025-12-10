"""LINE OAuth 2.1 authentication service.

This module handles LINE Login OAuth flow for therapist authentication.

LINE Login OAuth 2.1 Flow:
1. Client calls /api/auth/line/login-url to get authorization URL
2. User is redirected to LINE for authentication
3. LINE redirects back to callback URL with authorization code
4. Backend exchanges code for access token and fetches user profile
5. Backend creates/updates user and issues session token
"""

from __future__ import annotations

import secrets
import logging
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...settings import settings
from ... import models
from ...utils.auth import generate_token, hash_token, session_expiry

logger = logging.getLogger(__name__)

# LINE OAuth endpoints
LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize"
LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token"
LINE_PROFILE_URL = "https://api.line.me/v2/profile"
LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify"


class LineAuthError(Exception):
    """LINE authentication error."""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


@dataclass
class LineUserProfile:
    """LINE user profile data."""

    user_id: str
    display_name: str
    picture_url: str | None = None
    status_message: str | None = None


@dataclass
class LineAuthResult:
    """Result of LINE authentication."""

    user: models.User
    session_token: str
    is_new_user: bool
    line_profile: LineUserProfile


class LineAuthService:
    """Service for handling LINE OAuth authentication."""

    def __init__(self, http_client: httpx.AsyncClient | None = None):
        self._http_client = http_client

    async def _get_http_client(self) -> httpx.AsyncClient:
        if self._http_client:
            return self._http_client
        return httpx.AsyncClient(timeout=30.0)

    def _ensure_configured(self) -> None:
        """Ensure LINE OAuth is properly configured."""
        if not settings.line_channel_id:
            raise LineAuthError("LINE_CHANNEL_ID is not configured", status_code=503)
        if not settings.line_channel_secret:
            raise LineAuthError(
                "LINE_CHANNEL_SECRET is not configured", status_code=503
            )

    def generate_login_url(
        self,
        redirect_path: str = "/therapist/settings",
        state: str | None = None,
    ) -> tuple[str, str]:
        """Generate LINE OAuth authorization URL.

        Args:
            redirect_path: Path to redirect after successful authentication
            state: Optional state parameter for CSRF protection

        Returns:
            Tuple of (authorization_url, state)
        """
        self._ensure_configured()

        if state is None:
            state = secrets.token_urlsafe(32)

        # Determine callback URL
        callback_url = settings.line_callback_url
        if not callback_url:
            base_url = settings.site_base_url or settings.api_origin
            callback_url = f"{base_url}/api/auth/line/callback"

        params = {
            "response_type": "code",
            "client_id": settings.line_channel_id,
            "redirect_uri": callback_url,
            "state": state,
            "scope": "profile openid",
        }

        url = f"{LINE_AUTHORIZE_URL}?{urlencode(params)}"
        return url, state

    async def exchange_code_for_token(self, code: str) -> dict[str, Any]:
        """Exchange authorization code for access token.

        Args:
            code: Authorization code from LINE

        Returns:
            Token response containing access_token, id_token, etc.
        """
        self._ensure_configured()

        callback_url = settings.line_callback_url
        if not callback_url:
            base_url = settings.site_base_url or settings.api_origin
            callback_url = f"{base_url}/api/auth/line/callback"

        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": callback_url,
            "client_id": settings.line_channel_id,
            "client_secret": settings.line_channel_secret,
        }

        client = await self._get_http_client()
        try:
            response = await client.post(
                LINE_TOKEN_URL,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code != 200:
                logger.error(f"LINE token exchange failed: {response.text}")
                raise LineAuthError(
                    f"Failed to exchange code for token: {response.status_code}",
                    status_code=401,
                )

            return response.json()
        finally:
            if not self._http_client:
                await client.aclose()

    async def get_user_profile(self, access_token: str) -> LineUserProfile:
        """Fetch LINE user profile using access token.

        Args:
            access_token: LINE access token

        Returns:
            LineUserProfile with user data
        """
        client = await self._get_http_client()
        try:
            response = await client.get(
                LINE_PROFILE_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if response.status_code != 200:
                logger.error(f"LINE profile fetch failed: {response.text}")
                raise LineAuthError(
                    "Failed to fetch LINE profile",
                    status_code=401,
                )

            data = response.json()
            return LineUserProfile(
                user_id=data["userId"],
                display_name=data["displayName"],
                picture_url=data.get("pictureUrl"),
                status_message=data.get("statusMessage"),
            )
        finally:
            if not self._http_client:
                await client.aclose()

    async def authenticate(
        self,
        code: str,
        db: AsyncSession,
    ) -> LineAuthResult:
        """Complete LINE OAuth authentication flow.

        1. Exchange code for token
        2. Fetch user profile
        3. Find or create user
        4. Create session

        Args:
            code: Authorization code from LINE callback
            db: Database session

        Returns:
            LineAuthResult with user, session, and profile data
        """
        # Exchange code for token
        token_data = await self.exchange_code_for_token(code)
        access_token = token_data["access_token"]

        # Get user profile
        profile = await self.get_user_profile(access_token)

        # Find existing user by LINE user ID
        # Note: Currently users table uses email as unique identifier.
        # For LINE-only auth, we'll use a placeholder email pattern.
        line_email = f"line_{profile.user_id}@line.local"

        result = await db.execute(
            select(models.User).where(models.User.email == line_email)
        )
        user = result.scalar_one_or_none()
        is_new_user = user is None

        if is_new_user:
            # Create new user
            user = models.User(
                email=line_email,
                display_name=profile.display_name,
                status="active",
            )
            db.add(user)
            await db.flush()
            logger.info(f"Created new user for LINE ID: {profile.user_id}")
        else:
            # Update display name if changed
            if user.display_name != profile.display_name:
                user.display_name = profile.display_name
            logger.info(f"Found existing user for LINE ID: {profile.user_id}")

        # Create session token
        from datetime import datetime, UTC

        now = datetime.now(UTC)
        session_token = generate_token()
        session_hash = hash_token(session_token)
        session = models.UserSession(
            user_id=user.id,
            token_hash=session_hash,
            issued_at=now,
            expires_at=session_expiry(now),
            scope="site",  # therapist portal uses site scope
        )
        db.add(session)

        # Update last login
        user.last_login_at = now

        await db.commit()

        return LineAuthResult(
            user=user,
            session_token=session_token,
            is_new_user=is_new_user,
            line_profile=profile,
        )

    async def get_connection_status(
        self,
        user: models.User,
    ) -> dict[str, Any]:
        """Get LINE connection status for a user.

        Args:
            user: User to check

        Returns:
            Dict with connection status and LINE profile info
        """
        # Check if user has LINE connection (email starts with line_)
        is_connected = user.email.startswith("line_") if user.email else False

        if is_connected:
            # Extract LINE user ID from email
            line_user_id = user.email.replace("line_", "").replace("@line.local", "")
            return {
                "connected": True,
                "line_user_id": line_user_id,
                "display_name": user.display_name,
            }

        return {
            "connected": False,
            "line_user_id": None,
            "display_name": None,
        }


# Singleton instance
line_auth_service = LineAuthService()
