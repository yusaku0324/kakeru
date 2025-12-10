"""Shared test fixtures for dashboard tests."""

from __future__ import annotations

import sys
import types
import uuid
from datetime import datetime, UTC
from pathlib import Path
from types import SimpleNamespace
from typing import Any, List, Optional


class DummySettings:
    """Dummy settings for testing without real database or external services."""

    def __init__(self) -> None:
        self.database_url = "postgresql+asyncpg://app:app@localhost:5432/osaka_menesu"
        self.api_origin = "http://localhost:3000"
        self.api_public_base_url = "http://localhost:8000"
        self.meili_host = "http://127.0.0.1:7700"
        self.meili_master_key = "dev_key"
        self.admin_api_key = "dev_admin_key"
        self.rate_limit_redis_url = None
        self.rate_limit_namespace = "test"
        self.rate_limit_redis_error_cooldown = 0.0
        self.init_db_on_startup = False
        self.slack_webhook_url = None
        self.notify_email_endpoint = None
        self.notify_line_endpoint = None
        self.notify_from_email = None
        self.mail_api_key = "test-mail-key"
        self.mail_from_address = "no-reply@example.com"
        self.mail_provider_base_url = "https://api.resend.com"
        self.dashboard_session_cookie_name = "osakamenesu_session"
        self.site_session_cookie_name = "osakamenesu_session"
        self.escalation_pending_threshold_minutes = 30
        self.escalation_check_interval_minutes = 5
        self.site_base_url = None
        self.reservation_notification_max_attempts = 3
        self.reservation_notification_retry_base_seconds = 1
        self.reservation_notification_retry_backoff_multiplier = 2.0
        self.reservation_notification_worker_interval_seconds = 1.0
        self.reservation_notification_batch_size = 10
        # Media storage settings
        self.media_storage_backend = "local"
        self.media_local_directory = "test-media"
        self.media_url_prefix = "/media"
        self.media_cdn_base_url = None
        self.media_s3_bucket = None
        self.media_s3_region = None
        self.media_s3_endpoint = None
        self.media_s3_access_key_id = None
        self.media_s3_secret_access_key = None

    @property
    def media_root(self) -> Path:
        return Path.cwd() / self.media_local_directory


def setup_dummy_settings() -> None:
    """Set up dummy settings module in sys.modules if not already present."""
    if "app.settings" not in sys.modules:
        dummy_settings_module = types.ModuleType("app.settings")
        dummy_settings_module.Settings = DummySettings  # type: ignore[attr-defined]
        dummy_settings_module.settings = DummySettings()  # type: ignore[attr-defined]
        sys.modules["app.settings"] = dummy_settings_module


# Import app.models after setting up dummy settings
setup_dummy_settings()
from app import models


class DummyUser:
    """Minimal user stub for dashboard auth."""

    def __init__(self, user_id: uuid.UUID | None = None) -> None:
        self.id = user_id or uuid.uuid4()
        self.email = "shop@example.com"
        self.role = "dashboard"


class DummyShopManager:
    """Minimal shop manager stub."""

    def __init__(
        self,
        user_id: uuid.UUID,
        shop_id: uuid.UUID,
        role: str = "owner",
    ) -> None:
        self.id = uuid.uuid4()
        self.user_id = user_id
        self.shop_id = shop_id
        self.role = role


class DummyProfile:
    """Minimal profile stub."""

    def __init__(self, profile_id: uuid.UUID | None = None) -> None:
        self.id = profile_id or uuid.uuid4()
        self.name = "Test Shop"


class DummyReview:
    """Minimal review stub."""

    def __init__(self, profile_id: uuid.UUID, status: str = "pending") -> None:
        now = datetime.now(UTC)
        self.id = uuid.uuid4()
        self.profile_id = profile_id
        self.status = status
        self.score = 4
        self.title = "Great service"
        self.body = "Really enjoyed my visit"
        self.author_alias = "Anonymous"
        self.visited_at = None
        self.created_at = now
        self.updated_at = now
        self.aspect_scores = {}


