"""Tests for Similar Therapists API (GET /api/v1/therapists/{therapist_id}/similar)."""

from __future__ import annotations

from datetime import date, time
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import get_session
from app.domains.site import therapists as therapists_module


THERAPIST_ID = uuid4()
THERAPIST_ID_2 = uuid4()
THERAPIST_ID_3 = uuid4()
PROFILE_ID = uuid4()
PROFILE_ID_2 = uuid4()
PROFILE_ID_3 = uuid4()


class DummySession:
    pass


def setup_function() -> None:
    app.dependency_overrides[get_session] = lambda: DummySession()


def teardown_function() -> None:
    app.dependency_overrides.pop(get_session, None)


def _create_mock_therapist(
    *,
    therapist_id=None,
    profile_id=None,
    name: str = "Test Therapist",
    status: str = "published",
    photo_urls: list[str] | None = None,
    specialties: list[str] | None = None,
    mood_tag: str | None = None,
    style_tag: str | None = None,
    look_type: str | None = None,
    talk_level: str | None = None,
    contact_style: str | None = None,
    hobby_tags: list[str] | None = None,
    display_order: int = 0,
) -> SimpleNamespace:
    """Create a mock Therapist object."""
    return SimpleNamespace(
        id=therapist_id or uuid4(),
        profile_id=profile_id or uuid4(),
        name=name,
        status=status,
        photo_urls=photo_urls or [],
        specialties=specialties or [],
        mood_tag=mood_tag,
        style_tag=style_tag,
        look_type=look_type,
        talk_level=talk_level,
        contact_style=contact_style,
        hobby_tags=hobby_tags,
        display_order=display_order,
    )


def _create_mock_profile(
    *,
    profile_id=None,
    status: str = "published",
    price_min: int = 10000,
    price_max: int = 15000,
    body_tags: list[str] | None = None,
    mood_tag: str | None = None,
    style_tag: str | None = None,
    look_type: str | None = None,
    talk_level: str | None = None,
    contact_style: str | None = None,
    hobby_tags: list[str] | None = None,
) -> SimpleNamespace:
    """Create a mock Profile object."""
    return SimpleNamespace(
        id=profile_id or uuid4(),
        status=status,
        price_min=price_min,
        price_max=price_max,
        body_tags=body_tags or [],
        mood_tag=mood_tag,
        style_tag=style_tag,
        look_type=look_type,
        talk_level=talk_level,
        contact_style=contact_style,
        hobby_tags=hobby_tags,
    )


def _create_mock_shift(
    *,
    therapist_id,
    shift_date: date | None = None,
    start_time: time | None = None,
    end_time: time | None = None,
) -> SimpleNamespace:
    """Create a mock TherapistShift object."""
    return SimpleNamespace(
        therapist_id=therapist_id,
        date=shift_date or date.today(),
        start_time=start_time or time(10, 0),
        end_time=end_time or time(22, 0),
    )


