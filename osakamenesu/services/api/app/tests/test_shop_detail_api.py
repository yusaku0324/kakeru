"""Tests for Shop Detail API (GET /api/v1/shops/{shop_id})."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import get_session
from app.domains.site.services import shop_services


SHOP_ID = uuid4()
SHOP_SLUG = "test-shop"


class DummySession:
    pass


def setup_function() -> None:
    app.dependency_overrides[get_session] = lambda: DummySession()


def teardown_function() -> None:
    app.dependency_overrides.pop(get_session, None)


def _setup_mocks(
    monkeypatch: pytest.MonkeyPatch,
    mock_profile,
    mock_availability=None,
    mock_next_slot=None,
) -> None:
    """Set up common mocks for shop detail tests."""
    from uuid import UUID

    async def _mock_load_profile(db, identifier):
        if mock_profile is None:
            return None
        if isinstance(identifier, UUID):
            if identifier == mock_profile.id:
                return mock_profile
        else:
            try:
                if UUID(str(identifier)) == mock_profile.id:
                    return mock_profile
            except Exception:
                pass
            if str(identifier) == mock_profile.slug:
                return mock_profile
        return None

    async def _mock_fetch_availability(db, shop_id, **kwargs):
        return mock_availability

    async def _mock_get_next_available_slot(db, shop_id):
        return mock_next_slot

    monkeypatch.setattr(shop_services, "_load_profile", _mock_load_profile)
    monkeypatch.setattr(shop_services, "_fetch_availability", _mock_fetch_availability)
    monkeypatch.setattr(
        shop_services, "_get_next_available_slot", _mock_get_next_available_slot
    )


def _create_mock_profile(
    *,
    shop_id=SHOP_ID,
    slug=SHOP_SLUG,
    status="published",
    with_reviews: bool = False,
    with_therapists: bool = False,
    with_diaries: bool = False,
    contact_json: dict | None = None,
) -> SimpleNamespace:
    """Create a mock profile for testing."""
    reviews = []
    if with_reviews:
        reviews = [
            SimpleNamespace(
                id=uuid4(),
                profile_id=shop_id,
                status="published",
                score=4,
                title="Great service",
                body="Loved it!",
                author_alias="User1",
                visited_at=date.today() - timedelta(days=5),
                created_at=datetime.now(),
                updated_at=datetime.now(),
                aspect_scores={"therapist_service": {"score": 4}},
            )
        ]

    therapists = []
    if with_therapists:
        therapists = [
            SimpleNamespace(
                id=uuid4(),
                name="Test Therapist",
                alias="tt",
                photo_urls=["https://example.com/photo.jpg"],
                headline="Expert massage therapist",
                specialties=["massage", "aroma"],
                status="published",
            )
        ]

    diaries = []
    if with_diaries:
        diaries = [
            SimpleNamespace(
                id=uuid4(),
                title="Today's diary",
                text="Great day!",
                photos=["https://example.com/diary1.jpg"],
                hashtags=["relax"],
                status="published",
                created_at=datetime.now(),
            )
        ]

    return SimpleNamespace(
        id=shop_id,
        slug=slug,
        name="Test Shop",
        area="tokyo",
        price_min=10000,
        price_max=15000,
        status=status,
        latitude=35.6895,
        longitude=139.6917,
        nearest_station="Shibuya",
        station_line="JR Yamanote",
        station_exit="Hachiko",
        station_walk_minutes=5,
        address="1-2-3 Shibuya",
        photos=["https://example.com/shop1.jpg", "https://example.com/shop2.jpg"],
        body_tags=["massage", "relaxation"],
        ranking_badges=["top_rated"],
        discounts=[{"label": "10% off", "description": "Weekday special"}],
        contact_json=contact_json
        or {
            "phone": "03-1234-5678",
            "line_id": "testshop",
            "website_url": "https://example.com",
        },
        description="A relaxing massage shop in Shibuya",
        reviews=reviews,
        therapists=therapists,
        diaries=diaries,
        updated_at=datetime.now(),
    )


client = TestClient(app)


# ---- Test cases for GET /api/v1/shops/{shop_id} ----


def test_get_shop_detail_by_uuid_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test successful shop detail fetch by UUID."""
    profile = _create_mock_profile(
        with_reviews=True, with_therapists=True, with_diaries=True
    )
    _setup_mocks(monkeypatch, profile)

    res = client.get(f"/api/v1/shops/{SHOP_ID}")

    assert res.status_code == 200
    body = res.json()

    # Check basic shop info
    assert body["id"] == str(SHOP_ID)
    assert body["slug"] == SHOP_SLUG
    assert body["name"] == "Test Shop"
    assert body["area"] == "tokyo"
    assert body["min_price"] == 10000
    assert body["max_price"] == 15000

    # Check location info
    assert body["latitude"] == 35.6895
    assert body["longitude"] == 139.6917
    assert body["nearest_station"] == "Shibuya"
    assert body["station_line"] == "JR Yamanote"

    # Check contact info
    assert body["contact"] is not None
    assert body["contact"]["phone"] == "03-1234-5678"
    assert body["contact"]["line_id"] == "testshop"

    # Check photos
    assert len(body["photos"]) == 2
    assert body["photos"][0]["url"] == "https://example.com/shop1.jpg"

    # Check staff list
    assert len(body["staff"]) == 1
    assert body["staff"][0]["name"] == "Test Therapist"

    # Check diaries
    assert len(body["diaries"]) == 1
    assert body["diaries"][0]["title"] == "Today's diary"

    # Check badges and promotions
    assert "top_rated" in body["badges"]


