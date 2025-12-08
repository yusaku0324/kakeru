"""Tests for therapist detail API."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.domains.site import therapists as domain
from app.db import get_session


SHOP_ID = uuid4()
THERAPIST_ID = uuid4()
SHOP_SLUG = "test-shop"


class DummySession:
    pass


def setup_function() -> None:
    app.dependency_overrides[get_session] = lambda: DummySession()


def teardown_function() -> None:
    app.dependency_overrides.pop(get_session, None)


def _mock_profile() -> SimpleNamespace:
    return SimpleNamespace(
        id=SHOP_ID,
        slug=SHOP_SLUG,
        name="Test Shop",
        area="tokyo",
        price_min=10000,
        price_max=15000,
        age=25,
        ranking_badges=["top_rated"],
        buffer_minutes=0,
        body_tags=["massage", "relaxation"],
    )


def _mock_therapist(profile: SimpleNamespace) -> SimpleNamespace:
    return SimpleNamespace(
        id=THERAPIST_ID,
        profile_id=SHOP_ID,
        name="Test Therapist",
        biography="Test bio",
        photo_urls=["https://example.com/photo.jpg"],
        specialties=["massage", "aroma"],
        status="published",
        profile=profile,
    )


client = TestClient(app)


def test_get_therapist_detail_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test successful therapist detail fetch."""
    profile = _mock_profile()
    therapist = _mock_therapist(profile)

    async def mock_fetch_with_profile(db, therapist_id):
        if therapist_id == THERAPIST_ID:
            return (therapist, profile)
        return None

    async def mock_build_slots(db, therapist_id, days, slot_granularity_minutes):
        return []

    monkeypatch.setattr(
        domain, "_fetch_therapist_with_profile", mock_fetch_with_profile
    )
    monkeypatch.setattr(domain, "_build_availability_slots", mock_build_slots)

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}")

    assert res.status_code == 200
    body = res.json()

    assert body["therapist"]["id"] == str(THERAPIST_ID)
    assert body["therapist"]["name"] == "Test Therapist"
    assert body["therapist"]["profile_text"] == "Test bio"
    assert body["therapist"]["price_rank"] == 3  # 10000-15000 average = 12500 => rank 3

    assert body["shop"]["id"] == str(SHOP_ID)
    assert body["shop"]["slug"] == SHOP_SLUG
    assert body["shop"]["name"] == "Test Shop"
    assert body["shop"]["area"] == "tokyo"

    assert body["entry_source"] == "direct"
    assert body["availability"]["phase"] == "explore"


