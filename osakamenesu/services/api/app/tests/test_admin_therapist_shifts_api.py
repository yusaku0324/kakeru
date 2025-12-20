from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.domains.admin import therapist_shifts_api as api
from app.db import get_session
from app.deps import require_admin, audit_admin


def _dt(hour: int, minute: int = 0) -> datetime:
    return datetime(2025, 1, 1, hour, minute, tzinfo=timezone.utc)


class DummyShift:
    def __init__(
        self, therapist_id, shop_id, start_at, end_at, availability_status="available"
    ):
        self.id = uuid4()
        self.therapist_id = therapist_id
        self.shop_id = shop_id
        self.date = start_at.date()
        self.start_at = start_at
        self.end_at = end_at
        self.break_slots = []
        self.availability_status = availability_status
        self.notes = None
        self.created_at = start_at
        self.updated_at = end_at


class DummySession:
    def __init__(self, shift=None):
        self.shift = shift
        self.deleted = False
        self.added = None
        self.committed = False

    async def execute(self, stmt):
        # _get_shift uses execute first; _has_overlap uses execute as well
        class R:
            def __init__(self, value):
                self.value = value

            def scalar_one_or_none(self):
                return self.value

            def scalars(self):
                class S:
                    def __init__(self_inner, v):
                        self_inner.v = v

                    def all(self_inner):
                        return self_inner.v

                return S([self.value] if self.value else [])

        return R(self.shift)

    def add(self, obj):
        self.added = obj

    async def refresh(self, obj):
        return None

    async def commit(self):
        self.committed = True
        return None

    async def delete(self, obj):
        self.deleted = True


client = TestClient(app)


def setup_function():
    app.dependency_overrides[get_session] = lambda: DummySession()
    app.dependency_overrides[require_admin] = lambda: None
    app.dependency_overrides[audit_admin] = lambda: None


def teardown_function():
    app.dependency_overrides.pop(get_session, None)
    app.dependency_overrides.pop(require_admin, None)
    app.dependency_overrides.pop(audit_admin, None)


def test_create_shift_success(monkeypatch: pytest.MonkeyPatch):
    session = DummySession()
    app.dependency_overrides[get_session] = lambda: session

    async def fake_overlap(db, therapist_id, start_at, end_at, exclude_id=None):
        return False

    monkeypatch.setattr(api, "_has_overlap", fake_overlap)

    payload = {
        "therapist_id": str(uuid4()),
        "shop_id": str(uuid4()),
        "date": "2025-01-01",
        "start_at": _dt(10).isoformat(),
        "end_at": _dt(12).isoformat(),
    }
    res = client.post("/api/admin/therapist_shifts", json=payload)
    assert res.status_code == 201
    body = res.json()
    assert body["therapist_id"] == payload["therapist_id"]
    assert session.committed is True


def test_create_shift_invalid_range():
    payload = {
        "therapist_id": str(uuid4()),
        "shop_id": str(uuid4()),
        "date": "2025-01-01",
        "start_at": _dt(12).isoformat(),
        "end_at": _dt(12).isoformat(),
    }
    res = client.post("/api/admin/therapist_shifts", json=payload)
    assert res.status_code in (400, 422)


def test_create_shift_overlap(monkeypatch: pytest.MonkeyPatch):
    async def fake_overlap(db, therapist_id, start_at, end_at, exclude_id=None):
        return True

    monkeypatch.setattr(api, "_has_overlap", fake_overlap)
    payload = {
        "therapist_id": str(uuid4()),
        "shop_id": str(uuid4()),
        "date": "2025-01-01",
        "start_at": _dt(10).isoformat(),
        "end_at": _dt(12).isoformat(),
    }
    res = client.post("/api/admin/therapist_shifts", json=payload)
    assert res.status_code == 409


def test_update_shift(monkeypatch: pytest.MonkeyPatch):
    existing = DummyShift(uuid4(), uuid4(), _dt(10), _dt(12))
    session = DummySession(shift=existing)
    app.dependency_overrides[get_session] = lambda: session

    async def fake_overlap(db, therapist_id, start_at, end_at, exclude_id=None):
        return False

    async def fake_get(db, shift_id):
        return existing

    async def fake_has_reservations_outside(
        db, therapist_id, new_start, new_end, old_start, old_end
    ):
        return False  # No reservations outside new range

    monkeypatch.setattr(api, "_has_overlap", fake_overlap)
    monkeypatch.setattr(api, "_get_shift", fake_get)
    monkeypatch.setattr(
        api, "_has_reservations_outside_range", fake_has_reservations_outside
    )

    payload = {
        "therapist_id": str(existing.therapist_id),
        "shop_id": str(existing.shop_id),
        "date": "2025-01-01",
        "start_at": _dt(11).isoformat(),
        "end_at": _dt(13).isoformat(),
    }
    res = client.put(f"/api/admin/therapist_shifts/{existing.id}", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body["start_at"].startswith("2025-01-01T11:00")


def test_delete_shift(monkeypatch: pytest.MonkeyPatch):
    existing = DummyShift(uuid4(), uuid4(), _dt(10), _dt(12))
    session = DummySession(shift=existing)
    app.dependency_overrides[get_session] = lambda: session

    async def fake_get(db, shift_id):
        return existing

    async def fake_has_reservations(db, therapist_id, start_at, end_at, *, lock=False):
        return False  # No reservations

    monkeypatch.setattr(api, "_get_shift", fake_get)
    monkeypatch.setattr(api, "_has_reservations_in_shift", fake_has_reservations)

    res = client.delete(f"/api/admin/therapist_shifts/{existing.id}")
    assert res.status_code in (200, 204)
    assert session.deleted or session.committed