def test_get_shop_detail_by_slug_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test successful shop detail fetch by slug."""
    profile = _create_mock_profile()
    _setup_mocks(monkeypatch, profile)

    res = client.get(f"/api/v1/shops/{SHOP_SLUG}")

    assert res.status_code == 200
    body = res.json()

    assert body["id"] == str(SHOP_ID)
    assert body["slug"] == SHOP_SLUG
    assert body["name"] == "Test Shop"


def test_get_shop_detail_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test 404 when shop does not exist."""
    _setup_mocks(monkeypatch, None)

    non_existent_id = uuid4()
    res = client.get(f"/api/v1/shops/{non_existent_id}")

    assert res.status_code == 404
    assert "shop not found" in res.json()["detail"].lower()


def test_get_shop_detail_draft_shop_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that draft/unpublished shops return 404."""
    # _load_profile filters by status='published', so draft shops return None
    _setup_mocks(monkeypatch, None)

    res = client.get(f"/api/v1/shops/{SHOP_ID}")

    assert res.status_code == 404


def test_get_shop_detail_without_contact_info(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test shop detail when contact_json has no meaningful values."""
    # Only set contact_json with no phone, line, or other contactable info
    profile = _create_mock_profile(contact_json={"store_name": "Test Store"})
    _setup_mocks(monkeypatch, profile)

    res = client.get(f"/api/v1/shops/{SHOP_ID}")

    assert res.status_code == 200
    body = res.json()
    # When contact_json has no phone/line/website/sns, contact should be None
    assert body["contact"] is None


