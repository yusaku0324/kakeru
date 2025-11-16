import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.domains.line import router as line_router
from app.domains.line.router import require_proxy_signature


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(line_router)

    def _noop():
        return None

    app.dependency_overrides[require_proxy_signature] = _noop
    return TestClient(app)


def test_line_ping_returns_ok(client):
    response = client.get("/api/line/ping")
    assert response.status_code == 200
    assert response.json() == {"ok": "line-proxy"}


def test_line_webhook_consumes_body(client):
    response = client.post("/api/line/webhook", json={"event": "sample"})
    assert response.status_code == 204
