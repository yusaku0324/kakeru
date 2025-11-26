from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.domains.admin import therapists_api as api
from app.db import get_session
from app.deps import require_admin, audit_admin
from app.models import Therapist


class DummySession:
    def __init__(self, therapists=None):
        self.therapists = therapists or []
        self.added = None
        self.committed = False

    async def execute(self, stmt):
        class R:
            def __init__(self, items):
                self.items = items

            def scalars(self):
                class S:
                    def __init__(self, items):
                        self._items = items

                    def all(self):
                        return self._items

                return S(self.items)

        return R(self.therapists)

    def add(self, obj):
        self.added = obj

    async def refresh(self, obj):
        return None

    async def commit(self):
        self.committed = True
        return None


client = TestClient(app)


def setup_function():
    app.dependency_overrides[get_session] = lambda: DummySession()
    app.dependency_overrides[require_admin] = lambda: None
    app.dependency_overrides[audit_admin] = lambda: None


def teardown_function():
    app.dependency_overrides.pop(get_session, None)
    app.dependency_overrides.pop(require_admin, None)
    app.dependency_overrides.pop(audit_admin, None)


def test_list_therapists():
    dummy = Therapist(
        id=uuid4(),
        profile_id=uuid4(),
        name="てすとセラ",
        status="draft",
        display_order=0,
        is_booking_enabled=True,
    )
    session = DummySession(therapists=[dummy])
    app.dependency_overrides[get_session] = lambda: session

    res = client.get("/api/admin/therapists")
    assert res.status_code == 200
    body = res.json()
    assert body["items"][0]["name"] == "てすとセラ"


def test_create_therapist():
    profile_id = uuid4()
    session = DummySession()
    app.dependency_overrides[get_session] = lambda: session

    payload = {"shop_id": str(profile_id), "name": "新規セラ", "tags": ["healing"], "photo_url": "https://x"}
    res = client.post("/api/admin/therapists", json=payload)
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == payload["name"]
    assert body["profile_id"] == str(profile_id)
    assert session.committed is True