def _setup_mocks(
    monkeypatch: pytest.MonkeyPatch,
    base_therapist: tuple[SimpleNamespace, SimpleNamespace] | None = None,
    candidate_pool: list[tuple[SimpleNamespace, SimpleNamespace]] | None = None,
    shifts: list[SimpleNamespace] | None = None,
) -> None:
    """Set up common mocks for similar therapists tests."""

    async def _mock_get_base_therapist(db, therapist_id):
        if base_therapist is None:
            from fastapi import HTTPException, status

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "message": "Therapist not found",
                    "reason_code": "therapist_not_found",
                },
            )
        therapist, profile = base_therapist
        if therapist.id != therapist_id:
            from fastapi import HTTPException, status

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "message": "Therapist not found",
                    "reason_code": "therapist_not_found",
                },
            )
        tags = therapists_module._extract_tags(therapist, profile)
        return {
            "therapist_id": str(therapist.id),
            "therapist_name": therapist.name,
            "photo_urls": therapist.photo_urls,
            "price_min": profile.price_min,
            "price_max": profile.price_max,
            **tags,
        }

    async def _mock_fetch_similar_pool(db, exclude_id, limit):
        if candidate_pool is None:
            return []
        candidates = []
        for therapist, profile in candidate_pool:
            if therapist.id == exclude_id:
                continue
            tags = therapists_module._extract_tags(therapist, profile)
            candidates.append(
                {
                    "therapist_id": str(therapist.id),
                    "therapist_name": therapist.name,
                    "photo_urls": therapist.photo_urls,
                    "price_min": profile.price_min,
                    "price_max": profile.price_max,
                    **tags,
                }
            )
        return candidates

    async def _mock_check_today_availability(db, therapist_id):
        if shifts is None:
            return False
        for shift in shifts:
            if shift.therapist_id == therapist_id:
                return True
        return False

    monkeypatch.setattr(
        therapists_module, "_get_base_therapist", _mock_get_base_therapist
    )
    monkeypatch.setattr(
        therapists_module, "_fetch_similar_pool", _mock_fetch_similar_pool
    )
    monkeypatch.setattr(
        therapists_module, "_check_today_availability", _mock_check_today_availability
    )


client = TestClient(app)


# ---- Test cases for GET /api/v1/therapists/{therapist_id}/similar ----


def test_get_similar_therapists_empty_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test similar therapists when no candidates exist."""
    base_therapist = _create_mock_therapist(therapist_id=THERAPIST_ID)
    base_profile = _create_mock_profile(profile_id=PROFILE_ID)
    _setup_mocks(monkeypatch, base_therapist=(base_therapist, base_profile))

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}/similar")

    assert res.status_code == 200
    body = res.json()
    assert body["therapists"] == []


def test_get_similar_therapists_with_results(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test similar therapists returns candidates sorted by similarity."""
    base_therapist = _create_mock_therapist(
        therapist_id=THERAPIST_ID,
        mood_tag="calm",
        style_tag="gentle",
        specialties=["massage", "aroma"],
    )
    base_profile = _create_mock_profile(
        profile_id=PROFILE_ID, price_min=10000, price_max=15000
    )

    # Similar candidate (same mood/style)
    similar_therapist = _create_mock_therapist(
        therapist_id=THERAPIST_ID_2,
        name="Similar Therapist",
        mood_tag="calm",
        style_tag="gentle",
        specialties=["massage"],
        photo_urls=["https://example.com/photo.jpg"],
    )
    similar_profile = _create_mock_profile(
        profile_id=PROFILE_ID_2, price_min=12000, price_max=18000
    )

    # Less similar candidate (different mood/style)
    different_therapist = _create_mock_therapist(
        therapist_id=THERAPIST_ID_3,
        name="Different Therapist",
        mood_tag="energetic",
        style_tag="dynamic",
        specialties=["stretching"],
    )
    different_profile = _create_mock_profile(
        profile_id=PROFILE_ID_3, price_min=8000, price_max=12000
    )

    _setup_mocks(
        monkeypatch,
        base_therapist=(base_therapist, base_profile),
        candidate_pool=[
            (different_therapist, different_profile),
            (similar_therapist, similar_profile),
        ],
    )

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}/similar")

    assert res.status_code == 200
    body = res.json()
    assert len(body["therapists"]) == 2

    # Similar therapist should be first (higher score)
    assert body["therapists"][0]["name"] == "Similar Therapist"
    assert body["therapists"][0]["id"] == str(THERAPIST_ID_2)
    assert (
        body["therapists"][0]["similarity_score"]
        > body["therapists"][1]["similarity_score"]
    )

    # Different therapist should be second
    assert body["therapists"][1]["name"] == "Different Therapist"


