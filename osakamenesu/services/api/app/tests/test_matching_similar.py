from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.domains.site import guest_matching as matching_module
from app.db import get_session


client = TestClient(app)


class DummySession:  # pragma: no cover - simple placeholder
    pass


def setup_function() -> None:
    app.dependency_overrides[get_session] = lambda: DummySession()


def teardown_function() -> None:
    app.dependency_overrides.pop(get_session, None)


def _make_therapist(**overrides: Any) -> dict[str, Any]:
    base = {
        "id": str(uuid.uuid4()),
        "name": "Base",
        "profile_id": str(uuid.uuid4()),
        "profile_name": "Shop",
        "status": "published",
        "profile_status": "published",
        "mood_tag": "calm",
        "talk_level": "quiet",
        "style_tag": "relax",
        "look_type": "cool",
        "contact_style": "standard",
        "hobby_tags": ["music", "anime"],
    }
    base.update(overrides)
    return base


def test_similar_returns_ranked_candidates(monkeypatch: pytest.MonkeyPatch) -> None:
    base = _make_therapist(therapist_name="Target")
    good = _make_therapist(therapist_name="Good", mood_tag="calm", talk_level="quiet", name="Good")
    bad = _make_therapist(
        therapist_name="Bad", mood_tag="energetic", talk_level="talkative", name="Bad"
    )

    async def fake_get(db, therapist_id):  # type: ignore[return-type]
        return base

    async def fake_pool(db, base=None, shop_id=None, exclude_unavailable=True, limit=8):  # type: ignore[return-type]
        return [good, bad]

    monkeypatch.setattr(matching_module, "_get_base_staff", fake_get)
    monkeypatch.setattr(matching_module, "_fetch_similar_candidates", fake_pool)

    res = client.get(
        "/api/guest/matching/similar", params={"staff_id": base["id"]}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["base_staff_id"] == base["id"]
    names = [c["name"] for c in data["items"]]
    assert names == ["Good", "Bad"]  # good should rank above bad


def test_similar_404_when_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get(db, therapist_id):  # type: ignore[return-type]
        raise matching_module.HTTPException(status_code=404, detail="not found")

    async def fake_pool(db, base=None, shop_id=None, exclude_unavailable=True, limit=8):  # type: ignore[return-type]
        return []

    monkeypatch.setattr(matching_module, "_get_base_staff", fake_get)
    monkeypatch.setattr(matching_module, "_fetch_similar_candidates", fake_pool)
    res = client.get(
        "/api/guest/matching/similar", params={"staff_id": str(uuid.uuid4())}
    )
    assert res.status_code == 404


def test_similar_skips_unpublished(monkeypatch: pytest.MonkeyPatch) -> None:
    base = _make_therapist(therapist_name="Base", status="draft")
    candidate = _make_therapist(therapist_name="Candidate", profile_status="draft", name="Candidate")

    async def fake_get(db, therapist_id):  # type: ignore[return-type]
        raise matching_module.HTTPException(status_code=404, detail="therapist not found")

    async def fake_pool(db, base=None, shop_id=None, exclude_unavailable=True, limit=8):  # type: ignore[return-type]
        return [candidate]

    monkeypatch.setattr(matching_module, "_get_base_staff", fake_get)
    monkeypatch.setattr(matching_module, "_fetch_similar_candidates", fake_pool)

    res = client.get(
        "/api/guest/matching/similar", params={"staff_id": base["id"]}
    )
    assert res.status_code == 404


def test_similar_scores_use_tags(monkeypatch: pytest.MonkeyPatch) -> None:
    base = _make_therapist(mood_tag="calm", talk_level="quiet")
    closer = _make_therapist(therapist_name="Closer", mood_tag="calm", talk_level="quiet", name="Closer")
    farther = _make_therapist(
        therapist_name="Farther", mood_tag="energetic", talk_level="talkative", name="Farther"
    )

    async def fake_get(db, therapist_id):  # type: ignore[return-type]
        return base

    async def fake_pool(db, base=None, shop_id=None, exclude_unavailable=True, limit=8):  # type: ignore[return-type]
        return [closer, farther]

    monkeypatch.setattr(matching_module, "_get_base_staff", fake_get)
    monkeypatch.setattr(matching_module, "_fetch_similar_candidates", fake_pool)

    res = client.get(
        "/api/guest/matching/similar", params={"staff_id": base["id"]}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["items"][0]["name"] == "Closer"
