import os
import sys
import uuid
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

_HELPER_DIR = Path(__file__).resolve().parent
if str(_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_HELPER_DIR))

from _path_setup import configure_paths

ROOT = configure_paths(Path(__file__))

for key in [
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

os.environ.setdefault("ADMIN_API_KEY", "test-admin-key")

from app import models  # type: ignore  # noqa: E402
from app.db import get_session  # type: ignore  # noqa: E402
from app.deps import audit_admin, require_admin  # type: ignore  # noqa: E402
from app.domains.admin.router import router as admin_router  # type: ignore  # noqa: E402
from app.domains.admin.services import profile_service, site_bridge  # type: ignore  # noqa: E402


class FakeSession:
    def __init__(self, profile: models.Profile) -> None:
        self._profile = profile
        self.added: list[Any] = []
        self.commit_calls = 0

    async def get(self, model: Any, ident: Any) -> Any:
        if model is models.Profile and ident == self._profile.id:
            return self._profile
        return None

    async def commit(self) -> None:
        self.commit_calls += 1

    async def refresh(self, _instance: Any, _names: Any = None) -> None:
        return None

    async def add(self, instance: Any) -> None:
        self.added.append(instance)

    async def rollback(self) -> None:
        return None

    async def execute(self, _statement: Any) -> Any:
        class _Result:
            @staticmethod
            def scalar_one_or_none() -> None:
                return None

        return _Result()


def _build_app(fake_session: FakeSession, monkeypatch) -> FastAPI:
    app = FastAPI()
    app.include_router(admin_router)

    async def override_session():
        yield fake_session

    async def noop_audit():
        return None

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[require_admin] = lambda: None
    app.dependency_overrides[audit_admin] = noop_audit

    monkeypatch.setattr(profile_service, "_reindex_profile_contact", AsyncMock(return_value=None))
    monkeypatch.setattr(profile_service, "record_change", AsyncMock(return_value=None))
    monkeypatch.setattr(site_bridge, "fetch_availability", AsyncMock(return_value=None))

    return app


def _make_profile() -> models.Profile:
    profile_id = uuid.uuid4()
    return models.Profile(
        id=profile_id,
        slug="relax-salon",
        name="癒しサロン",
        area="難波",
        price_min=12000,
        price_max=18000,
        bust_tag="C",
        service_type="store",
        body_tags=["recovery"],
        photos=["/images/sample.jpg"],
        contact_json={},
    )


def test_admin_update_shop_content_normalizes_contact_and_menu(monkeypatch):
    profile = _make_profile()
    fake_session = FakeSession(profile)
    app = _build_app(fake_session, monkeypatch)

    payload = {
        "contact": {
            "phone": "080-9999-1111",
            "line_id": "line-123",
            "website_url": "https://example.com",
            "reservation_form_url": "https://reserve.example.com",
            "sns": [{"kind": "instagram", "url": "https://instagram.com/sample"}],
        },
        "menus": [
            {
                "name": "  Premium Aroma  ",
                "price": 15000,
                "duration_minutes": 60,
                "description": "人気メニュー",
                "tags": ["アロマ"],
                "is_reservable_online": True,
            },
            {
                "name": "   ",
                "price": 10000,
                "duration_minutes": 45,
                "description": None,
                "tags": [],
                "is_reservable_online": True,
            },
        ],
        "staff": [
            {
                "name": "  Kana  ",
                "alias": "kana",
                "headline": "トップセラピスト",
                "specialties": ["リンパ"],
            }
        ],
        "service_tags": ["relax"],
        "photos": ["/images/new-photo.jpg"],
    }

    with TestClient(app) as client:
        response = client.patch(f"/api/admin/shops/{profile.id}/content", json=payload)

    assert response.status_code == 200, response.json()

    data = response.json()
    assert data["contact"]["phone"] == "080-9999-1111"
    assert data["contact"]["website_url"] == "https://example.com"
    assert data["menus"][0]["name"] == "Premium Aroma"
    assert len(data["menus"]) == 1
    assert data["staff"][0]["name"] == "Kana"
    assert profile.body_tags == ["relax"]
    assert profile.contact_json["tel"] == "080-9999-1111"
    assert profile.contact_json["line"] == "line-123"
    assert profile.photos == ["/images/new-photo.jpg"]
