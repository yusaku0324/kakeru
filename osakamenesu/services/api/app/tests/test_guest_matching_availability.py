from __future__ import annotations

import types
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

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
    """
    guest_matching をスタブ環境でロードし、is_available を差し替えて利用する。
    """
    # dynamic import to avoid side-effects
    mod = __import__("app.domains.site.guest_matching", fromlist=["*"])
    return mod


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch, matching_module) -> TestClient:
    app = FastAPI()
    app.include_router(matching_module.router)

    async def _fake_session() -> Any:
        yield None

    # override DB session dep
    app.dependency_overrides[matching_module.get_session] = _fake_session

    async def _fake_search(
        self: Any, *args: Any, **kwargs: Any
    ) -> dict[str, list[Any]]:
        # return two candidates
        return {"results": [_mk_candidate("A"), _mk_candidate("B")]}

    monkeypatch.setattr(matching_module.ShopSearchService, "search", _fake_search)
    return TestClient(app)


def test_availability_annotation(
    monkeypatch: pytest.MonkeyPatch, matching_module, client: TestClient
):
    async def fake_available(db, therapist_id, start_at, end_at, lock=False):
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
    data = res.json()
    assert data["items"][0]["availability"]["is_available"] is True
    assert data["items"][0]["availability"]["rejected_reasons"] == []


def test_availability_rejected(
    monkeypatch: pytest.MonkeyPatch, matching_module, client: TestClient
):
    async def fake_reject(db, therapist_id, start_at, end_at, lock=False):
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
    data = res.json()
    assert data["items"][0]["availability"]["is_available"] is False
    assert data["items"][0]["availability"]["rejected_reasons"] == ["no_shift"]


def test_availability_null_when_no_time(
    monkeypatch: pytest.MonkeyPatch, matching_module, client: TestClient
):
    async def fake_available(db, therapist_id, start_at, end_at, lock=False):
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(matching_module, "is_available", fake_available)

    # time_from/time_to なし → availability は null
    res = client.get(
        "/api/guest/matching/search", params={"area": "x", "date": "2025-01-01"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["items"][0]["availability"]["is_available"] is None
    assert data["items"][0]["availability"]["rejected_reasons"] == []


def test_phase_explore_skips_availability(
    monkeypatch: pytest.MonkeyPatch, matching_module, client: TestClient
):
    called = False

    async def fake_available(db, therapist_id, start_at, end_at, lock=False):
        nonlocal called
        called = True
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(matching_module, "is_available", fake_available)

    res = client.get(
        "/api/guest/matching/search",
        params={
            "area": "x",
            "date": "2025-01-01",
            "time_from": "10:00",
            "time_to": "11:00",
            "phase": "explore",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert called is False
    for item in data["items"]:
        assert item["availability"]["is_available"] is None
        assert item["breakdown"]["availability_boost"] == 0.0
        assert item["is_available"] is None


def test_phase_narrow_keeps_unavailable(
    monkeypatch: pytest.MonkeyPatch, matching_module, client: TestClient
):
    async def fake_available(db, therapist_id, start_at, end_at, lock=False):
        ok = therapist_id == "A"
        reasons = [] if ok else ["no_shift"]
        return ok, {"rejected_reasons": reasons}

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
    data = res.json()
    assert len(data["items"]) == 2
    a, b = data["items"]
    assert a["id"] == "A"
    assert a["is_available"] is True
    assert a["breakdown"]["availability_boost"] > 0
    assert b["id"] == "B"
    assert b["is_available"] is False
    assert b["breakdown"]["availability_boost"] == 0


def test_phase_book_filters_unavailable(
    monkeypatch: pytest.MonkeyPatch, matching_module, client: TestClient
):
    async def fake_available(db, therapist_id, start_at, end_at, lock=False):
        ok = therapist_id == "A"
        reasons = [] if ok else ["no_shift"]
        return ok, {"rejected_reasons": reasons}

    monkeypatch.setattr(matching_module, "is_available", fake_available)

    res = client.get(
        "/api/guest/matching/search",
        params={
            "area": "x",
            "date": "2025-01-01",
            "time_from": "10:00",
            "time_to": "11:00",
            "phase": "book",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert [item["id"] for item in data["items"]] == ["A"]
    assert data["items"][0]["is_available"] is True
    assert data["items"][0]["breakdown"]["availability_boost"] > 0


def test_phase_default_book_when_time(
    monkeypatch: pytest.MonkeyPatch, matching_module, client: TestClient
):
    async def fake_available(db, therapist_id, start_at, end_at, lock=False):
        ok = therapist_id == "A"
        reasons = [] if ok else ["no_shift"]
        return ok, {"rejected_reasons": reasons}

    monkeypatch.setattr(matching_module, "is_available", fake_available)

    res = client.get(
        "/api/guest/matching/search",
        params={
            "area": "x",
            "date": "2025-01-01",
            "time_from": "10:00",
            "time_to": "11:00",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert [item["id"] for item in data["items"]] == ["A"]


def test_phase_default_explore_when_no_time(
    monkeypatch: pytest.MonkeyPatch, matching_module, client: TestClient
):
    called = False

    async def fake_available(db, therapist_id, start_at, end_at, lock=False):
        nonlocal called
        called = True
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(matching_module, "is_available", fake_available)

    res = client.get(
        "/api/guest/matching/search",
        params={
            "area": "x",
            "date": "2025-01-01",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert called is False
    assert len(data["items"]) == 2
    for item in data["items"]:
        assert item["availability"]["is_available"] is None
        assert item["breakdown"]["availability_boost"] == 0.0