def test_get_therapist_detail_with_shop_slug(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test therapist detail with shop_slug verification."""
    profile = _mock_profile()
    therapist = _mock_therapist(profile)

    async def mock_fetch_by_shop_slug(db, therapist_id, shop_slug):
        if therapist_id == THERAPIST_ID and shop_slug == SHOP_SLUG:
            return (therapist, profile)
        return None

    async def mock_build_slots(db, therapist_id, days, slot_granularity_minutes):
        return []

    monkeypatch.setattr(
        domain, "_fetch_therapist_by_shop_slug", mock_fetch_by_shop_slug
    )
    monkeypatch.setattr(domain, "_build_availability_slots", mock_build_slots)

    res = client.get(
        f"/api/v1/therapists/{THERAPIST_ID}",
        params={"shop_slug": SHOP_SLUG, "entry_source": "shop_page"},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["entry_source"] == "shop_page"


def test_get_therapist_detail_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test 404 when therapist not found."""

    async def mock_fetch_with_profile(db, therapist_id):
        return None

    monkeypatch.setattr(
        domain, "_fetch_therapist_with_profile", mock_fetch_with_profile
    )

    res = client.get(f"/api/v1/therapists/{uuid4()}")

    assert res.status_code == 404
    body = res.json()
    assert body["detail"]["reason_code"] == "therapist_not_found"


def test_get_therapist_detail_shop_slug_mismatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test 404 when shop_slug doesn't match."""
    profile = _mock_profile()
    therapist = _mock_therapist(profile)

    async def mock_fetch_by_shop_slug(db, therapist_id, shop_slug):
        # Return None when shop_slug doesn't match
        return None

    async def mock_fetch_with_profile(db, therapist_id):
        if therapist_id == THERAPIST_ID:
            return (therapist, profile)
        return None

    monkeypatch.setattr(
        domain, "_fetch_therapist_by_shop_slug", mock_fetch_by_shop_slug
    )
    monkeypatch.setattr(
        domain, "_fetch_therapist_with_profile", mock_fetch_with_profile
    )

    res = client.get(
        f"/api/v1/therapists/{THERAPIST_ID}",
        params={"shop_slug": "wrong-shop"},
    )

    assert res.status_code == 404
    body = res.json()
    assert body["detail"]["reason_code"] == "shop_slug_mismatch"


def test_get_therapist_detail_unpublished(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test 404 when therapist is not published."""
    profile = _mock_profile()
    therapist = _mock_therapist(profile)
    therapist.status = "draft"  # Not published

    async def mock_fetch_with_profile(db, therapist_id):
        if therapist_id == THERAPIST_ID:
            return (therapist, profile)
        return None

    monkeypatch.setattr(
        domain, "_fetch_therapist_with_profile", mock_fetch_with_profile
    )

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}")

    assert res.status_code == 404
    body = res.json()
    assert body["detail"]["reason_code"] == "therapist_not_found"


class TestRecommendedScore:
    """Test recommended score calculation."""

    def _make_mock_therapist(self, display_order=1, specialties=None):
        return SimpleNamespace(
            id=THERAPIST_ID,
            display_order=display_order,
            specialties=specialties or ["massage"],
        )

    def _make_mock_profile(
        self,
        body_tags=None,
        price_min=10000,
        price_max=15000,
        age=25,
        ranking_badges=None,
    ):
        return SimpleNamespace(
            body_tags=body_tags or ["massage"],
            price_min=price_min,
            price_max=price_max,
            age=age,
            ranking_badges=ranking_badges or [],
        )

    def test_recommended_score_returns_score_and_breakdown(self):
        therapist = self._make_mock_therapist()
        profile = self._make_mock_profile()
        score, breakdown = domain._compute_recommended_score(
            therapist, profile, "direct", False
        )
        assert 0.0 <= score <= 1.0
        assert breakdown is not None
        assert breakdown.score is not None

    def test_recommended_score_shop_page_entry_source(self):
        therapist = self._make_mock_therapist(display_order=1)
        profile = self._make_mock_profile()
        score_shop, _ = domain._compute_recommended_score(
            therapist, profile, "shop_page", False
        )
        score_direct, _ = domain._compute_recommended_score(
            therapist, profile, "direct", False
        )
        # shop_page should weight display_order more heavily
        # Both should be valid scores
        assert 0.0 <= score_shop <= 1.0
        assert 0.0 <= score_direct <= 1.0

    def test_recommended_score_with_availability_boost(self):
        therapist = self._make_mock_therapist()
        profile = self._make_mock_profile()
        score_with, breakdown_with = domain._compute_recommended_score(
            therapist, profile, "direct", True
        )
        score_without, breakdown_without = domain._compute_recommended_score(
            therapist, profile, "direct", False
        )
        # With availability should score higher
        assert score_with > score_without
        assert breakdown_with.availability_boost == 0.15
        assert breakdown_without.availability_boost == 0.0

    def test_recommended_score_top_rated_badge_boost(self):
        therapist = self._make_mock_therapist()
        profile_no_badge = self._make_mock_profile(ranking_badges=[])
        profile_top_rated = self._make_mock_profile(ranking_badges=["top_rated"])
        score_no_badge, _ = domain._compute_recommended_score(
            therapist, profile_no_badge, "direct", False
        )
        score_top_rated, _ = domain._compute_recommended_score(
            therapist, profile_top_rated, "direct", False
        )
        # top_rated should add 0.1 boost
        assert score_top_rated > score_no_badge

    def test_recommended_score_tag_similarity(self):
        therapist = self._make_mock_therapist(specialties=["massage", "aroma"])
        profile_match = self._make_mock_profile(body_tags=["massage", "aroma"])
        profile_no_match = self._make_mock_profile(body_tags=["sports", "fitness"])
        score_match, breakdown_match = domain._compute_recommended_score(
            therapist, profile_match, "direct", False
        )
        score_no_match, breakdown_no_match = domain._compute_recommended_score(
            therapist, profile_no_match, "direct", False
        )
        # Matching tags should have higher tag_similarity
        assert breakdown_match.tag_similarity > breakdown_no_match.tag_similarity


class TestPriceRank:
    """Test price rank calculation."""

    def test_price_rank_cheap(self):
        assert domain._compute_price_rank(3000, 4000) == 1

    def test_price_rank_mid_low(self):
        assert domain._compute_price_rank(8000, 10000) == 2

    def test_price_rank_mid(self):
        assert domain._compute_price_rank(12000, 15000) == 3

    def test_price_rank_mid_high(self):
        assert domain._compute_price_rank(16000, 20000) == 4

    def test_price_rank_expensive(self):
        assert domain._compute_price_rank(25000, 30000) == 5

    def test_price_rank_none(self):
        assert domain._compute_price_rank(None, None) is None
        assert domain._compute_price_rank(10000, None) is None
        assert domain._compute_price_rank(None, 10000) is None


# ---- Similar Therapists Tests ----


THERAPIST_ID_2 = uuid4()
THERAPIST_ID_3 = uuid4()


def _mock_profile_2() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        slug="shop-2",
        name="Shop 2",
        area="osaka",
        price_min=8000,
        price_max=12000,
        age=28,
        ranking_badges=[],
        buffer_minutes=0,
        status="published",
        mood_tag="relaxing",
        style_tag="gentle",
        body_tags=["massage"],
    )


def _mock_therapist_2(profile: SimpleNamespace) -> SimpleNamespace:
    return SimpleNamespace(
        id=THERAPIST_ID_2,
        profile_id=profile.id,
        name="Therapist 2",
        biography="Bio 2",
        photo_urls=["https://example.com/photo2.jpg"],
        specialties=["massage"],
        status="published",
        profile=profile,
        mood_tag="relaxing",
        style_tag="gentle",
        display_order=1,
    )


def _mock_profile_3() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        slug="shop-3",
        name="Shop 3",
        area="kyoto",
        price_min=15000,
        price_max=20000,
        age=30,
        ranking_badges=["premium"],
        buffer_minutes=0,
        status="published",
        mood_tag="energetic",
        style_tag="strong",
        body_tags=["sports"],
    )


def _mock_therapist_3(profile: SimpleNamespace) -> SimpleNamespace:
    return SimpleNamespace(
        id=THERAPIST_ID_3,
        profile_id=profile.id,
        name="Therapist 3",
        biography="Bio 3",
        photo_urls=["https://example.com/photo3.jpg"],
        specialties=["sports"],
        status="published",
        profile=profile,
        mood_tag="energetic",
        style_tag="strong",
        display_order=2,
    )


def test_get_similar_therapists_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test successful similar therapists fetch."""
    profile = _mock_profile()
    profile.mood_tag = "relaxing"
    profile.style_tag = "gentle"
    base_therapist = _mock_therapist(profile)
    base_therapist.mood_tag = "relaxing"
    base_therapist.style_tag = "gentle"

    profile2 = _mock_profile_2()
    therapist2 = _mock_therapist_2(profile2)

    profile3 = _mock_profile_3()
    therapist3 = _mock_therapist_3(profile3)

    # Mock base therapist lookup
    async def mock_get_base_therapist(db, therapist_id):
        if therapist_id == THERAPIST_ID:
            return {
                "therapist_id": str(THERAPIST_ID),
                "therapist_name": "Test Therapist",
                "photo_urls": base_therapist.photo_urls,
                "price_min": profile.price_min,
                "price_max": profile.price_max,
                "mood_tag": "relaxing",
                "style_tag": "gentle",
            }
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "Therapist not found",
                "reason_code": "therapist_not_found",
            },
        )

    # Mock pool fetch
    async def mock_fetch_similar_pool(db, exclude_id, limit):
        return [
            {
                "therapist_id": str(THERAPIST_ID_2),
                "therapist_name": "Therapist 2",
                "photo_urls": ["https://example.com/photo2.jpg"],
                "price_min": 8000,
                "price_max": 12000,
                "mood_tag": "relaxing",
                "style_tag": "gentle",
            },
            {
                "therapist_id": str(THERAPIST_ID_3),
                "therapist_name": "Therapist 3",
                "photo_urls": ["https://example.com/photo3.jpg"],
                "price_min": 15000,
                "price_max": 20000,
                "mood_tag": "energetic",
                "style_tag": "strong",
            },
        ]

    # Mock availability check
    async def mock_check_availability(db, therapist_id):
        return therapist_id == THERAPIST_ID_2  # Only therapist 2 is available today

    monkeypatch.setattr(domain, "_get_base_therapist", mock_get_base_therapist)
    monkeypatch.setattr(domain, "_fetch_similar_pool", mock_fetch_similar_pool)
    monkeypatch.setattr(domain, "_check_today_availability", mock_check_availability)

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}/similar")

    assert res.status_code == 200
    body = res.json()

    assert "therapists" in body
    assert len(body["therapists"]) == 2

    # Therapist 2 should be first (higher similarity score - same mood and style)
    t1 = body["therapists"][0]
    assert t1["id"] == str(THERAPIST_ID_2)
    assert t1["name"] == "Therapist 2"
    assert t1["available_today"] is True
    assert t1["similarity_score"] > 0

    # Therapist 3 should be second (lower similarity score - different mood and style)
    t2 = body["therapists"][1]
    assert t2["id"] == str(THERAPIST_ID_3)
    assert t2["available_today"] is False


