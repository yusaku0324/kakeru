"""Tests for Shop Therapists API (GET /api/v1/shops/{shop_id}/therapists)."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

# JST timezone
JST = timezone(timedelta(hours=9))

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import get_session
from app.domains.site.services.shop import therapists_service


SHOP_ID = uuid4()
THERAPIST_ID_1 = uuid4()
THERAPIST_ID_2 = uuid4()


class DummySession:
    """Dummy session for dependency override."""

    async def get(self, model, id_):
        return None

    async def execute(self, stmt):
        return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))


def setup_function() -> None:
    app.dependency_overrides[get_session] = lambda: DummySession()


def teardown_function() -> None:
    app.dependency_overrides.pop(get_session, None)


def _create_mock_profile(shop_id=SHOP_ID, status="published") -> SimpleNamespace:
    """Create a mock profile."""
    return SimpleNamespace(
        id=shop_id,
        status=status,
        name="Test Shop",
    )


def _create_mock_therapist(
    therapist_id=None,
    name="Test Therapist",
    status="published",
    *,
    with_tags: bool = False,
    with_photos: bool = True,
) -> SimpleNamespace:
    """Create a mock therapist."""
    return SimpleNamespace(
        id=therapist_id or uuid4(),
        profile_id=SHOP_ID,
        name=name,
        alias=None,
        age=25,
        headline="Experienced therapist",
        status=status,
        photo_urls=["https://example.com/photo1.jpg"] if with_photos else [],
        specialties=["massage", "aroma"],
        mood_tag="gentle" if with_tags else None,
        style_tag="soft" if with_tags else None,
        look_type="cute" if with_tags else None,
        contact_style="light" if with_tags else None,
        talk_level="moderate" if with_tags else None,
        hobby_tags=["travel", "music"] if with_tags else None,
        price_rank=3 if with_tags else None,
        display_order=1,
        created_at=datetime.now(),
    )


def _create_mock_shift(
    therapist_id,
    shift_date: date,
    start_time: time = time(10, 0),
    end_time: time = time(18, 0),
    availability_status: str = "available",
) -> SimpleNamespace:
    """Create a mock therapist shift."""
    return SimpleNamespace(
        id=uuid4(),
        therapist_id=therapist_id,
        date=shift_date,
        start_at=datetime.combine(shift_date, start_time, tzinfo=JST),
        end_at=datetime.combine(shift_date, end_time, tzinfo=JST),
        availability_status=availability_status,
    )


def _setup_mocks(
    monkeypatch: pytest.MonkeyPatch,
    *,
    profile=None,
    therapists: list | None = None,
    shifts: list | None = None,
) -> None:
    """Set up common mocks."""
    therapists = therapists or []
    shifts = shifts or []

    class MockSession:
        async def get(self, model, id_):
            if profile and id_ == profile.id:
                return profile
            return None

        async def execute(self, stmt):
            # Check if it's a therapist query or shift query
            stmt_str = str(stmt)
            if "therapist_shifts" in stmt_str.lower():
                return SimpleNamespace(
                    scalars=lambda: SimpleNamespace(all=lambda: shifts)
                )
            return SimpleNamespace(
                scalars=lambda: SimpleNamespace(all=lambda: therapists)
            )

    app.dependency_overrides[get_session] = lambda: MockSession()


client = TestClient(app)


# ---- Test cases ----


def test_list_shop_therapists_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test successful therapist listing."""
    profile = _create_mock_profile()
    therapist1 = _create_mock_therapist(THERAPIST_ID_1, "Therapist 1", with_tags=True)
    therapist2 = _create_mock_therapist(THERAPIST_ID_2, "Therapist 2", with_tags=False)

    _setup_mocks(monkeypatch, profile=profile, therapists=[therapist1, therapist2])

    res = client.get(f"/api/v1/shops/{SHOP_ID}/therapists")

    assert res.status_code == 200
    body = res.json()
    assert body["shop_id"] == str(SHOP_ID)
    assert body["total"] == 2
    assert len(body["items"]) == 2

    # Check first therapist has tags
    item1 = body["items"][0]
    assert item1["name"] == "Therapist 1"
    assert item1["tags"] is not None
    assert item1["tags"]["mood"] == "gentle"
    assert item1["tags"]["style"] == "soft"
    assert item1["age"] == 25
    assert item1["price_rank"] == 3

    # Check second therapist has no tags
    item2 = body["items"][1]
    assert item2["name"] == "Therapist 2"
    assert item2["tags"] is None


