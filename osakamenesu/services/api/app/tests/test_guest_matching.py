from __future__ import annotations

import importlib
import sys
import types
from datetime import date
from typing import Any, Iterator

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

    return importlib.import_module("app.domains.site.guest_matching")


@pytest.fixture()
def matching_module(monkeypatch: pytest.MonkeyPatch):
    return _load_matching_module(monkeypatch)


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch, matching_module) -> Iterator[TestClient]:
    """
    Route-level smoke test with in-memory stubs so the suite stays independent
    of a real database/async driver.
    """
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

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_matching_search_ok(client: TestClient) -> None:
    payload = {"area": "osaka", "date": "2025-11-04", "budget_level": "mid"}
    resp = client.post("/api/guest/matching/search", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert "top_matches" in body
    assert isinstance(body["top_matches"], list)
    assert body["top_matches"] == []


def test_matching_search_requires_area_date(client: TestClient) -> None:
    resp = client.post(
        "/api/guest/matching/search", json={"area": "", "date": "2025-11-04"}
    )
    assert resp.status_code == 422


@pytest.mark.parametrize(
    "candidate_key,pref_key,match_value,mismatch_value",
    [
        ("mood_tag", "mood_pref", "calm", "energetic"),
        ("style_tag", "style_pref", "relax", "strong"),
        ("look_type", "look_pref", "natural", "beauty"),
        ("talk_level", "talk_pref", "gentle", "assertive"),  # contact_style proxy
    ],
)
def test_score_prefers_matching_tags(
    matching_module,
    candidate_key: str,
    pref_key: str,
    match_value: str,
    mismatch_value: str,
) -> None:
    payload_kwargs = {
        "mood_pref": {"calm": 1.0, "energetic": 0.2},
        "style_pref": {"relax": 1.0, "strong": 0.2},
        "look_pref": {"natural": 1.0, "beauty": 0.2},
        "talk_pref": {"gentle": 1.0, "assertive": 0.2},
    }
    payload = matching_module.GuestMatchingRequest(
        area="osaka",
        date=date(2025, 1, 1),
        budget_level="mid",
        **payload_kwargs,
    )
    base = {"price_level": "standard", "slots": [{}]}
    candidate_match = {**base, candidate_key: match_value}
    candidate_mismatch = {**base, candidate_key: mismatch_value}

    score_match = matching_module._score_candidate(payload, candidate_match)
    score_mismatch = matching_module._score_candidate(payload, candidate_mismatch)

    assert score_match > score_mismatch


def test_missing_tags_are_neutral(matching_module) -> None:
    payload = matching_module.GuestMatchingRequest(
        area="osaka",
        date=date(2025, 1, 1),
        budget_level="mid",
        mood_pref={"calm": 1.0, "energetic": 0.1},
    )
    base = {"price_level": "standard", "slots": [{}]}
    candidate_match = {**base, "mood_tag": "calm"}
    candidate_missing = {**base, "mood_tag": None}
    candidate_mismatch = {**base, "mood_tag": "energetic"}

    score_match = matching_module._score_candidate(payload, candidate_match)
    score_missing = matching_module._score_candidate(payload, candidate_missing)
    score_mismatch = matching_module._score_candidate(payload, candidate_mismatch)

    assert score_match > score_missing > score_mismatch


def test_contact_style_aligns_with_talk_fit(matching_module) -> None:
    payload = matching_module.GuestMatchingRequest(
        area="osaka",
        date=date(2025, 1, 1),
        budget_level="mid",
        talk_pref={"soft": 1.0, "pushy": 0.1},
    )
    base = {"price_level": "standard", "slots": [{}]}
    candidate_match = {**base, "talk_level": "soft", "contact_style": "soft"}
    candidate_mismatch = {**base, "talk_level": "pushy", "contact_style": "pushy"}

    score_match = matching_module._score_candidate(payload, candidate_match)
    score_mismatch = matching_module._score_candidate(payload, candidate_mismatch)

    assert score_match > score_mismatch


def test_hobby_tags_are_neutral_placeholders(matching_module) -> None:
    payload = matching_module.GuestMatchingRequest(
        area="osaka",
        date=date(2025, 1, 1),
        budget_level="mid",
    )
    base = {"price_level": "standard", "slots": [{}], "mood_tag": None}
    candidate_with_hobbies = {**base, "hobby_tags": ["golf", "anime"]}
    candidate_without_hobbies = {**base, "hobby_tags": []}

    score_with = matching_module._score_candidate(payload, candidate_with_hobbies)
    score_without = matching_module._score_candidate(payload, candidate_without_hobbies)

    assert score_with == pytest.approx(score_without)


def test_score_orders_candidates_by_overall_fit(matching_module) -> None:
    payload = matching_module.GuestMatchingRequest(
        area="osaka",
        date=date(2025, 1, 1),
        budget_level="mid",
        mood_pref={"calm": 1.0, "energetic": 0.0},
        style_pref={"relax": 1.0, "strong": 0.1},
        look_pref={"natural": 1.0, "beauty": 0.1},
        talk_pref={"quiet": 1.0, "talkative": 0.2},
    )
    base = {"price_level": "standard", "slots": [{}]}
    perfect = {
        **base,
        "mood_tag": "calm",
        "style_tag": "relax",
        "look_type": "natural",
        "talk_level": "quiet",
    }
    partial = {
        **base,
        "mood_tag": "calm",
        "style_tag": "relax",
        "look_type": "beauty",
        "talk_level": "talkative",
    }
    off = {
        **base,
        "mood_tag": "energetic",
        "style_tag": "strong",
        "look_type": "beauty",
        "talk_level": "talkative",
    }

    score_perfect = matching_module._score_candidate(payload, perfect)
    score_partial = matching_module._score_candidate(payload, partial)
    score_off = matching_module._score_candidate(payload, off)

    assert score_perfect > score_partial > score_off


def test_score_matches_reference_formula(matching_module) -> None:
    payload = matching_module.GuestMatchingRequest(
        area="osaka",
        date=date(2025, 1, 1),
        budget_level="mid",
        mood_pref={"calm": 1.0, "energetic": 0.2},
        style_pref={"relax": 0.9, "strong": 0.2},
        look_pref={"natural": 0.8, "beauty": 0.3},
        talk_pref={"quiet": 0.9, "talkative": 0.2},
    )
    candidate = {
        "price_level": "standard",
        "mood_tag": "calm",
        "style_tag": "relax",
        "look_type": "natural",
        "talk_level": "quiet",
        "slots": [{}],
    }

    backend_score = matching_module._score_candidate(payload, candidate)

    def _reference_score() -> float:
        price_order = ["value", "standard", "premium"]
        guest_idx = 1  # mid => standard
        therapist_idx = price_order.index(candidate["price_level"])
        diff = abs(guest_idx - therapist_idx)
        price_fit = 1.0 if diff == 0 else 0.6 if diff == 1 else 0.3

        def _fit(pref: dict[str, float] | None, tag: str | None) -> float:
            if not pref or not tag:
                return 0.5
            return max(0.0, min(1.0, pref.get(tag, 0.0)))

        core = 0.6
        availability = 0.8
        mood = _fit(payload.mood_pref, candidate["mood_tag"])
        talk = _fit(payload.talk_pref, candidate["talk_level"])
        style = _fit(payload.style_pref, candidate["style_tag"])
        look = _fit(payload.look_pref, candidate["look_type"])

        return (
            0.4 * core
            + 0.15 * price_fit
            + 0.15 * mood
            + 0.1 * talk
            + 0.1 * style
            + 0.05 * look
            + 0.05 * availability
        )

    assert backend_score == pytest.approx(_reference_score())
