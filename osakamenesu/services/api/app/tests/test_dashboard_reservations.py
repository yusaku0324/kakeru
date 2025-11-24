import datetime
import os
import sys
import types
import uuid
import importlib

from pathlib import Path

_HELPER_DIR = Path(__file__).resolve().parent
if str(_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_HELPER_DIR))

from _path_setup import configure_paths
from types import SimpleNamespace

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
        self.reservation_notification_max_attempts = 3
        self.reservation_notification_retry_base_seconds = 1
        self.reservation_notification_retry_backoff_multiplier = 2.0
        self.reservation_notification_worker_interval_seconds = 1.0
        self.reservation_notification_batch_size = 10
        self.test_auth_secret = "secret"
        self.cursor_signature_secret = "cursor-secret"


dummy_settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
dummy_settings_module.settings = _DummySettings()
sys.modules.setdefault("app.settings", dummy_settings_module)

router_module = importlib.import_module("app.domains.dashboard.reservations.router")
from app.domains.dashboard.reservations.router import (  # type: ignore  # noqa: E402
    _decode_cursor,
    _encode_cursor,
    _parse_date_param,
    _serialize_reservation,
)


def _make_slot(start_offset: int, duration: int, status: str):
    base = datetime.datetime(2025, 5, 1, 12, 0, tzinfo=datetime.UTC)
    start = base + datetime.timedelta(minutes=start_offset)
    end = start + datetime.timedelta(minutes=duration)
    return SimpleNamespace(
        desired_start=start,
        desired_end=end,
        status=status,
    )


def test_serialize_reservation_rounds_out_optional_fields() -> None:
    reservation_id = uuid.uuid4()
    profile_id = uuid.uuid4()
    created_at = datetime.datetime(2025, 5, 1, 3, 0, tzinfo=datetime.UTC)
    updated_at = created_at + datetime.timedelta(minutes=5)

    reservation = SimpleNamespace(
        id=reservation_id,
        status='pending',
        channel='web',
        desired_start=datetime.datetime(2025, 5, 1, 12, 0, tzinfo=datetime.UTC),
        desired_end=datetime.datetime(2025, 5, 1, 13, 30, tzinfo=datetime.UTC),
        customer_name='山田太郎',
        customer_phone='09000000000',
        customer_email='guest@example.com',
        notes='希望: アロマ',
        marketing_opt_in=True,
        staff_id=None,
        created_at=created_at,
        updated_at=updated_at,
        approval_decision='approved',
        approval_decided_at=created_at + datetime.timedelta(hours=1),
        approval_decided_by='line',
        reminder_scheduled_at=created_at + datetime.timedelta(hours=9),
        preferred_slots=[
            _make_slot(0, 90, 'open'),
            _make_slot(120, 90, 'tentative'),
        ],
        shop_id=profile_id,
    )

    serialized = _serialize_reservation(reservation)

    assert serialized.id == reservation_id
    assert serialized.status == 'pending'
    assert serialized.channel == 'web'
    assert serialized.customer_name == '山田太郎'
    assert serialized.customer_phone == '09000000000'
    assert serialized.customer_email == 'guest@example.com'
    assert serialized.notes == '希望: アロマ'
    assert serialized.marketing_opt_in is True
    assert serialized.staff_id is None
    assert serialized.created_at == created_at
    assert serialized.updated_at == updated_at
    assert serialized.approval_decision == 'approved'
    assert serialized.approval_decided_by == 'line'
    assert serialized.preferred_slots[0].status == 'open'
    assert serialized.preferred_slots[1].status == 'tentative'


def test_parse_date_param_accepts_date_only_start() -> None:
    parsed = _parse_date_param('2025-11-05', field='start')

    assert parsed.year == 2025
    assert parsed.month == 11
    assert parsed.day == 5
    assert parsed.hour == 0
    assert parsed.minute == 0
    assert parsed.tzinfo is not None


def test_parse_date_param_accepts_date_only_end() -> None:
    parsed = _parse_date_param('2025-11-05', field='end', is_end=True)

    assert parsed.year == 2025
    assert parsed.hour == 23
    assert parsed.minute == 59
    assert parsed.second == 59
    assert parsed.microsecond == 999999


def test_parse_date_param_converts_offset_to_utc() -> None:
    parsed = _parse_date_param('2025-11-05T15:00:00+09:00', field='start')

    assert parsed.hour == 6  # converted to UTC
    assert parsed.tzinfo is not None


def test_parse_date_param_raises_on_invalid_input() -> None:
    with pytest.raises(HTTPException):
        _parse_date_param('invalid-date', field='start')


def test_encode_decode_cursor_roundtrip() -> None:
    reservation_id = uuid.uuid4()
    timestamp = datetime.datetime(2025, 11, 5, 12, 0, tzinfo=datetime.UTC)
    encoded = _encode_cursor(timestamp, reservation_id)
    decoded_value, decoded_id = _decode_cursor(encoded)
    assert decoded_id == reservation_id
    assert decoded_value == timestamp.astimezone(datetime.timezone.utc)


def test_decode_cursor_invalid() -> None:
    with pytest.raises(HTTPException):
        _decode_cursor('invalid-cursor')


def test_decode_cursor_signature_mismatch() -> None:
    reservation_id = uuid.uuid4()
    timestamp = datetime.datetime(2025, 11, 5, 12, 0, tzinfo=datetime.UTC)
    settings_obj = router_module.settings
    original = getattr(settings_obj, "cursor_signature_secret", None)
    settings_obj.cursor_signature_secret = "cursor-secret"
    encoded = _encode_cursor(timestamp, reservation_id)
    settings_obj.cursor_signature_secret = "cursor-secret-mismatch"
    with pytest.raises(HTTPException):
        _decode_cursor(encoded)
    settings_obj.cursor_signature_secret = original