class FakeRequest:
    """Fake request stub for dashboard endpoints."""

    def __init__(self) -> None:
        self.headers: dict[str, str] = {}
        self.client = SimpleNamespace(host="127.0.0.1")


class _ScalarOneOrNoneResult:
    """Result wrapper that supports scalar_one_or_none()."""

    def __init__(self, items: List[Any]) -> None:
        self._items = items

    def scalar_one_or_none(self) -> Any:
        return self._items[0] if self._items else None


class _ScalarsAllResult:
    """Result wrapper that supports scalars().all() and iteration."""

    def __init__(self, items: List[Any]) -> None:
        self._items = items

    def __iter__(self):
        return iter(self._items)

    def all(self) -> List[Any]:
        return self._items

    def first(self) -> Any:
        return self._items[0] if self._items else None


class _ExecuteResult:
    """Result wrapper that supports scalars() and scalar_one_or_none()."""

    def __init__(self, items: List[Any]) -> None:
        self._items = items

    def scalars(self) -> _ScalarsAllResult:
        return _ScalarsAllResult(self._items)

    def scalar_one_or_none(self) -> Any:
        return self._items[0] if self._items else None


class FakeSession:
    """Fake session stub for dashboard tests.

    Supports:
    - get(model, pk) for Profile lookups
    - execute(stmt) for ShopManager lookups
    - commit(), flush(), refresh(), add()
    """

    def __init__(
        self,
        profile: models.Profile | None = None,
        shop_managers: List[DummyShopManager] | None = None,
    ) -> None:
        self._profile = profile
        self._shop_managers = shop_managers or []
        self.committed = False
        self.refreshed = False
        self.added: List[Any] = []

    async def get(self, model: type, pk: uuid.UUID) -> Any:
        if model is models.Profile and self._profile and pk == self._profile.id:
            return self._profile
        return None

    async def execute(self, stmt: Any) -> _ExecuteResult:
        return _ExecuteResult(self._shop_managers)

    async def commit(self) -> None:
        self.committed = True

    async def flush(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def refresh(self, instance: Any) -> None:
        self.refreshed = True

    def add(self, instance: Any) -> None:
        self.added.append(instance)


class FakeListSession:
    """Fake session stub for list operations."""

    def __init__(self, profiles: List[models.Profile]) -> None:
        self._profiles = profiles

    async def execute(self, stmt: Any) -> _ExecuteResult:
        return _ExecuteResult(self._profiles)


class DummySession:
    """Session stub for review API tests.

    Supports:
    - get(model, pk) for Profile and Review lookups
    - execute(stmt) for ShopManager lookups
    - scalar(stmt) for count queries
    - scalars(stmt) for listing reviews
    - commit(), refresh()
    """

    def __init__(
        self,
        profile: DummyProfile | None = None,
        reviews: List[DummyReview] | None = None,
        scalar_values: List[Any] | None = None,
        shop_managers: List[DummyShopManager] | None = None,
    ) -> None:
        self.profile = profile
        self.reviews = reviews or []
        self.scalar_values = scalar_values or []
        self.shop_managers = shop_managers or []
        self._scalar_index = 0
        self._committed = False

    async def get(self, model_class: type, pk: uuid.UUID) -> Any:
        if model_class == models.Profile:
            return self.profile
        if model_class == models.Review:
            for r in self.reviews:
                if r.id == pk:
                    return r
            return None
        return None

    async def execute(self, stmt: Any) -> _ScalarOneOrNoneResult:
        return _ScalarOneOrNoneResult(self.shop_managers)

    async def scalar(self, stmt: Any) -> Any:
        if self._scalar_index < len(self.scalar_values):
            val = self.scalar_values[self._scalar_index]
            self._scalar_index += 1
            return val
        return 0

    async def scalars(self, stmt: Any) -> _ScalarsAllResult:
        return _ScalarsAllResult(self.reviews)

    async def commit(self) -> None:
        self._committed = True

    async def refresh(self, obj: Any) -> None:
        pass