def test_get_similar_therapists_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test 404 when base therapist does not exist."""
    _setup_mocks(monkeypatch, base_therapist=None)

    non_existent_id = uuid4()
    res = client.get(f"/api/v1/therapists/{non_existent_id}/similar")

    assert res.status_code == 404
    body = res.json()
    assert body["detail"]["reason_code"] == "therapist_not_found"


def test_get_similar_therapists_with_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test similar therapists respects limit parameter."""
    base_therapist = _create_mock_therapist(therapist_id=THERAPIST_ID)
    base_profile = _create_mock_profile(profile_id=PROFILE_ID)

    # Create 5 candidates
    candidates = []
    for i in range(5):
        t = _create_mock_therapist(therapist_id=uuid4(), name=f"Therapist {i}")
        p = _create_mock_profile(profile_id=uuid4())
        candidates.append((t, p))

    _setup_mocks(
        monkeypatch,
        base_therapist=(base_therapist, base_profile),
        candidate_pool=candidates,
    )

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}/similar?limit=3")

    assert res.status_code == 200
    body = res.json()
    assert len(body["therapists"]) == 3


def test_get_similar_therapists_with_availability(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test similar therapists includes availability information."""
    base_therapist = _create_mock_therapist(therapist_id=THERAPIST_ID)
    base_profile = _create_mock_profile(profile_id=PROFILE_ID)

    available_therapist = _create_mock_therapist(
        therapist_id=THERAPIST_ID_2,
        name="Available Therapist",
    )
    available_profile = _create_mock_profile(profile_id=PROFILE_ID_2)

    unavailable_therapist = _create_mock_therapist(
        therapist_id=THERAPIST_ID_3,
        name="Unavailable Therapist",
    )
    unavailable_profile = _create_mock_profile(profile_id=PROFILE_ID_3)

    # Only THERAPIST_ID_2 has a shift today
    shifts = [_create_mock_shift(therapist_id=THERAPIST_ID_2)]

    _setup_mocks(
        monkeypatch,
        base_therapist=(base_therapist, base_profile),
        candidate_pool=[
            (available_therapist, available_profile),
            (unavailable_therapist, unavailable_profile),
        ],
        shifts=shifts,
    )

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}/similar")

    assert res.status_code == 200
    body = res.json()
    assert len(body["therapists"]) == 2

    # Find therapists by name
    available = next(
        t for t in body["therapists"] if t["name"] == "Available Therapist"
    )
    unavailable = next(
        t for t in body["therapists"] if t["name"] == "Unavailable Therapist"
    )

    assert available["available_today"] is True
    assert unavailable["available_today"] is False


def test_get_similar_therapists_includes_tags(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test similar therapists includes mood and style tags."""
    base_therapist = _create_mock_therapist(therapist_id=THERAPIST_ID)
    base_profile = _create_mock_profile(profile_id=PROFILE_ID)

    candidate = _create_mock_therapist(
        therapist_id=THERAPIST_ID_2,
        name="Tagged Therapist",
        mood_tag="relaxed",
        style_tag="soft",
    )
    candidate_profile = _create_mock_profile(profile_id=PROFILE_ID_2)

    _setup_mocks(
        monkeypatch,
        base_therapist=(base_therapist, base_profile),
        candidate_pool=[(candidate, candidate_profile)],
    )

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}/similar")

    assert res.status_code == 200
    body = res.json()
    assert len(body["therapists"]) == 1
    assert body["therapists"][0]["tags"]["mood"] == "relaxed"
    assert body["therapists"][0]["tags"]["style"] == "soft"


