import os
import sys
import time
import types
from pathlib import Path

_HELPER_DIR = Path(__file__).resolve().parent
if str(_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_HELPER_DIR))

from _path_setup import configure_paths

import pytest
from fastapi import HTTPException
from starlette.requests import Request

ROOT = configure_paths(Path(__file__))

for key in [
    "API_PROXY_HMAC_SECRET",
    "PROXY_SHARED_SECRET",
]:
    os.environ.pop(key, None)

dummy_settings_module = types.ModuleType("app.settings")


class _DummySettings:
    def __init__(self) -> None:
        self.proxy_shared_secret = "unit-test-secret"


dummy_settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
dummy_settings_module.settings = _DummySettings()
sys.modules["app.settings"] = dummy_settings_module

from app.utils.proxy import (  # noqa: E402  # isort: skip
    MAX_SKEW_SECONDS,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    verify_proxy_signature,
    settings as proxy_settings,
)


def make_request(
    *,
    method: str = "POST",
    path: str = "/api/line/webhook",
    query_string: str = "",
    headers: dict[str, str] | None = None,
) -> Request:
    raw_headers = []
    if headers:
        for key, value in headers.items():
            raw_headers.append((key.lower().encode("latin-1"), value.encode("latin-1")))

    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "path": path,
        "raw_path": path.encode("latin-1"),
        "root_path": "",
        "scheme": "http",
        "query_string": query_string.encode("latin-1"),
        "headers": raw_headers,
        "client": ("test", 123),
        "server": ("testserver", 80),
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive)


def sign(secret: str, payload: str) -> str:
    import hmac
    from hashlib import sha256

    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), sha256).hexdigest()


@pytest.fixture(autouse=True)
def ensure_secret(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(proxy_settings, "proxy_shared_secret", "unit-test-secret", raising=False)


def test_verify_signature_success():
    timestamp = str(int(time.time()))
    payload = f"{timestamp}:POST:/api/line/webhook"
    signature = sign(proxy_settings.proxy_shared_secret or "", payload)
    headers = {
        SIGNATURE_HEADER: signature,
        TIMESTAMP_HEADER: timestamp,
    }
    request = make_request(headers=headers)
    verify_proxy_signature(request)


def test_verify_signature_with_query():
    timestamp = str(int(time.time()))
    payload = f"{timestamp}:POST:/api/line/ping?mode=test"
    signature = sign(proxy_settings.proxy_shared_secret or "", payload)
    headers = {
        SIGNATURE_HEADER: signature,
        TIMESTAMP_HEADER: timestamp,
    }
    request = make_request(path="/api/line/ping", query_string="mode=test", headers=headers)
    verify_proxy_signature(request)


@pytest.mark.parametrize(
    "headers,expected_status",
    [
        ({}, 401),
        ({TIMESTAMP_HEADER: "123"}, 401),
        ({SIGNATURE_HEADER: "abc"}, 401),
    ],
)
def test_missing_headers(headers: dict[str, str], expected_status: int):
    request = make_request(headers=headers)
    with pytest.raises(HTTPException) as exc:
        verify_proxy_signature(request)
    assert exc.value.status_code == expected_status


def test_invalid_timestamp():
    headers = {
        SIGNATURE_HEADER: "abcd",
        TIMESTAMP_HEADER: "not-an-int",
    }
    request = make_request(headers=headers)
    with pytest.raises(HTTPException) as exc:
        verify_proxy_signature(request)
    assert exc.value.status_code == 400
    assert exc.value.detail == "proxy_signature_invalid_timestamp"


def test_expired_timestamp():
    past = int(time.time()) - (MAX_SKEW_SECONDS + 10)
    timestamp = str(past)
    payload = f"{timestamp}:POST:/api/line/webhook"
    signature = sign(proxy_settings.proxy_shared_secret or "", payload)
    headers = {
        SIGNATURE_HEADER: signature,
        TIMESTAMP_HEADER: timestamp,
    }
    request = make_request(headers=headers)
    with pytest.raises(HTTPException) as exc:
        verify_proxy_signature(request)
    assert exc.value.status_code == 401
    assert exc.value.detail == "proxy_signature_expired"


def test_invalid_signature():
    timestamp = str(int(time.time()))
    headers = {
        SIGNATURE_HEADER: "invalid",
        TIMESTAMP_HEADER: timestamp,
    }
    request = make_request(headers=headers)
    with pytest.raises(HTTPException) as exc:
        verify_proxy_signature(request)
    assert exc.value.status_code == 401
    assert exc.value.detail == "proxy_signature_invalid"


def test_not_configured(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(proxy_settings, "proxy_shared_secret", None, raising=False)
    request = make_request(headers={SIGNATURE_HEADER: "a", TIMESTAMP_HEADER: "1"})
    with pytest.raises(HTTPException) as exc:
        verify_proxy_signature(request)
    assert exc.value.status_code == 503
    assert exc.value.detail == "proxy_signature_not_configured"