def test_get_shop_detail_without_photos(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test shop detail when no photos are available."""
    profile = _create_mock_profile()
    profile.photos = []
    _setup_mocks(monkeypatch, profile)

    res = client.get(f"/api/v1/shops/{SHOP_ID}")

    assert res.status_code == 200
    body = res.json()
    assert body["photos"] == []
    assert body["lead_image_url"] is None


def test_get_shop_detail_excludes_unpublished_therapists(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test that unpublished therapists are excluded from staff list."""
    profile = _create_mock_profile()
    profile.therapists = [
        SimpleNamespace(
            id=uuid4(),
            name="Published Therapist",
            alias="pt",
            photo_urls=["https://example.com/pt.jpg"],
            headline="Published",
            specialties=["massage"],
            status="published",
        ),
        SimpleNamespace(
            id=uuid4(),
            name="Draft Therapist",
            alias="dt",
            photo_urls=["https://example.com/dt.jpg"],
            headline="Draft",
            specialties=["massage"],
            status="draft",
        ),
    ]
    _setup_mocks(monkeypatch, profile)

    res = client.get(f"/api/v1/shops/{SHOP_ID}")

    assert res.status_code == 200
    body = res.json()
    assert len(body["staff"]) == 1
    assert body["staff"][0]["name"] == "Published Therapist"


def test_get_shop_detail_excludes_unpublished_diaries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test that unpublished diaries are excluded from diaries list."""
    profile = _create_mock_profile()
    profile.diaries = [
        SimpleNamespace(
            id=uuid4(),
            title="Published Diary",
            text="Published content",
            photos=[],
            hashtags=[],
            status="published",
            created_at=datetime.now(),
        ),
        SimpleNamespace(
            id=uuid4(),
            title="Draft Diary",
            text="Draft content",
            photos=[],
            hashtags=[],
            status="draft",
            created_at=datetime.now(),
        ),
    ]
    _setup_mocks(monkeypatch, profile)

    res = client.get(f"/api/v1/shops/{SHOP_ID}")

    assert res.status_code == 200
    body = res.json()
    assert len(body["diaries"]) == 1
    assert body["diaries"][0]["title"] == "Published Diary"


def test_get_shop_detail_promotions(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that promotions/discounts are correctly serialized."""
    profile = _create_mock_profile()
    profile.discounts = [
        {"label": "Weekend Special", "description": "20% off on weekends"},
        {"label": "First Visit", "description": "Free gift for first-time visitors"},
    ]
    _setup_mocks(monkeypatch, profile)

    res = client.get(f"/api/v1/shops/{SHOP_ID}")

    assert res.status_code == 200
    body = res.json()
    assert body["has_promotions"] is True
    assert body["has_discounts"] is True
    assert body["promotion_count"] == 2


def test_get_shop_detail_with_availability(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test shop detail with availability calendar data."""
    from app.schemas import (
        AvailabilityCalendar,
        AvailabilityDay,
        AvailabilitySlot,
        NextAvailableSlot,
    )

    profile = _create_mock_profile()
    today = date.today()
    now = datetime.now()

    mock_calendar = AvailabilityCalendar(
        shop_id=SHOP_ID,
        generated_at=now,
        days=[
            AvailabilityDay(
                date=today,
                slots=[
                    AvailabilitySlot(
                        start_at=datetime.combine(
                            today, datetime.strptime("10:00", "%H:%M").time()
                        ),
                        end_at=datetime.combine(
                            today, datetime.strptime("11:00", "%H:%M").time()
                        ),
                        status="open",
                    ),
                    AvailabilitySlot(
                        start_at=datetime.combine(
                            today, datetime.strptime("11:00", "%H:%M").time()
                        ),
                        end_at=datetime.combine(
                            today, datetime.strptime("12:00", "%H:%M").time()
                        ),
                        status="blocked",
                    ),
                ],
            )
        ],
    )

    mock_next_slot = NextAvailableSlot(
        start_at=now + timedelta(hours=2),
        status="ok",
    )

    _setup_mocks(
        monkeypatch,
        profile,
        mock_availability=mock_calendar,
        mock_next_slot=mock_next_slot,
    )

    res = client.get(f"/api/v1/shops/{SHOP_ID}")

    assert res.status_code == 200
    body = res.json()
    assert body["today_available"] is True
    assert body["next_available_at"] is not None


def test_get_shop_detail_with_sns_contacts(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test shop detail with SNS contact information."""
    profile = _create_mock_profile(
        contact_json={
            "phone": "03-1234-5678",
            "sns": [
                {"platform": "twitter", "url": "https://twitter.com/testshop"},
                {"platform": "instagram", "url": "https://instagram.com/testshop"},
            ],
        }
    )
    _setup_mocks(monkeypatch, profile)

    res = client.get(f"/api/v1/shops/{SHOP_ID}")

    assert res.status_code == 200
    body = res.json()
    assert body["contact"] is not None
    assert len(body["contact"]["sns"]) == 2
    assert body["contact"]["sns"][0]["platform"] == "twitter"


def test_get_shop_detail_staff_has_recommended_score(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test that staff members in shop detail include recommended_score."""
    profile = _create_mock_profile()
    # Add therapists with attributes needed for scoring
    profile.therapists = [
        SimpleNamespace(
            id=uuid4(),
            name="Scored Therapist",
            alias="st",
            photo_urls=["https://example.com/st.jpg"],
            headline="Expert therapist",
            specialties=["massage", "aroma"],
            status="published",
            look_type="cute",
            talk_level="moderate",
            style_tag="soft",
            mood_tag="healing",
            price_rank=2,
        ),
    ]
    _setup_mocks(monkeypatch, profile)

    res = client.get(f"/api/v1/shops/{SHOP_ID}")

    assert res.status_code == 200
    body = res.json()
    assert len(body["staff"]) == 1
    staff = body["staff"][0]
    assert "recommended_score" in staff
    # Score should be a float between 0 and 1
    assert staff["recommended_score"] is not None
    assert 0 <= staff["recommended_score"] <= 1


def test_get_shop_detail_staff_sorted_by_recommended_score(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test that staff members are sorted by recommended_score descending."""
    profile = _create_mock_profile()
    # Add multiple therapists with different attributes that affect scoring
    profile.therapists = [
        SimpleNamespace(
            id=uuid4(),
            name="Low Score Therapist",
            alias="ls",
            photo_urls=[],
            headline=None,
            specialties=[],  # No tag overlap
            status="published",
            look_type=None,
            talk_level=None,
            style_tag=None,
            mood_tag=None,
            price_rank=None,
        ),
        SimpleNamespace(
            id=uuid4(),
            name="High Score Therapist",
            alias="hs",
            photo_urls=["https://example.com/hs.jpg"],
            headline="Expert therapist",
            specialties=["massage", "relaxation"],  # Tag overlap with profile body_tags
            status="published",
            look_type="cute",
            talk_level="moderate",
            style_tag="soft",
            mood_tag="healing",
            price_rank=3,
        ),
        SimpleNamespace(
            id=uuid4(),
            name="Medium Score Therapist",
            alias="ms",
            photo_urls=["https://example.com/ms.jpg"],
            headline="Good therapist",
            specialties=["massage"],  # Partial tag overlap
            status="published",
            look_type=None,
            talk_level=None,
            style_tag="soft",
            mood_tag=None,
            price_rank=2,
        ),
    ]
    _setup_mocks(monkeypatch, profile)

    res = client.get(f"/api/v1/shops/{SHOP_ID}")

    assert res.status_code == 200
    body = res.json()
    assert len(body["staff"]) == 3

    # Extract scores
    scores = [s["recommended_score"] for s in body["staff"]]

    # Verify sorted in descending order
    assert scores == sorted(scores, reverse=True), (
        f"Staff should be sorted by recommended_score descending. "
        f"Got: {[(s['name'], s['recommended_score']) for s in body['staff']]}"
    )

    # Verify high score therapist is first
    assert body["staff"][0]["name"] == "High Score Therapist", (
        f"Expected 'High Score Therapist' first, got: {body['staff'][0]['name']}"
    )


# ---- Test cases for staff tags in shop detail ----


class TestStaffTags:
    """Test suite for staff tags in shop detail response."""

    def test_staff_tags_from_therapist(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test that staff tags are extracted from therapist attributes."""
        profile = _create_mock_profile()
        profile.therapists = [
            SimpleNamespace(
                id=uuid4(),
                name="Tagged Therapist",
                alias="tt",
                photo_urls=["https://example.com/tt.jpg"],
                headline="Expert therapist",
                specialties=["massage", "aroma"],
                status="published",
                mood_tag="healing",
                style_tag="soft",
                look_type="cute",
                contact_style="friendly",
                hobby_tags=["reading", "music"],
            ),
        ]
        _setup_mocks(monkeypatch, profile)

        res = client.get(f"/api/v1/shops/{SHOP_ID}")

        assert res.status_code == 200
        body = res.json()
        assert len(body["staff"]) == 1
        staff = body["staff"][0]
        assert staff["tags"] is not None
        assert staff["tags"]["mood"] == "healing"
        assert staff["tags"]["style"] == "soft"
        assert staff["tags"]["look"] == "cute"
        assert staff["tags"]["contact"] == "friendly"
        assert staff["tags"]["hobby_tags"] == ["reading", "music"]

    def test_staff_tags_fallback_to_specialties(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that hobby_tags falls back to specialties when not present."""
        profile = _create_mock_profile()
        profile.therapists = [
            SimpleNamespace(
                id=uuid4(),
                name="Basic Therapist",
                alias="bt",
                photo_urls=["https://example.com/bt.jpg"],
                headline="Basic therapist",
                specialties=["massage", "relaxation"],
                status="published",
                mood_tag="relaxing",
            ),
        ]
        _setup_mocks(monkeypatch, profile)

        res = client.get(f"/api/v1/shops/{SHOP_ID}")

        assert res.status_code == 200
        body = res.json()
        assert len(body["staff"]) == 1
        staff = body["staff"][0]
        assert staff["tags"] is not None
        assert staff["tags"]["mood"] == "relaxing"
        # hobby_tags should fall back to specialties
        assert staff["tags"]["hobby_tags"] == ["massage", "relaxation"]

    def test_staff_tags_none_when_no_tags(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that tags field is None when therapist has no tag attributes."""
        profile = _create_mock_profile()
        profile.therapists = [
            SimpleNamespace(
                id=uuid4(),
                name="No Tags Therapist",
                alias="nt",
                photo_urls=["https://example.com/nt.jpg"],
                headline="Plain therapist",
                specialties=[],  # Empty specialties
                status="published",
                # No tag attributes at all
            ),
        ]
        # Also remove body_tags from profile to prevent fallback
        profile.body_tags = []
        _setup_mocks(monkeypatch, profile)

        res = client.get(f"/api/v1/shops/{SHOP_ID}")

        assert res.status_code == 200
        body = res.json()
        assert len(body["staff"]) == 1
        staff = body["staff"][0]
        assert staff["tags"] is None