def test_get_similar_therapists_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test 404 when base therapist not found."""
    from fastapi import HTTPException, status

    async def mock_get_base_therapist(db, therapist_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "Therapist not found",
                "reason_code": "therapist_not_found",
            },
        )

    monkeypatch.setattr(domain, "_get_base_therapist", mock_get_base_therapist)

    res = client.get(f"/api/v1/therapists/{uuid4()}/similar")

    assert res.status_code == 404
    body = res.json()
    assert body["detail"]["reason_code"] == "therapist_not_found"


def test_get_similar_therapists_empty_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test when no similar therapists found."""

    async def mock_get_base_therapist(db, therapist_id):
        return {
            "therapist_id": str(THERAPIST_ID),
            "therapist_name": "Test Therapist",
            "photo_urls": [],
            "price_min": 10000,
            "price_max": 15000,
            "mood_tag": None,
            "style_tag": None,
        }

    async def mock_fetch_similar_pool(db, exclude_id, limit):
        return []  # No candidates

    monkeypatch.setattr(domain, "_get_base_therapist", mock_get_base_therapist)
    monkeypatch.setattr(domain, "_fetch_similar_pool", mock_fetch_similar_pool)

    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}/similar")

    assert res.status_code == 200
    body = res.json()
    assert body["therapists"] == []


