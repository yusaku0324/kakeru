from __future__ import annotations

import sys
import types
from datetime import date
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


def _load_matching_module(monkeypatch: pytest.MonkeyPatch):
    """
    Import guest_matching with stubbed settings/db so tests stay DB-free and
    don't parse the real .env during collection.
    """
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


@pytest.fixture()
def matching_module(monkeypatch: pytest.MonkeyPatch):
    return _load_matching_module(monkeypatch)


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
        return {"results": []}

    monkeypatch.setattr(matching_module.ShopSearchService, "search", _fake_search)

    return TestClient(app)


# ---- v2 search tests ----


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


def test_search_v2_recommended_sorts_by_score(monkeypatch, matching_module):
    base = _mk_candidate("base")
    best = _mk_candidate("best")
    mid = _mk_candidate("mid", {"mood_tag": "off"})
    low = _mk_candidate(
        "low", {"mood_tag": "off", "style_tag": "off", "hobby_tags": []}
    )

    async def fake_search(self: Any, *args: Any, **kwargs: Any) -> dict[str, list[Any]]:
        return {"results": [best, mid, low]}

    monkeypatch.setattr(matching_module.ShopSearchService, "search", fake_search)

    async def fake_base(db, staff_id):
        return base

    monkeypatch.setattr(matching_module, "_get_base_staff", fake_base)

    app = FastAPI()
    app.include_router(matching_module.router)
    client = TestClient(app)

    resp = client.get(
        "/api/guest/matching/search",
        params={
            "area": "osaka",
            "date": "2025-01-01",
            "mood_tags": ["calm"],
            "style_tags": ["relax"],
            "limit": 10,
            "sort": "recommended",
            "base_staff_id": "base",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body and "total" in body
    items = body["items"]
    assert len(items) == 3
    # score descending
    assert items[0]["id"] == "best"
    assert items[0]["score"] >= items[1]["score"] >= items[2]["score"]
    for item in items:
        assert 0.0 <= item["score"] <= 1.0
        assert 0.0 <= item.get("photo_similarity", 0) <= 1.0


def test_search_v2_tag_price_age_influence(monkeypatch, matching_module):
    # perfect matches preferences
    base = _mk_candidate("perfect")
    off = _mk_candidate("off", {"price_rank": 5, "age": 50, "mood_tag": "other"})

    async def fake_search(self: Any, *args: Any, **kwargs: Any) -> dict[str, list[Any]]:
        return {"results": [off, base]}

    monkeypatch.setattr(matching_module.ShopSearchService, "search", fake_search)

    app = FastAPI()
    app.include_router(matching_module.router)
    client = TestClient(app)

    resp = client.get(
        "/api/guest/matching/search",
        params={
            "area": "osaka",
            "date": "2025-01-01",
            "mood_tags": ["calm"],
            "style_tags": ["relax"],
            "price_rank_min": 2,
            "price_rank_max": 2,
            "age_min": 20,
            "age_max": 30,
            "sort": "recommended",
        },
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert items[0]["id"] == "perfect"
    assert items[0]["score"] > items[1]["score"]


def test_search_v2_non_recommended_keeps_order(monkeypatch, matching_module):
    # order should stay as returned when sort != recommended
    first = _mk_candidate("first")
    second = _mk_candidate("second")

    async def fake_search(self: Any, *args: Any, **kwargs: Any) -> dict[str, list[Any]]:
        return {"results": [first, second]}

    monkeypatch.setattr(matching_module.ShopSearchService, "search", fake_search)

    app = FastAPI()
    app.include_router(matching_module.router)
    client = TestClient(app)

    resp = client.get(
        "/api/guest/matching/search",
        params={
            "area": "osaka",
            "date": "2025-01-01",
            "sort": "new",
        },
    )
    assert resp.status_code == 200
    ids = [item["id"] for item in resp.json()["items"]]
    assert ids == ["first", "second"]


def test_search_v2_handles_missing_fields(monkeypatch, matching_module):
    missing = _mk_candidate(
        "missing", {"price_rank": None, "age": None, "mood_tag": None}
    )

    async def fake_search(self: Any, *args: Any, **kwargs: Any) -> dict[str, list[Any]]:
        return {"results": [missing]}

    monkeypatch.setattr(matching_module.ShopSearchService, "search", fake_search)

    app = FastAPI()
    app.include_router(matching_module.router)
    client = TestClient(app)

    resp = client.get(
        "/api/guest/matching/search",
        params={"area": "osaka", "date": "2025-01-01", "sort": "recommended"},
    )
    assert resp.status_code == 200
    item = resp.json()["items"][0]
    assert 0.0 <= item["score"] <= 1.0
    assert 0.0 <= item.get("photo_similarity", 0) <= 1.0


def test_search_v2_uses_embeddings_when_available(monkeypatch, matching_module):
    base = _mk_candidate("base", {"photo_embedding": [1.0, 0.0, 0.0]})
    close = _mk_candidate("close", {"photo_embedding": [0.9, 0.1, 0.0]})
    far = _mk_candidate("far", {"photo_embedding": [0.0, 1.0, 0.0]})

    async def fake_search(self: Any, *args: Any, **kwargs: Any) -> dict[str, list[Any]]:
        return {"results": [far, close]}

    async def fake_base(db, staff_id):
        return base

    monkeypatch.setattr(matching_module.ShopSearchService, "search", fake_search)
    monkeypatch.setattr(matching_module, "_get_base_staff", fake_base)

    app = FastAPI()
    app.include_router(matching_module.router)
    client = TestClient(app)

    resp = client.get(
        "/api/guest/matching/search",
        params={"area": "osaka", "date": "2025-01-01", "sort": "recommended", "base_staff_id": "base"},
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert items[0]["id"] == "close"
    assert 0.0 <= items[0]["photo_similarity"] <= 1.0


def test_search_returns_empty_when_area_or_date_missing(matching_module):
    app = FastAPI()
    app.include_router(matching_module.router)
    client = TestClient(app)

    resp = client.get("/api/guest/matching/search", params={"area": "osaka"})
    assert resp.status_code == 200
    assert resp.json() == {"items": [], "total": 0}

    resp = client.get("/api/guest/matching/search", params={"date": "2025-01-01"})
    assert resp.status_code == 200
    assert resp.json() == {"items": [], "total": 0}


def test_search_handles_search_service_failure(monkeypatch, matching_module):
    """ShopSearchService.search が落ちても 500 にせず空レスポンスで返す。"""

    async def _raise(self: Any, *args: Any, **kwargs: Any) -> dict[str, list[Any]]:
        raise RuntimeError("search failed")

    monkeypatch.setattr(matching_module.ShopSearchService, "search", _raise)

    app = FastAPI()
    app.include_router(matching_module.router)
    client = TestClient(app)

    resp = client.get(
        "/api/guest/matching/search",
        params={
            "area": "osaka",
            "date": "2025-01-01",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_search_v2_base_staff_not_found_returns_404(monkeypatch, matching_module):
    async def fake_base(db, staff_id):
        raise matching_module.HTTPException(status_code=404, detail="staff not found")

    async def fake_search(self: Any, *args: Any, **kwargs: Any) -> dict[str, list[Any]]:
        return {"results": []}

    monkeypatch.setattr(matching_module, "_get_base_staff", fake_base)
    monkeypatch.setattr(matching_module.ShopSearchService, "search", fake_search)

    app = FastAPI()
    app.include_router(matching_module.router)
    client = TestClient(app)

    resp = client.get(
        "/api/guest/matching/search",
        params={
            "area": "osaka",
            "date": "2025-01-01",
            "sort": "recommended",
            "base_staff_id": "missing",
        },
    )
    assert resp.status_code == 404


def test_search_v2_unknown_sort_fallback(monkeypatch, matching_module):
    first = _mk_candidate("first")
    second = _mk_candidate("second")

    async def fake_search(self: Any, *args: Any, **kwargs: Any) -> dict[str, list[Any]]:
        return {"results": [first, second]}

    monkeypatch.setattr(matching_module.ShopSearchService, "search", fake_search)

    app = FastAPI()
    app.include_router(matching_module.router)
    client = TestClient(app)

    resp = client.get(
        "/api/guest/matching/search",
        params={"area": "osaka", "date": "2025-01-01", "sort": "unknown"},
    )
    assert resp.status_code == 200
    ids = [item["id"] for item in resp.json()["items"]]
    assert ids == ["first", "second"]


# ---- similar tests (unchanged behavior) ----


def _make_similar_base():
    return {
        "id": "base-1",
        "name": "Base Therapist",
        "shop_id": "shop-1",
        "age": 25,
        "price_rank": 2,
        "mood_tag": "calm",
        "style_tag": "relax",
        "look_type": "natural",
        "contact_style": "gentle",
        "hobby_tags": ["anime", "cafe"],
        "photo_url": "https://example.com/base.jpg",
        "is_available_now": True,
    }


def test_similar_basic_response(monkeypatch, matching_module):
    base = _make_similar_base()
    candidates = [
        {**base, "id": "c1", "name": "Cand 1", "price_rank": 2, "age": 24},
        {**base, "id": "c2", "name": "Cand 2", "price_rank": 3, "age": 30},
    ]

    async def fake_get_base(db, staff_id):
        assert staff_id == "base-1"
        return base

    async def fake_fetch(db, base, shop_id, exclude_unavailable, limit):
        return candidates

    monkeypatch.setattr(matching_module, "_get_base_staff", fake_get_base)
    monkeypatch.setattr(matching_module, "_fetch_similar_candidates", fake_fetch)

    app = FastAPI()
    app.include_router(matching_module.router)
    with TestClient(app) as test_client:
        resp = test_client.get(
            "/api/guest/matching/similar", params={"staff_id": "base-1", "limit": 2}
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["base_staff_id"] == "base-1"
        assert len(body["items"]) <= 2
        assert all(item["id"] != "base-1" for item in body["items"])


def test_similar_orders_by_score(monkeypatch, matching_module):
    base = _make_similar_base()
    strong_match = {**base, "id": "strong", "name": "Strong Match"}
    weaker = {
        **base,
        "id": "weak",
        "name": "Weak Match",
        "mood_tag": "mismatch",
        "style_tag": "mismatch",
        "hobby_tags": ["golf"],
    }

    async def fake_get_base(db, staff_id):
        return base

    async def fake_fetch(db, base, shop_id, exclude_unavailable, limit):
        return [weaker, strong_match]

    monkeypatch.setattr(matching_module, "_get_base_staff", fake_get_base)
    monkeypatch.setattr(matching_module, "_fetch_similar_candidates", fake_fetch)

    app = FastAPI()
    app.include_router(matching_module.router)
    with TestClient(app) as test_client:
        resp = test_client.get(
            "/api/guest/matching/similar", params={"staff_id": "base-1", "limit": 5}
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["items"][0]["id"] == "strong"


def test_similar_respects_min_score(monkeypatch, matching_module):
    base = _make_similar_base()
    low_score = {
        **base,
        "id": "low",
        "name": "Low",
        "mood_tag": "off",
        "style_tag": "off",
        "hobby_tags": [],
    }
    mid_score = {**base, "id": "mid", "name": "Mid"}

    async def fake_get_base(db, staff_id):
        return base

    async def fake_fetch(db, base, shop_id, exclude_unavailable, limit):
        return [low_score, mid_score]

    monkeypatch.setattr(matching_module, "_get_base_staff", fake_get_base)
    monkeypatch.setattr(matching_module, "_fetch_similar_candidates", fake_fetch)

    app = FastAPI()
    app.include_router(matching_module.router)
    with TestClient(app) as test_client:
        resp = test_client.get(
            "/api/guest/matching/similar",
            params={"staff_id": "base-1", "min_score": 0.7, "limit": 5},
        )
        assert resp.status_code == 200
        ids = [item["id"] for item in resp.json()["items"]]
        assert "low" not in ids
        assert "mid" in ids


def test_similar_exclude_unavailable(monkeypatch, matching_module):
    base = _make_similar_base()
    unavailable = {**base, "id": "u1", "name": "Unavailable", "is_available_now": False}
    available = {**base, "id": "a1", "name": "Available", "is_available_now": True}

    async def fake_get_base(db, staff_id):
        return base

    async def fake_fetch(db, base, shop_id, exclude_unavailable, limit):
        return [unavailable, available]

    monkeypatch.setattr(matching_module, "_get_base_staff", fake_get_base)
    monkeypatch.setattr(matching_module, "_fetch_similar_candidates", fake_fetch)

    app = FastAPI()
    app.include_router(matching_module.router)
    with TestClient(app) as test_client:
        resp = test_client.get(
            "/api/guest/matching/similar",
            params={"staff_id": "base-1", "exclude_unavailable": True, "limit": 5},
        )
        assert resp.status_code == 200
        ids = [item["id"] for item in resp.json()["items"]]
        assert "u1" not in ids
        assert "a1" in ids

        resp_include = test_client.get(
            "/api/guest/matching/similar",
            params={"staff_id": "base-1", "exclude_unavailable": False, "limit": 5},
        )
        assert resp_include.status_code == 200
        ids_include = [item["id"] for item in resp_include.json()["items"]]
        assert "u1" in ids_include


def test_similar_invalid_staff_returns_404(monkeypatch, matching_module):
    async def fake_get_base(db, staff_id):
        raise matching_module.HTTPException(status_code=404, detail="staff not found")

    async def fake_fetch(db, base, shop_id, exclude_unavailable, limit):
        return []

    monkeypatch.setattr(matching_module, "_get_base_staff", fake_get_base)
    monkeypatch.setattr(matching_module, "_fetch_similar_candidates", fake_fetch)

    app = FastAPI()
    app.include_router(matching_module.router)
    with TestClient(app) as test_client:
        resp = test_client.get(
            "/api/guest/matching/similar", params={"staff_id": "missing"}
        )
        assert resp.status_code == 404
