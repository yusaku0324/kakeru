from __future__ import annotations

from datetime import datetime, timezone, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.db import get_session
from app.deps import require_admin, audit_admin


class Row:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class DummyResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class DummySession:
    def __init__(self, rows):
        self.rows = rows

    async def execute(self, stmt):  # pragma: no cover - behavior validated via response
        return DummyResult(self.rows)


def setup_function():
    now = datetime.now(timezone.utc)
    shop_id = uuid4()
    therapist_id = uuid4()
    rows = [
        Row(
            id=uuid4(),
            shop_id=shop_id,
            therapist_id=therapist_id,
            start_at=now + timedelta(hours=1),
            end_at=now + timedelta(hours=2),
            status="confirmed",
            notes=None,
            contact_info=None,
            created_at=now,
            updated_at=now,
            therapist_name="Aさん",
            shop_name="ショップ",
        ),
        Row(
            id=uuid4(),
            shop_id=shop_id,
            therapist_id=therapist_id,
            start_at=now + timedelta(days=1),
            end_at=now + timedelta(days=1, hours=1),
            status="pending",
            notes="よろしく",
            contact_info={"line": "abc"},
            created_at=now,
            updated_at=now,
            therapist_name="Bさん",
            shop_name="ショップ",
        ),
    ]
    app.dependency_overrides[get_session] = lambda: DummySession(rows)
    app.dependency_overrides[require_admin] = lambda: None
    app.dependency_overrides[audit_admin] = lambda: None


def teardown_function():
    app.dependency_overrides.clear()


client = TestClient(app)


def test_admin_guest_reservations_list():
    shop_id = uuid4()
    resp = client.get(f"/api/admin/guest_reservations?shop_id={shop_id}", headers={"x-admin-key": "dev"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    assert data["items"][0]["therapist_name"] in {"Aさん", "Bさん"}
