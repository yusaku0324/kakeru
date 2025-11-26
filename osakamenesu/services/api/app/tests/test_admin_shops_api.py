from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.domains.admin import shops_api as api
from app.db import get_session
from app.deps import require_admin, audit_admin
from app.models import Profile


class DummySession:
    def __init__(self, profiles=None):
        self.profiles = profiles or []
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

        return R(self.profiles)

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


def test_list_shops():
    dummy = Profile(
        id=uuid4(),
        name="テスト店",
        area="osaka",
        price_min=0,
        price_max=0,
        bust_tag="bust",
        service_type="store",
        status="draft",
    )
    session = DummySession(profiles=[dummy])
    app.dependency_overrides[get_session] = lambda: session

    res = client.get("/api/admin/shops")
    assert res.status_code == 200
    body = res.json()
    assert body["items"][0]["name"] == "テスト店"


def test_create_shop():
    session = DummySession()
    app.dependency_overrides[get_session] = lambda: session

    payload = {"name": "新店舗", "area": "umeda", "url": "https://example.com"}
    res = client.post("/api/admin/shops", json=payload)
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == payload["name"]
    assert session.committed is True
