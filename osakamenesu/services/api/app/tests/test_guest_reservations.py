from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterator

import importlib
import sys
import types

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


def _make_slot(days_from_now: int = 1) -> dict[str, str]:
    start = datetime.now(timezone.utc) + timedelta(days=days_from_now)
    end = start + timedelta(hours=1)
    return {
        "start_at": start.isoformat(),
        "end_at": end.isoformat(),
    }


def _load_reservations_module(monkeypatch: pytest.MonkeyPatch):
    """
    Import guest_reservations with stubbed settings/db so tests stay DB-free.
    Mirrors the approach used in guest_matching tests.
    """
    if "app.domains.site.guest_reservations" in sys.modules:
        return sys.modules["app.domains.site.guest_reservations"]

    fake_settings = types.ModuleType("app.settings")

    class FakeSettings:
        def __init__(self) -> None:
            self.database_url = "sqlite+aiosqlite:///:memory:"
            self.api_origin = "http://localhost"
            self.init_db_on_startup = False

    fake_settings.Settings = FakeSettings
    fake_settings.settings = FakeSettings()
    sys.modules["app.settings"] = fake_settings

    fake_db = types.ModuleType("app.db")

    class DummyAsyncSession:
        pass

    async def _fake_get_session() -> Any:
        yield DummyAsyncSession()

    fake_db.AsyncSession = DummyAsyncSession
    fake_db.get_session = _fake_get_session
    fake_db.SessionLocal = None
    fake_db.engine = None
    sys.modules["app.db"] = fake_db

    return importlib.import_module("app.domains.site.guest_reservations")


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """
    Build a FastAPI app with the guest_reservations router and a dummy DB session override.
    """
    module = _load_reservations_module(monkeypatch)

    app = FastAPI()
    app.include_router(module.router)

    async def _fake_session() -> Any:
        yield None

    app.dependency_overrides[module.get_session] = _fake_session

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_guest_can_create_reservation(client: TestClient) -> None:
    payload = {
        "guest_token": "tok-123",
        "therapist_id": "t-1",
        "date": date.today().isoformat(),
        "slot": _make_slot(),
        "payment_method": "cash",
    }
    resp = client.post("/api/guest/reservations", json=payload)
    assert resp.status_code in (200, 201)
    body = resp.json()
    assert "id" in body
    assert body["status"] in ("pending", "confirmed")
    assert body["slot"]["start_at"]
    assert body["therapist_id"] == "t-1"


def test_guest_cannot_double_book_same_slot(client: TestClient) -> None:
    payload = {
        "guest_token": "tok-dup",
        "therapist_id": "t-dup",
        "date": date.today().isoformat(),
        "slot": _make_slot(),
    }
    first = client.post("/api/guest/reservations", json=payload)
    assert first.status_code in (200, 201)

    second = client.post("/api/guest/reservations", json=payload)
    assert second.status_code in (400, 409)


def test_guest_can_cancel_reservation(client: TestClient) -> None:
    create = client.post(
        "/api/guest/reservations",
        json={
            "guest_token": "tok-cancel",
            "therapist_id": "t-cancel",
            "date": date.today().isoformat(),
            "slot": _make_slot(),
        },
    )
    assert create.status_code in (200, 201)
    res_id = create.json()["id"]

    cancel = client.post(
        f"/api/guest/reservations/{res_id}/cancel",
        json={"reservation_id": res_id, "actor": "guest"},
    )
    assert cancel.status_code == 200
    body = cancel.json()
    assert body["ok"] is True
    assert body["status"] == "cancelled"
