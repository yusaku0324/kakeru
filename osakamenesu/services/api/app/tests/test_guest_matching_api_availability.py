from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


def _mk_candidate(name: str, overrides: dict[str, Any] | None = None) -> Any:
    base = {
        "id": name,
        "therapist_id": name,
        "therapist_name": name,
        "shop_id": f"shop-{name}",
        "shop_name": f"Shop {name}",
        "slots": [],
        "mood_tag": None,
        "style_tag": None,
        "look_type": None,
        "talk_level": None,
        "contact_style": None,
        "hobby_tags": [],
        "price_rank": None,
        "age": None,
        "photo_url": None,
        "photo_similarity": 0.5,
    }
    if overrides:
        base.update(overrides)
    return base


@pytest.fixture()
def matching_module(monkeypatch: pytest.MonkeyPatch):
    mod = __import__("app.domains.site.guest_matching", fromlist=["*"])
    return mod


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch, matching_module) -> TestClient:
    app = FastAPI()
    app.include_router(matching_module.router)

    async def _fake_session() -> Any:
        yield None

    app.dependency_overrides[matching_module.get_session] = _fake_session

    async def _fake_search(
        self: Any, *args: Any, **kwargs: Any
    ) -> dict[str, list[Any]]:
        return {"results": [_mk_candidate("A"), _mk_candidate("B")]}

    monkeypatch.setattr(matching_module.ShopSearchService, "search", _fake_search)
    return TestClient(app)


def test_search_availability_true(
    monkeypatch: pytest.MonkeyPatch, matching_module, client: TestClient
):
    async def fake_available(db, therapist_id, start_at, end_at):
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(matching_module, "is_available", fake_available)
    res = client.get(
        "/api/guest/matching/search",
        params={
            "area": "x",
            "date": "2025-01-01",
            "time_from": "10:00",
            "time_to": "11:00",
            "phase": "narrow",
        },
    )
    assert res.status_code == 200
    body = res.json()
    item = body["items"][0]
    assert item["availability"]["is_available"] is True
    assert item["is_available"] is True


def test_search_availability_false(
    monkeypatch: pytest.MonkeyPatch, matching_module, client: TestClient
):
    async def fake_reject(db, therapist_id, start_at, end_at):
        return False, {"rejected_reasons": ["no_shift"]}

    monkeypatch.setattr(matching_module, "is_available", fake_reject)
    res = client.get(
        "/api/guest/matching/search",
        params={
            "area": "x",
            "date": "2025-01-01",
            "time_from": "10:00",
            "time_to": "11:00",
            "phase": "narrow",
        },
    )
    assert res.status_code == 200
    body = res.json()
    item = body["items"][0]
    assert item["availability"]["is_available"] is False
    assert item["availability"]["rejected_reasons"] == ["no_shift"]
    assert item["is_available"] is False


def test_search_availability_null(
    monkeypatch: pytest.MonkeyPatch, matching_module, client: TestClient
):
    async def fake_available(db, therapist_id, start_at, end_at):
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(matching_module, "is_available", fake_available)
    res = client.get(
        "/api/guest/matching/search", params={"area": "x", "date": "2025-01-01"}
    )
    assert res.status_code == 200
    body = res.json()
    item = body["items"][0]
    assert item["availability"]["is_available"] is None
    assert item["is_available"] is None


def test_search_with_start_time_and_duration(
    monkeypatch: pytest.MonkeyPatch, matching_module, client: TestClient
):
    captured: dict[str, Any] = {}

    async def fake_available(db, therapist_id, start_at, end_at):
        captured["start_at"] = start_at
        captured["end_at"] = end_at
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(matching_module, "is_available", fake_available)
    res = client.get(
        "/api/guest/matching/search",
        params={
            "area": "x",
            "date": "2025-01-01",
            "start_time": "10:00",
            "duration_minutes": 60,
        },
    )
    assert res.status_code == 200
    body = res.json()
    item = body["items"][0]
    assert item["is_available"] is True
    assert captured["start_at"].hour == 10
    assert captured["end_at"].hour == 11
