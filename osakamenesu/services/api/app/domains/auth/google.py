"""Google OAuth 2.0 authentication service.

This module handles Google Sign-In OAuth flow for user authentication.

Google OAuth 2.0 Flow:
1. Client calls /api/auth/google/login-url to get authorization URL
2. User is redirected to Google for authentication
3. Google redirects back to callback URL with authorization code
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

# Google OAuth endpoints
GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


class GoogleAuthError(Exception):
    """Google authentication error."""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


@dataclass
class GoogleUserProfile:
    """Google user profile data."""

    user_id: str
    email: str
    name: str
    picture_url: str | None = None
    verified_email: bool = False


@dataclass
class GoogleAuthResult:
    """Result of Google authentication."""

    user: models.User
    session_token: str
    is_new_user: bool
    google_profile: GoogleUserProfile


class GoogleAuthService:
    """Service for handling Google OAuth authentication."""

    def __init__(self, http_client: httpx.AsyncClient | None = None):
        self._http_client = http_client

    async def _get_http_client(self) -> httpx.AsyncClient:
        if self._http_client:
            return self._http_client
        return httpx.AsyncClient(timeout=30.0)

    def _ensure_configured(self) -> None:
        """Ensure Google OAuth is properly configured."""
        if not settings.google_client_id:
            raise GoogleAuthError("GOOGLE_CLIENT_ID is not configured", status_code=503)
        if not settings.google_client_secret:
            raise GoogleAuthError(
                "GOOGLE_CLIENT_SECRET is not configured", status_code=503
            )

    def _get_callback_url(self) -> str:
        """Get Google OAuth callback URL."""
        callback_url = settings.google_callback_url
        if not callback_url:
            base_url = settings.site_base_url or settings.api_origin
            callback_url = f"{base_url}/api/auth/google/callback"
        return callback_url

    def generate_login_url(
        self,
        redirect_path: str = "/therapist/settings",
        state: str | None = None,
    ) -> tuple[str, str]:
        """Generate Google OAuth authorization URL.

        Args:
            redirect_path: Path to redirect after successful authentication
            state: Optional state parameter for CSRF protection

        Returns:
            Tuple of (authorization_url, state)
        """
        self._ensure_configured()

        if state is None:
            state = secrets.token_urlsafe(32)

        params = {
            "response_type": "code",
            "client_id": settings.google_client_id,
            "redirect_uri": self._get_callback_url(),
            "state": state,
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account",
        }

        url = f"{GOOGLE_AUTHORIZE_URL}?{urlencode(params)}"
        return url, state

    async def exchange_code_for_token(self, code: str) -> dict[str, Any]:
        """Exchange authorization code for access token.

        Args:
            code: Authorization code from Google

        Returns:
            Token response containing access_token, id_token, etc.
        """
        self._ensure_configured()

        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self._get_callback_url(),
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
        }

        client = await self._get_http_client()
        try:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code != 200:
                logger.error(f"Google token exchange failed: {response.text}")
                raise GoogleAuthError(
                    f"Failed to exchange code for token: {response.status_code}",
                    status_code=401,
                )

            return response.json()
        finally:
            if not self._http_client:
                await client.aclose()

    async def get_user_profile(self, access_token: str) -> GoogleUserProfile:
        """Fetch Google user profile using access token.

        Args:
            access_token: Google access token

        Returns:
            GoogleUserProfile with user data
        """
        client = await self._get_http_client()
        try:
            response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if response.status_code != 200:
                logger.error(f"Google profile fetch failed: {response.text}")
                raise GoogleAuthError(
                    "Failed to fetch Google profile",
                    status_code=401,
                )

            data = response.json()
            return GoogleUserProfile(
                user_id=data["id"],
                email=data["email"],
                name=data.get("name", data["email"].split("@")[0]),
                picture_url=data.get("picture"),
                verified_email=data.get("verified_email", False),
            )
        finally:
            if not self._http_client:
                await client.aclose()

    async def authenticate(
        self,
        code: str,
        db: AsyncSession,
    ) -> GoogleAuthResult:
        """Complete Google OAuth authentication flow.

        1. Exchange code for token
        2. Fetch user profile
        3. Find or create user
        4. Create session

        Args:
            code: Authorization code from Google callback
            db: Database session

        Returns:
            GoogleAuthResult with user, session, and profile data
        """
        # Exchange code for token
        token_data = await self.exchange_code_for_token(code)
        access_token = token_data["access_token"]

        # Get user profile
        profile = await self.get_user_profile(access_token)

        # Validate email is verified
        if not profile.verified_email:
            raise GoogleAuthError(
                "Email not verified with Google",
                status_code=400,
            )

        # Find existing user by email (Google uses real email)
        result = await db.execute(
            select(models.User).where(models.User.email == profile.email)
        )
        user = result.scalar_one_or_none()
        is_new_user = user is None

        if is_new_user:
            # Create new user with Google email
            user = models.User(
                email=profile.email,
                display_name=profile.name,
                status="active",
            )
            db.add(user)
            await db.flush()
            logger.info(f"Created new user for Google email: {profile.email}")
        else:
            # Update display name if not set
            if not user.display_name and profile.name:
                user.display_name = profile.name
            logger.info(f"Found existing user for Google email: {profile.email}")

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
            scope="site",
        )
        db.add(session)

        # Update last login
        user.last_login_at = now

        await db.commit()

        return GoogleAuthResult(
            user=user,
            session_token=session_token,
            is_new_user=is_new_user,
            google_profile=profile,
        )

    async def get_connection_status(
        self,
        user: models.User,
    ) -> dict[str, Any]:
        """Get Google connection status for a user.

        Args:
            user: User to check

        Returns:
            Dict with connection status and Google profile info
        """
        # Check if user has a real email (not LINE placeholder)
        is_google_user = (
            user.email
            and not user.email.startswith("line_")
            and not user.email.endswith("@line.local")
        )

        if is_google_user:
            return {
                "connected": True,
                "email": user.email,
                "display_name": user.display_name,
            }

        return {
            "connected": False,
            "email": None,
            "display_name": None,
        }


# Singleton instance
google_auth_service = GoogleAuthService()
