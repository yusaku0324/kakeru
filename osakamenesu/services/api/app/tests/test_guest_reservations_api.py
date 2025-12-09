from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.domains.site import guest_reservations as domain
from app.db import get_session


class DummySession:
    """No-op session for dependency override."""

    def __init__(self, result=None):
        self.result = result

    async def commit(self):
        return None

    async def rollback(self):
        return None

    async def execute(self, stmt):
        class R:
            def __init__(self, value):
                self.value = value

            def scalar_one_or_none(self):
                return self.value

        return R(self.result)

    def add(self, obj):
        return None


def setup_function() -> None:
    app.dependency_overrides[get_session] = lambda: DummySession()


def teardown_function() -> None:
    app.dependency_overrides.pop(get_session, None)


class StubReservation:
    def __init__(self, status: str = "confirmed"):
        now = datetime.now(timezone.utc)
        self.id = uuid4()
        self.status = status
        self.shop_id = uuid4()
        self.therapist_id = uuid4()
        self.start_at = now
        self.end_at = now
        self.duration_minutes = 60
        self.course_id = None
        self.price = None
        self.payment_method = None
        self.contact_info = None
        self.guest_token = None
        self.user_id = None
        self.notes = None
        self.base_staff_id = None
        self.created_at = now
        self.updated_at = now


client = TestClient(app)


def test_create_reservation_success(monkeypatch: pytest.MonkeyPatch):
    async def fake_create(db, payload, now=None):
        return StubReservation(status="confirmed"), {}

    monkeypatch.setattr(domain, "create_guest_reservation", fake_create)

    payload = {
        "shop_id": str(uuid4()),
        "therapist_id": str(uuid4()),
        "start_at": datetime.now(timezone.utc).isoformat(),
        "end_at": datetime.now(timezone.utc).isoformat(),
    }
    res = client.post("/api/guest/reservations", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "confirmed"
    assert UUID(body["id"])


def test_create_reservation_rejected(monkeypatch: pytest.MonkeyPatch):
    async def fake_create(db, payload, now=None):
        return None, {"rejected_reasons": ["deadline_over"]}

    monkeypatch.setattr(domain, "create_guest_reservation", fake_create)

    payload = {
        "shop_id": str(uuid4()),
        "therapist_id": str(uuid4()),
        "start_at": datetime.now(timezone.utc).isoformat(),
        "end_at": datetime.now(timezone.utc).isoformat(),
    }
    res = client.post("/api/guest/reservations", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "rejected"
    assert body["debug"]["rejected_reasons"] == ["deadline_over"]


def test_cancel_reservation(monkeypatch: pytest.MonkeyPatch):
    cancelled = StubReservation(status="cancelled")

    async def fake_cancel(db, reservation_id):
        return cancelled

    monkeypatch.setattr(domain, "cancel_guest_reservation", fake_cancel)

    res = client.post(f"/api/guest/reservations/{uuid4()}/cancel")
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


def test_cancel_reservation_404(monkeypatch: pytest.MonkeyPatch):
    async def fake_cancel(db, reservation_id):
        return None

    monkeypatch.setattr(domain, "cancel_guest_reservation", fake_cancel)

    res = client.post(f"/api/guest/reservations/{uuid4()}/cancel")
    assert res.status_code == 404


def test_get_reservation_detail(monkeypatch: pytest.MonkeyPatch):
    stub = StubReservation(status="confirmed")
    session = DummySession(result=stub)
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/guest/reservations/{uuid4()}")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "confirmed"
