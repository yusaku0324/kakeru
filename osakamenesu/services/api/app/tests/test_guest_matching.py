from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.domains.site.guest_matching import router as matching_router


@pytest.fixture(scope="module")
def client() -> TestClient:
    app = FastAPI()
    app.include_router(matching_router)
    return TestClient(app)


def test_matching_search_ok(client: TestClient) -> None:
    payload = {"area": "osaka", "date": "2025-11-04", "budget_level": "mid"}
    resp = client.post("/api/guest/matching/search", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert "top_matches" in body
    assert isinstance(body["top_matches"], list)
    # v1はショップ検索結果に対する簡易スコアリングを行い、上位候補を返す
    assert all("therapist_id" in c for c in body["top_matches"])


def test_matching_search_requires_area_date(client: TestClient) -> None:
    resp = client.post(
        "/api/guest/matching/search", json={"area": "", "date": "2025-11-04"}
    )
    assert resp.status_code == 422

def test_matching_logs_best_effort(monkeypatch):
    called = {"logged": False}

    async def fake_log(db, payload, top, rest, guest_token=None):
        called["logged"] = True

    monkeypatch.setattr("app.domains.site.guest_matching._log_matching", fake_log)

    app = FastAPI()
    app.include_router(matching_router)
    client = TestClient(app)

    resp = client.post(
        "/api/guest/matching/search", json={"area": "osaka", "date": "2025-11-04"}
    )
    assert resp.status_code == 200
    assert called["logged"] is True


def test_matching_logs_failure_does_not_break(monkeypatch):
    async def fake_log_fail(db, payload, top, rest, guest_token=None):
        raise RuntimeError("log failed")

    monkeypatch.setattr("app.domains.site.guest_matching._log_matching", fake_log_fail)

    app = FastAPI()
    app.include_router(matching_router)
    client = TestClient(app)

    resp = client.post(
        "/api/guest/matching/search", json={"area": "osaka", "date": "2025-11-04"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "top_matches" in body
