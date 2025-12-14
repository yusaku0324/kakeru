import os

# DATABASE_URL を asyncpg に固定してから app.* を import する
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://app:app@localhost:5432/osaka_menesu"
)

import importlib

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ops_router_module = importlib.import_module("app.domains.ops.router")
from app.db import get_session
from app.domains.ops.router import router as ops_router


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    app = FastAPI()
    app.include_router(ops_router)

    async def _fake_session():
        class DummySession:
            async def commit(self):
                return None

        yield DummySession()

    app.dependency_overrides[get_session] = _fake_session

    async def _fake_expire(db, now=None, ttl_minutes=15, limit=1000):  # noqa: ARG001
        return 0

    monkeypatch.setattr(ops_router_module, "expire_reserved_holds", _fake_expire)
    return TestClient(app)


def test_expire_holds_requires_ops_token_when_configured(
    monkeypatch: pytest.MonkeyPatch, client: TestClient
):
    monkeypatch.setattr(ops_router_module.settings, "ops_api_token", "secret-token")

    res = client.post("/api/ops/reservations/expire_holds")
    assert res.status_code == 401
    assert res.json()["detail"] == "ops_token_required"

    res = client.post(
        "/api/ops/reservations/expire_holds",
        headers={"Authorization": "Bearer wrong"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "ops_token_invalid"

    res = client.post(
        "/api/ops/reservations/expire_holds",
        headers={"Authorization": "Bearer secret-token"},
    )
    assert res.status_code == 200
    assert res.json()["expired"] == 0
