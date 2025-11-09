import os
import sys
import types
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path

_HELPER_DIR = Path(__file__).resolve().parent
if str(_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_HELPER_DIR))

from _path_setup import configure_paths
from typing import Any, List, Sequence, Tuple

import pytest
from fastapi import HTTPException

ROOT = configure_paths(Path(__file__))

for key in [
    "PROJECT_NAME",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "POSTGRES_HOST",
    "POSTGRES_PORT",
    "API_PORT",
    "API_HOST",
    "NEXT_PUBLIC_API_BASE",
    "API_INTERNAL_BASE",
    "ADMIN_BASIC_USER",
    "ADMIN_BASIC_PASS",
]:
    os.environ.pop(key, None)


dummy_settings_module = types.ModuleType("app.settings")


class _DummySettings:
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
        self.auth_magic_link_expire_minutes = 15
        self.auth_magic_link_rate_limit = 5
        self.auth_session_ttl_days = 30
        self.auth_session_cookie_secure = False
        self.auth_session_cookie_domain = None
        self.auth_session_cookie_same_site = "lax"
        self.auth_magic_link_redirect_path = "/auth/complete"
        self.auth_magic_link_debug = True
        self.reservation_notification_max_attempts = 5
        self.reservation_notification_retry_base_seconds = 30
        self.reservation_notification_retry_backoff_multiplier = 2.0
        self.reservation_notification_worker_interval_seconds = 1.0
        self.reservation_notification_batch_size = 20
        self.ops_api_token: str | None = None
        self.test_auth_secret = "secret"

    @property
    def auth_session_cookie_name(self) -> str:
        return self.dashboard_session_cookie_name


dummy_settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
dummy_settings_module.settings = _DummySettings()
sys.modules["app.settings"] = dummy_settings_module

import importlib

ops_module = importlib.import_module("app.domains.ops.router")  # type: ignore  # noqa: E402
from app.schemas import (  # type: ignore  # noqa: E402
    OpsOutboxChannelSummary,
    OpsOutboxSummary,
    OpsQueueStats,
    OpsSlotsSummary,
)


class FakeResult:
    def __init__(self, row: Sequence[Any] | None = None, rows: Sequence[Tuple[Any, ...]] | None = None) -> None:
        self._row = row
        self._rows = list(rows or [])

    def one(self) -> Sequence[Any] | None:
        return self._row

    def all(self) -> List[Tuple[Any, ...]]:
        return list(self._rows)


class FakeSession:
    def __init__(self, *, results: List[FakeResult] | None = None, scalars: List[int] | None = None) -> None:
        self._results = list(results or [])
        self._scalars = list(scalars or [])
        self.executed_statements: List[Any] = []
        self.scalar_statements: List[Any] = []

    async def execute(self, stmt: Any) -> FakeResult:
        self.executed_statements.append(stmt)
        if not self._results:
            raise AssertionError("No more fake results configured")
        return self._results.pop(0)

    async def scalar(self, stmt: Any) -> int:
        self.scalar_statements.append(stmt)
        if not self._scalars:
            raise AssertionError("No more fake scalar values configured")
        return self._scalars.pop(0)


@pytest.mark.anyio
async def test_queue_stats_computes_lag(monkeypatch: pytest.MonkeyPatch) -> None:
    now = datetime(2025, 11, 7, 2, 30, tzinfo=timezone.utc)
    oldest = datetime(2025, 11, 7, 2, 0, tzinfo=timezone.utc)
    next_attempt = datetime(2025, 11, 7, 2, 31, tzinfo=timezone.utc)
    session = FakeSession(results=[FakeResult(row=(5, oldest, next_attempt))])

    monkeypatch.setattr(ops_module, "_utcnow", lambda: now)

    stats = await ops_module._get_queue_stats(session)

    assert isinstance(stats, OpsQueueStats)
    assert stats.pending == 5
    assert stats.lag_seconds == pytest.approx(1800.0)
    assert stats.oldest_created_at == oldest
    assert stats.next_attempt_at == next_attempt


@pytest.mark.anyio
async def test_queue_stats_returns_zero_when_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    now = datetime(2025, 11, 7, 2, 30, tzinfo=timezone.utc)
    session = FakeSession(results=[FakeResult(row=(0, None, None))])
    monkeypatch.setattr(ops_module, "_utcnow", lambda: now)

    stats = await ops_module._get_queue_stats(session)

    assert stats.pending == 0
    assert stats.lag_seconds == 0.0
    assert stats.oldest_created_at is None
    assert stats.next_attempt_at is None


@pytest.mark.anyio
async def test_outbox_summary_groups_by_channel() -> None:
    rows = [
        ("email", 3),
        ("line", 2),
        ("slack", 1),
    ]
    session = FakeSession(results=[FakeResult(rows=rows)])

    summary = await ops_module._get_outbox_summary(session)

    assert isinstance(summary, OpsOutboxSummary)
    assert summary.channels == [
        OpsOutboxChannelSummary(channel="email", pending=3),
        OpsOutboxChannelSummary(channel="line", pending=2),
        OpsOutboxChannelSummary(channel="slack", pending=1),
    ]


@pytest.mark.anyio
async def test_slots_summary_counts_pending_and_confirmed(monkeypatch: pytest.MonkeyPatch) -> None:
    now = datetime(2025, 11, 7, 5, 0, tzinfo=UTC)
    session = FakeSession(scalars=[7, 2, 4])
    monkeypatch.setattr(ops_module, "_utcnow", lambda: now)

    summary = await ops_module._get_slots_summary(session)

    assert isinstance(summary, OpsSlotsSummary)
    assert summary.pending_total == 7
    assert summary.pending_stale == 2
    assert summary.confirmed_next_24h == 4
    assert summary.window_start == now
    assert summary.window_end == now + timedelta(hours=24)


def test_require_ops_token_allows_when_disabled() -> None:
    ops_module.settings.ops_api_token = None
    ops_module.require_ops_token(None)


def test_require_ops_token_validates_bearer(monkeypatch: pytest.MonkeyPatch) -> None:
    ops_module.settings.ops_api_token = "secret-token"

    with pytest.raises(HTTPException):
        ops_module.require_ops_token(None)

    with pytest.raises(HTTPException):
        ops_module.require_ops_token("Bearer wrong")

    ops_module.require_ops_token("Bearer secret-token")
    ops_module.require_ops_token("secret-token")
