"""Tests for LINE OAuth authentication.

Tests cover:
- Login URL generation
- Token exchange and user creation (mocked)
- Connection status endpoint
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.domains.auth.line import (
    LineAuthService,
    LineAuthError,
    LineUserProfile,
    line_auth_service,
)

client = TestClient(app)


class TestLineLoginUrl:
    """Tests for /api/auth/line/login-url endpoint."""

    def test_login_url_returns_503_when_not_configured(self):
        """Returns 503 when LINE_CHANNEL_ID is not configured."""
        # Mock the generate_login_url method to raise LineAuthError
        with patch.object(
            line_auth_service,
            "generate_login_url",
            side_effect=LineAuthError(
                "LINE_CHANNEL_ID is not configured", status_code=503
            ),
        ):
            response = client.post(
                "/api/auth/line/login-url",
                json={"redirect_path": "/therapist/settings"},
            )
            assert response.status_code == 503
            assert "not configured" in response.json()["detail"]

    def test_login_url_returns_url_when_configured(self):
        """Returns login URL when LINE is properly configured."""
        # Mock the generate_login_url method directly
        with patch.object(
            line_auth_service,
            "generate_login_url",
            return_value=(
                "https://access.line.me/oauth2/v2.1/authorize?client_id=test_channel_id",
                "test_state_123",
            ),
        ):
            response = client.post(
                "/api/auth/line/login-url",
                json={"redirect_path": "/therapist/settings"},
            )
            assert response.status_code == 200
            data = response.json()
            assert "login_url" in data
            assert "state" in data
            assert "access.line.me" in data["login_url"]
            assert "test_channel_id" in data["login_url"]

    def test_login_url_includes_state_parameter(self):
        """Login URL includes state parameter for CSRF protection."""
        with patch.object(
            line_auth_service,
            "generate_login_url",
            return_value=(
                "https://access.line.me/oauth2/v2.1/authorize?state=secure_state_abc",
                "secure_state_abc",
            ),
        ):
            response = client.post(
                "/api/auth/line/login-url",
                json={"redirect_path": "/therapist/settings"},
            )
            assert response.status_code == 200
            data = response.json()
            assert len(data["state"]) > 10  # Ensure state is sufficiently long


class TestLineAuthService:
    """Tests for LineAuthService class."""

    def test_generate_login_url_with_custom_redirect_path(self):
        """Login URL respects custom redirect path."""
        # Create a new service instance and mock _ensure_configured
        service = LineAuthService()
        with patch.object(service, "_ensure_configured"):
            # Mock settings for this test
            with patch("app.domains.auth.line.settings") as mock_settings:
                mock_settings.line_channel_id = "test_channel_id"
                mock_settings.line_callback_url = "https://example.com/callback"

                url, state = service.generate_login_url(redirect_path="/custom/path")
                assert "access.line.me" in url
                assert state is not None

    def test_generate_login_url_uses_site_base_url_fallback(self):
        """Falls back to site_base_url when line_callback_url is not set."""
        service = LineAuthService()
        with patch.object(service, "_ensure_configured"):
            with patch("app.domains.auth.line.settings") as mock_settings:
                mock_settings.line_channel_id = "test_channel_id"
                mock_settings.line_callback_url = None
                mock_settings.site_base_url = "https://site.example.com"
                mock_settings.api_origin = "https://api.example.com"

                url, _ = service.generate_login_url()
                assert "site.example.com" in url

    def test_ensure_configured_raises_when_channel_id_missing(self):
        """Raises error when LINE_CHANNEL_ID is missing."""
        service = LineAuthService()
        with patch("app.domains.auth.line.settings") as mock_settings:
            mock_settings.line_channel_id = None
            with pytest.raises(LineAuthError) as exc_info:
                service._ensure_configured()
            assert exc_info.value.status_code == 503

    def test_ensure_configured_raises_when_channel_secret_missing(self):
        """Raises error when LINE_CHANNEL_SECRET is missing."""
        service = LineAuthService()
        with patch("app.domains.auth.line.settings") as mock_settings:
            mock_settings.line_channel_id = "test_id"
            mock_settings.line_channel_secret = None
            with pytest.raises(LineAuthError) as exc_info:
                service._ensure_configured()
            assert exc_info.value.status_code == 503


class TestLineUserProfile:
    """Tests for LineUserProfile dataclass."""

    def test_user_profile_creation(self):
        """LineUserProfile can be created with required fields."""
        profile = LineUserProfile(
            user_id="U1234567890",
            display_name="Test User",
        )
        assert profile.user_id == "U1234567890"
        assert profile.display_name == "Test User"
        assert profile.picture_url is None
        assert profile.status_message is None

    def test_user_profile_with_optional_fields(self):
        """LineUserProfile handles optional fields."""
        profile = LineUserProfile(
            user_id="U1234567890",
            display_name="Test User",
            picture_url="https://example.com/picture.jpg",
            status_message="Hello world",
        )
        assert profile.picture_url == "https://example.com/picture.jpg"
        assert profile.status_message == "Hello world"


class TestConnectionStatus:
    """Tests for LINE connection status detection."""

    @pytest.mark.asyncio
    async def test_connected_user_detection(self):
        """Detects user with LINE connection."""
        mock_user = MagicMock()
        mock_user.email = "line_U1234567890@line.local"
        mock_user.display_name = "LINE User"

        service = LineAuthService()
        status = await service.get_connection_status(mock_user)

        assert status["connected"] is True
        assert status["line_user_id"] == "U1234567890"
        assert status["display_name"] == "LINE User"

    @pytest.mark.asyncio
    async def test_non_connected_user_detection(self):
        """Detects user without LINE connection."""
        mock_user = MagicMock()
        mock_user.email = "regular@example.com"
        mock_user.display_name = "Regular User"

        service = LineAuthService()
        status = await service.get_connection_status(mock_user)

        assert status["connected"] is False
        assert status["line_user_id"] is None


class TestLineCallback:
    """Tests for LINE OAuth callback endpoint."""

    def test_callback_requires_code_and_state(self):
        """Callback endpoint requires code and state parameters."""
        response = client.post(
            "/api/auth/line/callback",
            json={},
        )
        assert response.status_code == 422  # Validation error

    def test_callback_with_invalid_code(self):
        """Callback returns error for invalid code."""
        # Mock the authenticate method to raise an error
        with patch.object(
            line_auth_service,
            "authenticate",
            side_effect=LineAuthError(
                "Failed to exchange code for token", status_code=401
            ),
        ):
            response = client.post(
                "/api/auth/line/callback",
                json={"code": "invalid_code", "state": "test_state"},
            )
            # Should fail during authentication
            assert response.status_code == 401