def test_get_similar_therapists_includes_price_rank(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test similar therapists includes price rank."""
    base_therapist = _create_mock_therapist(therapist_id=THERAPIST_ID)
    base_profile = _create_mock_profile(profile_id=PROFILE_ID)

    # Budget therapist (low prices -> rank 1-2)
    budget_therapist = _create_mock_therapist(
        therapist_id=THERAPIST_ID_2,
        name="Budget Therapist",
    )
    budget_profile = _create_mock_profile(
        profile_id=PROFILE_ID_2,
        price_min=3000,
        price_max=5000,
    )

    # Premium therapist (high prices -> rank 4-5)
    premium_therapist = _create_mock_therapist(
        therapist_id=THERAPIST_ID_3,
        name="Premium Therapist",
    )
    premium_profile = _create_mock_profile(
        profile_id=PROFILE_ID_3,
        price_min=20000,
        price_max=30000,
    )

    _setup_mocks(
        monkeypatch,
        base_therapist=(base_therapist, base_profile),
        candidate_pool=[
            (budget_therapist, budget_profile),
            (premium_therapist, premium_profile),
        ],
    )

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}/similar")

    assert res.status_code == 200
    body = res.json()
    assert len(body["therapists"]) == 2

    budget = next(t for t in body["therapists"] if t["name"] == "Budget Therapist")
    premium = next(t for t in body["therapists"] if t["name"] == "Premium Therapist")

    # Budget should have lower price_rank
    assert budget["price_rank"] < premium["price_rank"]


def test_get_similar_therapists_includes_photos(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test similar therapists includes photo URLs."""
    base_therapist = _create_mock_therapist(therapist_id=THERAPIST_ID)
    base_profile = _create_mock_profile(profile_id=PROFILE_ID)

    candidate = _create_mock_therapist(
        therapist_id=THERAPIST_ID_2,
        name="Photogenic Therapist",
        photo_urls=["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
    )
    candidate_profile = _create_mock_profile(profile_id=PROFILE_ID_2)

    _setup_mocks(
        monkeypatch,
        base_therapist=(base_therapist, base_profile),
        candidate_pool=[(candidate, candidate_profile)],
    )

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}/similar")

    assert res.status_code == 200
    body = res.json()
    assert len(body["therapists"]) == 1
    assert len(body["therapists"][0]["photos"]) == 2
    assert "https://example.com/photo1.jpg" in body["therapists"][0]["photos"]


def test_get_similar_therapists_limit_validation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test limit parameter validation (max 20)."""
    base_therapist = _create_mock_therapist(therapist_id=THERAPIST_ID)
    base_profile = _create_mock_profile(profile_id=PROFILE_ID)
    _setup_mocks(monkeypatch, base_therapist=(base_therapist, base_profile))

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}/similar?limit=25")

    assert res.status_code == 422  # Validation error


def test_get_similar_therapists_limit_min_validation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test limit parameter validation (min 1)."""
    base_therapist = _create_mock_therapist(therapist_id=THERAPIST_ID)
    base_profile = _create_mock_profile(profile_id=PROFILE_ID)
    _setup_mocks(monkeypatch, base_therapist=(base_therapist, base_profile))

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}/similar?limit=0")

    assert res.status_code == 422  # Validation error


def test_get_similar_therapists_excludes_self(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that base therapist is excluded from results."""
    base_therapist = _create_mock_therapist(
        therapist_id=THERAPIST_ID, name="Base Therapist"
    )
    base_profile = _create_mock_profile(profile_id=PROFILE_ID)

    # Include the base therapist in candidate pool (should be excluded)
    other_therapist = _create_mock_therapist(
        therapist_id=THERAPIST_ID_2, name="Other Therapist"
    )
    other_profile = _create_mock_profile(profile_id=PROFILE_ID_2)

    _setup_mocks(
        monkeypatch,
        base_therapist=(base_therapist, base_profile),
        candidate_pool=[
            (base_therapist, base_profile),  # This should be excluded
            (other_therapist, other_profile),
        ],
    )

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}/similar")

    assert res.status_code == 200
    body = res.json()
    # Only the other therapist should be in results
    assert len(body["therapists"]) == 1
    assert body["therapists"][0]["name"] == "Other Therapist"


def test_get_similar_therapists_similarity_score_range(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test that similarity scores are in valid range [0.0, 1.0]."""
    base_therapist = _create_mock_therapist(therapist_id=THERAPIST_ID)
    base_profile = _create_mock_profile(profile_id=PROFILE_ID)

    candidate = _create_mock_therapist(therapist_id=THERAPIST_ID_2)
    candidate_profile = _create_mock_profile(profile_id=PROFILE_ID_2)

    _setup_mocks(
        monkeypatch,
        base_therapist=(base_therapist, base_profile),
        candidate_pool=[(candidate, candidate_profile)],
    )

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}/similar")

    assert res.status_code == 200
    body = res.json()
    assert len(body["therapists"]) == 1

    score = body["therapists"][0]["similarity_score"]
    assert 0.0 <= score <= 1.0