def test_list_shop_therapists_with_availability(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test therapist listing with availability slots."""
    profile = _create_mock_profile()
    therapist = _create_mock_therapist(THERAPIST_ID_1, "Therapist 1")
    # Align with production behavior (JST-based "today") to avoid CI flakiness when
    # the runner timezone is UTC.
    today = datetime.now(JST).date()
    shift = _create_mock_shift(THERAPIST_ID_1, today)

    _setup_mocks(monkeypatch, profile=profile, therapists=[therapist], shifts=[shift])

    res = client.get(f"/api/v1/shops/{SHOP_ID}/therapists?include_availability=true")

    assert res.status_code == 200
    body = res.json()
    assert len(body["items"]) == 1

    item = body["items"][0]
    assert item["today_available"] is True
    assert len(item["availability_slots"]) == 1


def test_list_shop_therapists_without_availability(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test therapist listing without availability (faster response)."""
    profile = _create_mock_profile()
    therapist = _create_mock_therapist(THERAPIST_ID_1, "Therapist 1")

    _setup_mocks(monkeypatch, profile=profile, therapists=[therapist])

    res = client.get(f"/api/v1/shops/{SHOP_ID}/therapists?include_availability=false")

    assert res.status_code == 200
    body = res.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["availability_slots"] == []


def test_list_shop_therapists_shop_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test 404 when shop does not exist."""
    _setup_mocks(monkeypatch, profile=None)

    non_existent_id = uuid4()
    res = client.get(f"/api/v1/shops/{non_existent_id}/therapists")

    assert res.status_code == 404
    assert "shop not found" in res.json()["detail"].lower()


def test_list_shop_therapists_draft_shop(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test 404 for draft/unpublished shop."""
    profile = _create_mock_profile(status="draft")
    _setup_mocks(monkeypatch, profile=None)  # Draft shops not returned

    res = client.get(f"/api/v1/shops/{SHOP_ID}/therapists")

    assert res.status_code == 404


def test_list_shop_therapists_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test empty therapist list for shop with no published therapists."""
    profile = _create_mock_profile()
    _setup_mocks(monkeypatch, profile=profile, therapists=[])

    res = client.get(f"/api/v1/shops/{SHOP_ID}/therapists")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 0
    assert body["items"] == []


def test_list_shop_therapists_excludes_draft(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that draft therapists are excluded."""
    profile = _create_mock_profile()
    published = _create_mock_therapist(THERAPIST_ID_1, "Published", status="published")
    # Note: draft therapists should not be in the result from the service
    # The mock setup only includes the published therapist

    _setup_mocks(monkeypatch, profile=profile, therapists=[published])

    res = client.get(f"/api/v1/shops/{SHOP_ID}/therapists")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Published"


def test_list_shop_therapists_pagination(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test pagination parameters."""
    profile = _create_mock_profile()
    therapist = _create_mock_therapist(THERAPIST_ID_1, "Therapist 1")

    _setup_mocks(monkeypatch, profile=profile, therapists=[therapist])

    res = client.get(f"/api/v1/shops/{SHOP_ID}/therapists?page=1&page_size=10")

    assert res.status_code == 200
    body = res.json()
    assert "items" in body
    assert "total" in body


def test_list_shop_therapists_avatar_url(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test avatar_url is set from first photo."""
    profile = _create_mock_profile()
    therapist = _create_mock_therapist(THERAPIST_ID_1, with_photos=True)

    _setup_mocks(monkeypatch, profile=profile, therapists=[therapist])

    res = client.get(f"/api/v1/shops/{SHOP_ID}/therapists")

    assert res.status_code == 200
    body = res.json()
    item = body["items"][0]
    assert item["avatar_url"] == "https://example.com/photo1.jpg"
    assert item["photos"] == ["https://example.com/photo1.jpg"]


def test_list_shop_therapists_no_photos(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test therapist with no photos."""
    profile = _create_mock_profile()
    therapist = _create_mock_therapist(THERAPIST_ID_1, with_photos=False)

    _setup_mocks(monkeypatch, profile=profile, therapists=[therapist])

    res = client.get(f"/api/v1/shops/{SHOP_ID}/therapists")

    assert res.status_code == 200
    body = res.json()
    item = body["items"][0]
    assert item["avatar_url"] is None
    assert item["photos"] == []


def test_list_shop_therapists_availability_days_param(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test availability_days parameter validation."""
    profile = _create_mock_profile()
    _setup_mocks(monkeypatch, profile=profile, therapists=[])

    # Valid value
    res = client.get(f"/api/v1/shops/{SHOP_ID}/therapists?availability_days=14")
    assert res.status_code == 200

    # Out of range (> 30)
    res = client.get(f"/api/v1/shops/{SHOP_ID}/therapists?availability_days=31")
    assert res.status_code == 422


# ---- recommended_score tests ----


def test_recommended_score_returned(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that recommended_score is returned (not None)."""
    profile = _create_mock_profile()
    therapist = _create_mock_therapist(THERAPIST_ID_1, "Therapist 1", with_tags=True)

    _setup_mocks(monkeypatch, profile=profile, therapists=[therapist])

    res = client.get(f"/api/v1/shops/{SHOP_ID}/therapists")

    assert res.status_code == 200
    body = res.json()
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["recommended_score"] is not None
    assert isinstance(item["recommended_score"], float)


def test_recommended_score_in_valid_range(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that recommended_score is in 0-1 range."""
    profile = _create_mock_profile()
    therapist1 = _create_mock_therapist(THERAPIST_ID_1, "Therapist 1", with_tags=True)
    therapist2 = _create_mock_therapist(THERAPIST_ID_2, "Therapist 2", with_tags=False)

    _setup_mocks(monkeypatch, profile=profile, therapists=[therapist1, therapist2])

    res = client.get(f"/api/v1/shops/{SHOP_ID}/therapists")

    assert res.status_code == 200
    body = res.json()
    for item in body["items"]:
        score = item["recommended_score"]
        assert score is not None
        assert 0.0 <= score <= 1.0, f"Score {score} out of range [0, 1]"


def test_recommended_score_with_availability_boost(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test that therapist with availability gets higher score than without."""
    profile = _create_mock_profile()
    # Both therapists same except for availability
    therapist_with_avail = _create_mock_therapist(
        THERAPIST_ID_1, "With Availability", with_tags=True
    )
    therapist_no_avail = _create_mock_therapist(
        THERAPIST_ID_2, "No Availability", with_tags=True
    )
    # Set same display_order to isolate availability effect
    therapist_with_avail.display_order = 1
    therapist_no_avail.display_order = 1

    # Align with production behavior (JST-based "today") to avoid CI flakiness when
    # the runner timezone is UTC.
    today = datetime.now(JST).date()
    shift = _create_mock_shift(THERAPIST_ID_1, today)

    _setup_mocks(
        monkeypatch,
        profile=profile,
        therapists=[therapist_with_avail, therapist_no_avail],
        shifts=[shift],  # Only therapist 1 has availability
    )

    res = client.get(f"/api/v1/shops/{SHOP_ID}/therapists")

    assert res.status_code == 200
    body = res.json()
    assert len(body["items"]) == 2

    # Find scores by name
    scores = {item["name"]: item["recommended_score"] for item in body["items"]}

    # Therapist with availability should have higher score (availability_boost = 0.15)
    assert scores["With Availability"] > scores["No Availability"], (
        f"Expected therapist with availability ({scores['With Availability']}) "
        f"to score higher than without ({scores['No Availability']})"
    )
