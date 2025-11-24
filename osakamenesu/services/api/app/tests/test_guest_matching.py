from __future__ import annotations

from pathlib import Path

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


def test_matching_search_requires_area_date(client: TestClient) -> None:
    resp = client.post(
        "/api/guest/matching/search", json={"area": "", "date": "2025-11-04"}
    )
    assert resp.status_code == 422