# ---- Unit tests for helper functions ----


def test_normalize_function() -> None:
    """Test _normalize clamps values to [0.0, 1.0]."""
    assert therapists_module._normalize(None) == 0.5
    assert therapists_module._normalize(0.5) == 0.5
    assert therapists_module._normalize(0.0) == 0.0
    assert therapists_module._normalize(1.0) == 1.0
    assert therapists_module._normalize(-0.5) == 0.0
    assert therapists_module._normalize(1.5) == 1.0


def test_match_score_function() -> None:
    """Test _match_score returns correct values for tag matching."""
    assert therapists_module._match_score("calm", "calm") == 1.0
    assert therapists_module._match_score("calm", "energetic") == 0.3
    assert therapists_module._match_score(None, "calm") == 0.5
    assert therapists_module._match_score("calm", None) == 0.5
    assert therapists_module._match_score(None, None) == 0.5


def test_list_overlap_function() -> None:
    """Test _list_overlap computes correct overlap scores."""
    # Perfect overlap
    assert therapists_module._list_overlap(["a", "b"], ["a", "b"]) == 1.0

    # Partial overlap
    score = therapists_module._list_overlap(["a", "b", "c"], ["a", "b"])
    assert 0.3 < score < 1.0

    # No overlap
    assert therapists_module._list_overlap(["a", "b"], ["c", "d"]) == 0.3

    # Empty lists
    assert therapists_module._list_overlap(None, ["a"]) == 0.5
    assert therapists_module._list_overlap(["a"], None) == 0.5
    assert therapists_module._list_overlap(None, None) == 0.5


def test_compute_price_rank_function() -> None:
    """Test _compute_price_rank returns correct price tiers."""
    # Very cheap (rank 1)
    assert therapists_module._compute_price_rank(2000, 4000) == 1

    # Cheap (rank 2)
    assert therapists_module._compute_price_rank(5000, 9000) == 2

    # Mid-range (rank 3)
    assert therapists_module._compute_price_rank(10000, 15000) == 3

    # Expensive (rank 4)
    assert therapists_module._compute_price_rank(15000, 20000) == 4

    # Very expensive (rank 5)
    assert therapists_module._compute_price_rank(25000, 35000) == 5

    # Missing prices
    assert therapists_module._compute_price_rank(None, 10000) is None
    assert therapists_module._compute_price_rank(10000, None) is None


def test_score_similarity_function() -> None:
    """Test _score_similarity computes weighted score correctly."""
    # Perfect match
    target = {
        "mood_tag": "calm",
        "talk_level": "quiet",
        "style_tag": "gentle",
        "look_type": "natural",
        "contact_style": "minimal",
        "hobby_tags": ["massage"],
    }
    candidate_same = target.copy()
    score_same = therapists_module._score_similarity(target, candidate_same)
    assert score_same == 1.0

    # Completely different
    candidate_different = {
        "mood_tag": "energetic",
        "talk_level": "talkative",
        "style_tag": "dynamic",
        "look_type": "glamorous",
        "contact_style": "active",
        "hobby_tags": ["stretching"],
    }
    score_different = therapists_module._score_similarity(target, candidate_different)
    assert score_different < score_same

    # Partial match
    candidate_partial = {
        "mood_tag": "calm",  # Same
        "talk_level": "talkative",  # Different
        "style_tag": "gentle",  # Same
        "look_type": "glamorous",  # Different
        "contact_style": "minimal",  # Same
        "hobby_tags": ["massage", "stretching"],  # Partial overlap
    }
    score_partial = therapists_module._score_similarity(target, candidate_partial)
    assert score_different < score_partial < score_same
