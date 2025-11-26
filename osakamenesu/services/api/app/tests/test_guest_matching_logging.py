from __future__ import annotations

import types
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient


class FakeSession:
    def __init__(self) -> None:
        self.added: list[Any] = []

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        return None

    async def rollback(self) -> None:
        return None


def _mk_candidate(name: str) -> dict[str, Any]:
    return {
        "id": name,
        "name": name,
        "shop_id": f"shop-{name}",
        "shop_name": f"Shop {name}",
        "price_rank": 2,
        "mood_tag": "calm",
        "style_tag": "relax",
        "look_type": "natural",
        "contact_style": "gentle",
        "hobby_tags": ["anime"],
        "age": 25,
        "photo_url": "https://example.com/photo.jpg",
        "photo_embedding": [1.0, 0.0, 0.0],
        "slots": [],
    }


def _make_client(session: FakeSession, matching_module, monkeypatch) -> TestClient:
    app = FastAPI()
    app.include_router(matching_module.router)

    async def _fake_session() -> Any:
        yield session

    app.dependency_overrides[matching_module.get_session] = _fake_session

    async def _fake_search(
        self: Any, *args: Any, **kwargs: Any
    ) -> dict[str, list[Any]]:
        return {"results": [_mk_candidate("a")]}

    monkeypatch.setattr(matching_module.ShopSearchService, "search", _fake_search)
    return TestClient(app)


def _load_module(monkeypatch):
    mod = __import__("app.domains.site.guest_matching", fromlist=["*"])
    return mod


def test_log_phase_step_entry(monkeypatch):
    matching_module = _load_module(monkeypatch)
    session = FakeSession()
    client = _make_client(session, matching_module, monkeypatch)

    resp = client.get(
        "/api/guest/matching/search",
        params={
            "area": "osaka",
            "date": "2025-01-01",
            "time_from": "10:00",
            "time_to": "11:00",
            "phase": "book",
            "step_index": 3,
            "entry_source": "concierge",
        },
    )
    assert resp.status_code == 200
    # logging is best-effort; ensure it attempted to add one entry
    assert session.added, "log entry should be added"
    log = session.added[0]
    assert log.phase == "book"
    assert log.step_index == 3
    assert log.entry_source == "concierge"


def test_log_defaults_to_null(monkeypatch):
    matching_module = _load_module(monkeypatch)
    session = FakeSession()
    client = _make_client(session, matching_module, monkeypatch)

    resp = client.get(
        "/api/guest/matching/search",
        params={
            "area": "osaka",
            "date": "2025-01-01",
        },
    )
    assert resp.status_code == 200
    assert session.added, "log entry should be added"
    log = session.added[0]
    assert log.phase is None
    assert log.step_index is None
    assert log.entry_source is None