def test_get_similar_therapists_limit_param(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test limit parameter."""

    async def mock_get_base_therapist(db, therapist_id):
        return {
            "therapist_id": str(THERAPIST_ID),
            "therapist_name": "Test Therapist",
            "photo_urls": [],
            "price_min": 10000,
            "price_max": 15000,
            "mood_tag": "relaxing",
            "style_tag": "gentle",
        }

    async def mock_fetch_similar_pool(db, exclude_id, limit):
        return [
            {
                "therapist_id": str(uuid4()),
                "therapist_name": f"Therapist {i}",
                "photo_urls": [],
                "price_min": 10000,
                "price_max": 15000,
                "mood_tag": "relaxing",
                "style_tag": "gentle",
            }
            for i in range(10)
        ]

    async def mock_check_availability(db, therapist_id):
        return False

    monkeypatch.setattr(domain, "_get_base_therapist", mock_get_base_therapist)
    monkeypatch.setattr(domain, "_fetch_similar_pool", mock_fetch_similar_pool)
    monkeypatch.setattr(domain, "_check_today_availability", mock_check_availability)

    # Request with limit=3
    res = client.get(f"/api/v1/therapists/{THERAPIST_ID}/similar", params={"limit": 3})

    assert res.status_code == 200
    body = res.json()
    assert len(body["therapists"]) == 3


class TestSimilarityScoring:
    """Test similarity score calculation."""

    def test_match_score_equal(self):
        assert domain._match_score("relaxing", "relaxing") == 1.0

    def test_match_score_different(self):
        assert domain._match_score("relaxing", "energetic") == 0.3

    def test_match_score_none(self):
        assert domain._match_score(None, "relaxing") == 0.5
        assert domain._match_score("relaxing", None) == 0.5
        assert domain._match_score(None, None) == 0.5

    def test_list_overlap_full(self):
        assert domain._list_overlap(["a", "b"], ["a", "b"]) == 1.0

    def test_list_overlap_partial(self):
        score = domain._list_overlap(["a", "b", "c"], ["a", "d"])
        assert 0.3 < score < 0.5  # 1/3 overlap

    def test_list_overlap_none(self):
        assert domain._list_overlap(["a"], ["b"]) == 0.3

    def test_list_overlap_empty(self):
        assert domain._list_overlap(None, ["a"]) == 0.5
        assert domain._list_overlap(["a"], None) == 0.5

    def test_score_similarity(self):
        target = {
            "mood_tag": "relaxing",
            "talk_level": "quiet",
            "style_tag": "gentle",
            "look_type": "cute",
            "contact_style": "light",
            "hobby_tags": ["massage", "aroma"],
        }
        candidate = {
            "mood_tag": "relaxing",  # Match
            "talk_level": "quiet",  # Match
            "style_tag": "gentle",  # Match
            "look_type": "cute",  # Match
            "contact_style": "light",  # Match
            "hobby_tags": ["massage", "aroma"],  # Full match
        }

        score = domain._score_similarity(target, candidate)
        # All matches = 1.0 for each component
        # 0.25*1 + 0.2*1 + 0.2*1 + 0.15*1 + 0.1*1 + 0.1*1 = 1.0
        assert score == 1.0

    def test_score_similarity_no_match(self):
        target = {
            "mood_tag": "relaxing",
            "talk_level": "quiet",
            "style_tag": "gentle",
            "look_type": "cute",
            "contact_style": "light",
            "hobby_tags": ["massage"],
        }
        candidate = {
            "mood_tag": "energetic",  # No match
            "talk_level": "talkative",  # No match
            "style_tag": "strong",  # No match
            "look_type": "cool",  # No match
            "contact_style": "firm",  # No match
            "hobby_tags": ["sports"],  # No match
        }

        score = domain._score_similarity(target, candidate)
        # All 0.3 for mismatches
        # 0.25*0.3 + 0.2*0.3 + 0.2*0.3 + 0.15*0.3 + 0.1*0.3 + 0.1*0.3 = 0.3
        assert score == pytest.approx(0.3)


class TestTherapistTags:
    """Test therapist tags extraction in detail API."""

    def test_tags_extracted_from_therapist(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that tags are extracted from therapist model."""
        profile = _mock_profile()
        therapist = _mock_therapist(profile)
        # Add tag attributes to therapist
        therapist.mood_tag = "relaxing"
        therapist.style_tag = "gentle"
        therapist.look_type = "cute"
        therapist.contact_style = "soft"

        async def mock_fetch_with_profile(db, therapist_id):
            if therapist_id == THERAPIST_ID:
                return (therapist, profile)
            return None

        async def mock_build_slots(db, therapist_id, days, slot_granularity_minutes):
            return []

        monkeypatch.setattr(
            domain, "_fetch_therapist_with_profile", mock_fetch_with_profile
        )
        monkeypatch.setattr(domain, "_build_availability_slots", mock_build_slots)

        res = client.get(f"/api/v1/therapists/{THERAPIST_ID}")

        assert res.status_code == 200
        body = res.json()

        tags = body["therapist"]["tags"]
        assert tags["mood"] == "relaxing"
        assert tags["style"] == "gentle"
        assert tags["look"] == "cute"
        assert tags["contact"] == "soft"
        assert tags["hobby_tags"] == ["massage", "aroma"]

    def test_tags_fallback_to_profile(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test that tags fall back to profile when not on therapist."""
        profile = _mock_profile()
        # Add tag attributes to profile only
        profile.mood_tag = "energetic"
        profile.style_tag = "strong"
        profile.look_type = "cool"
        profile.contact_style = "firm"

        therapist = _mock_therapist(profile)
        # Therapist has no tag attributes

        async def mock_fetch_with_profile(db, therapist_id):
            if therapist_id == THERAPIST_ID:
                return (therapist, profile)
            return None

        async def mock_build_slots(db, therapist_id, days, slot_granularity_minutes):
            return []

        monkeypatch.setattr(
            domain, "_fetch_therapist_with_profile", mock_fetch_with_profile
        )
        monkeypatch.setattr(domain, "_build_availability_slots", mock_build_slots)

        res = client.get(f"/api/v1/therapists/{THERAPIST_ID}")

        assert res.status_code == 200
        body = res.json()

        tags = body["therapist"]["tags"]
        assert tags["mood"] == "energetic"
        assert tags["style"] == "strong"
        assert tags["look"] == "cool"
        assert tags["contact"] == "firm"

    def test_tags_none_when_not_available(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that tags are None when not available on therapist or profile."""
        profile = _mock_profile()
        therapist = _mock_therapist(profile)
        # Neither therapist nor profile has tag attributes

        async def mock_fetch_with_profile(db, therapist_id):
            if therapist_id == THERAPIST_ID:
                return (therapist, profile)
            return None

        async def mock_build_slots(db, therapist_id, days, slot_granularity_minutes):
            return []

        monkeypatch.setattr(
            domain, "_fetch_therapist_with_profile", mock_fetch_with_profile
        )
        monkeypatch.setattr(domain, "_build_availability_slots", mock_build_slots)

        res = client.get(f"/api/v1/therapists/{THERAPIST_ID}")

        assert res.status_code == 200
        body = res.json()

        tags = body["therapist"]["tags"]
        assert tags["mood"] is None
        assert tags["style"] is None
        assert tags["look"] is None
        assert tags["contact"] is None
        # hobby_tags should fallback to specialties
        assert tags["hobby_tags"] == ["massage", "aroma"]
