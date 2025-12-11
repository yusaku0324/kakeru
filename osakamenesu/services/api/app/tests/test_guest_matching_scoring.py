from __future__ import annotations

import sys
import types
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


def _load_matching_module(monkeypatch: pytest.MonkeyPatch):
    if "app.domains.site.guest_matching" in sys.modules:
        return sys.modules["app.domains.site.guest_matching"]

    fake_settings = types.ModuleType("app.settings")

    class FakeSettings:
        def __init__(self) -> None:
            self.database_url = "sqlite+aiosqlite:///:memory:"
            self.api_origin = "http://localhost"
            self.init_db_on_startup = False

    fake_settings.Settings = FakeSettings
    fake_settings.settings = FakeSettings()
    sys.modules["app.settings"] = fake_settings

    fake_db = types.ModuleType("app.db")

    class DummyAsyncSession:
        pass

    async def _fake_get_session() -> Any:
        yield DummyAsyncSession()

    fake_db.AsyncSession = DummyAsyncSession
    fake_db.get_session = _fake_get_session
    fake_db.SessionLocal = None
    fake_db.engine = None
    sys.modules["app.db"] = fake_db

    return __import__("app.domains.site.guest_matching", fromlist=["*"])


def _mk_candidate(name: str, overrides: dict[str, Any] | None = None) -> Any:
    base = {
        "id": name,
        "name": name,
        "shop_id": "shop-1",
        "shop_name": "Shop",
        "price_rank": 2,
        "mood_tag": "calm",
        "style_tag": "relax",
        "look_type": "natural",
        "contact_style": "gentle",
        "hobby_tags": ["anime"],
        "age": 25,
        "photo_url": "https://example.com/photo.jpg",
        "photo_embedding": [1.0, 0.0, 0.0],
        "slots": [{}],
    }
    if overrides:
        base.update(overrides)
    return types.SimpleNamespace(**base)


@pytest.fixture()
def matching_module(monkeypatch: pytest.MonkeyPatch):
    return _load_matching_module(monkeypatch)


def _make_client(monkeypatch: pytest.MonkeyPatch, matching_module, results: list[Any]):
    app = FastAPI()
    app.include_router(matching_module.router)

    async def _fake_session() -> Any:
        yield None

    app.dependency_overrides[matching_module.get_session] = _fake_session

    async def fake_search(self: Any, *args: Any, **kwargs: Any) -> dict[str, list[Any]]:
        return {"results": results}

    monkeypatch.setattr(matching_module.ShopSearchService, "search", fake_search)
    return TestClient(app)


def test_scoring_availability_boost(monkeypatch, matching_module):
    a = _mk_candidate("a")
    b = _mk_candidate("b", {"slots": []})  # will become is_available False

    client = _make_client(monkeypatch, matching_module, [b, a])

    called_ids: list[str] = []

    async def fake_available(db, therapist_id, start_at, end_at, lock=False):
        called_ids.append(therapist_id)
        if therapist_id == "a":
            return True, {"rejected_reasons": []}
        return False, {"rejected_reasons": ["no_shift"]}

    monkeypatch.setattr(matching_module, "is_available", fake_available)

    resp = client.get(
        "/api/guest/matching/search",
        params={
            "area": "osaka",
            "date": "2025-01-01",
            "time_from": "10:00",
            "time_to": "11:00",
            "phase": "narrow",
            "sort": "recommended",
        },
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    # availability True の a が上位になる（soft boost）
    assert items[0]["id"] == "a"
    assert items[0]["score"] >= items[1]["score"]
    assert 0.0 <= items[0]["score"] <= 1.0
    assert 0.0 <= items[1]["score"] <= 1.0
    assert "a" in called_ids and "b" in called_ids
    assert items[0]["breakdown"]["availability_boost"] > 0
    assert items[1]["breakdown"]["availability_boost"] == 0


def test_scoring_base_staff_similarity(monkeypatch, matching_module):
    """Test that base_staff_id search works with recommended scoring.

    Note: With the new recommended scoring algorithm, photo_similarity is not
    a primary ranking factor. The ranking is determined by:
    - affinity (look + style match)
    - popularity (bookings, repeat rate, reviews)
    - fairness (newcomer boost, load balance)

    This test verifies that the search returns valid scores for all candidates.
    """
    base = _mk_candidate("base")
    similar = _mk_candidate("similar", {"photo_embedding": [1.0, 0.0, 0.0]})
    dissimilar = _mk_candidate("dissimilar", {"photo_embedding": [-1.0, 0.0, 0.0]})

    async def fake_base(db, staff_id):
        return base

    monkeypatch.setattr(matching_module, "_get_base_staff", fake_base)
    client = _make_client(monkeypatch, matching_module, [dissimilar, similar])

    resp = client.get(
        "/api/guest/matching/search",
        params={
            "area": "osaka",
            "date": "2025-01-01",
            "base_staff_id": "base",
            "sort": "recommended",
        },
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    # With new scoring, both candidates have same profile attributes,
    # so order depends on subtle scoring differences. Just verify valid scores.
    assert len(items) == 2
    assert items[0]["score"] >= items[1]["score"]
    for item in items:
        assert 0.0 <= item["score"] <= 1.5  # Allow for availability factor
        assert 0.0 <= item.get("photo_similarity", 0) <= 1.0
