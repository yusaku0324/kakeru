"""Tests for Shop Search API (GET /api/v1/shops)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import get_session
from app.domains.site import therapist_availability as therapist_availability_domain
from app.domains.site.services.shop import search_service
from app.schemas import NextAvailableSlot
from app.utils.datetime import JST


SHOP_ID_1 = str(uuid4())
SHOP_ID_2 = str(uuid4())


class DummySession:
    """Dummy session that raises errors for any database operations."""

    async def execute(self, *args, **kwargs):
        raise Exception("DummySession does not support database operations")

    async def scalar(self, *args, **kwargs):
        raise Exception("DummySession does not support database operations")


def setup_function() -> None:
    app.dependency_overrides[get_session] = lambda: DummySession()


def teardown_function() -> None:
    app.dependency_overrides.pop(get_session, None)


def _create_mock_meili_response(
    hits: list[dict[str, Any]] | None = None,
    total: int | None = None,
    facets: dict[str, dict[str, int]] | None = None,
) -> dict[str, Any]:
    """Create a mock Meilisearch response."""
    hits = hits or []
    return {
        "hits": hits,
        "estimatedTotalHits": total if total is not None else len(hits),
        "facetDistribution": facets or {},
    }


def _create_mock_shop_doc(
    *,
    shop_id: str | None = None,
    slug: str = "test-shop",
    name: str = "Test Shop",
    area: str = "tokyo",
    price_min: int = 10000,
    price_max: int = 15000,
    nearest_station: str | None = "Shibuya",
    station_line: str | None = "JR Yamanote",
    rating: float | None = None,
    review_score: float | None = None,
    review_count: int | None = None,
    today: bool | None = None,
    photos: list[str] | None = None,
    body_tags: list[str] | None = None,
    ranking_badges: list[str] | None = None,
    has_promotions: bool | None = None,
    has_discounts: bool | None = None,
    promotions: list[dict] | None = None,
    staff_preview: list[dict] | None = None,
    price_band: str | None = None,
    ranking_score: float | None = None,
    updated_at: int | None = None,
) -> dict[str, Any]:
    """Create a mock shop document as Meilisearch returns."""
    return {
        "id": shop_id or str(uuid4()),
        "slug": slug,
        "name": name,
        "area": area,
        "price_min": price_min,
        "price_max": price_max,
        "nearest_station": nearest_station,
        "station_line": station_line,
        "rating": rating,
        "review_score": review_score,
        "review_count": review_count,
        "today": today,
        "photos": photos or [],
        "body_tags": body_tags or [],
        "ranking_badges": ranking_badges or [],
        "has_promotions": has_promotions,
        "has_discounts": has_discounts,
        "promotions": promotions or [],
        "staff_preview": staff_preview,
        "price_band": price_band,
        "ranking_score": ranking_score,
        "updated_at": updated_at or int(datetime.now().timestamp()),
    }


def _setup_mocks(
    monkeypatch: pytest.MonkeyPatch,
    meili_response: dict[str, Any] | Exception,
    mock_staff_next: dict[UUID, tuple[bool, NextAvailableSlot | None]] | None = None,
) -> None:
    """Set up common mocks for shop search tests."""

    def _mock_meili_search(
        q: str | None,
        filter_expr: str | None,
        sort: list[str] | str | None,
        page: int,
        page_size: int,
        facets: list[str] | None = None,
    ) -> dict[str, Any]:
        # The actual meili_search returns Exception objects instead of raising
        return meili_response

    async def _mock_derive_next_availability_from_slots_sot(
        db, therapist_ids, *, lookahead_days: int = 14
    ):
        return mock_staff_next or {}

    monkeypatch.setattr(search_service, "meili_search", _mock_meili_search)
    monkeypatch.setattr(
        search_service,
        "_derive_next_availability_from_slots_sot",
        _mock_derive_next_availability_from_slots_sot,
    )


client = TestClient(app)


# ---- Test cases for GET /api/v1/shops ----


def test_search_shops_empty_results(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with no results."""
    _setup_mocks(monkeypatch, _create_mock_meili_response())

    res = client.get("/api/v1/shops")

    assert res.status_code == 200
    body = res.json()
    assert body["page"] == 1
    assert body["page_size"] == 12
    assert body["total"] == 0
    assert body["results"] == []


def test_search_shops_with_results(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search returning shop results."""
    shop_doc = _create_mock_shop_doc(
        shop_id=SHOP_ID_1,
        slug="shibuya-relax",
        name="Shibuya Relaxation",
        area="tokyo",
        price_min=8000,
        price_max=12000,
        nearest_station="Shibuya",
        review_score=4.5,
        review_count=120,
        today=True,
        photos=["https://example.com/photo1.jpg"],
        body_tags=["massage", "aroma"],
        ranking_badges=["top_rated"],
    )
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert len(body["results"]) == 1

    shop = body["results"][0]
    assert shop["id"] == SHOP_ID_1
    assert shop["slug"] == "shibuya-relax"
    assert shop["name"] == "Shibuya Relaxation"
    assert shop["area"] == "tokyo"
    assert shop["min_price"] == 8000
    assert shop["max_price"] == 12000
    assert shop["nearest_station"] == "Shibuya"
    assert shop["rating"] == 4.5
    assert shop["review_count"] == 120
    assert shop["today_available"] is True
    assert shop["lead_image_url"] == "https://example.com/photo1.jpg"
    assert "massage" in shop["service_tags"]
    assert "top_rated" in shop["badges"]


def test_search_shops_staff_preview_clears_stale_next_available_at(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    therapist_id = uuid4()
    shop_doc = _create_mock_shop_doc(
        shop_id=SHOP_ID_1,
        today=True,
        staff_preview=[
            {
                "id": str(therapist_id),
                "name": "ももな",
                "today_available": True,
                "next_available_at": "2025-12-13T05:50:21.440867+00:00",
            }
        ],
    )
    _setup_mocks(
        monkeypatch,
        _create_mock_meili_response([shop_doc], total=1),
        mock_staff_next={therapist_id: (False, None)},
    )

    res = client.get("/api/v1/shops?q=momona")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    shop = body["results"][0]
    staff = shop["staff_preview"][0]

    assert staff["today_available"] is False
    assert staff["next_available_at"] is None
    assert staff["next_available_slot"] is None
    # Shop-level availability is derived from staff preview when present.
    assert shop["today_available"] is False
    assert shop["next_available_at"] is None


def test_search_shops_staff_preview_derives_next_available_at_from_sot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    therapist_id = uuid4()
    next_start = datetime(2025, 1, 2, 10, 0, tzinfo=timezone.utc)
    next_end = datetime(2025, 1, 2, 12, 0, tzinfo=timezone.utc)
    shop_doc = _create_mock_shop_doc(
        shop_id=SHOP_ID_1,
        today=False,
        staff_preview=[
            {
                "id": str(therapist_id),
                "name": "ももな",
                "today_available": False,
                "next_available_at": "2025-01-01T00:00:00+00:00",  # stale / must be overwritten
            }
        ],
    )
    _setup_mocks(
        monkeypatch,
        _create_mock_meili_response([shop_doc], total=1),
        mock_staff_next={
            therapist_id: (
                True,
                NextAvailableSlot(
                    start_at=next_start,
                    end_at=next_end,
                    status="ok",
                ),
            )
        },
    )

    res = client.get("/api/v1/shops?q=momona")

    assert res.status_code == 200
    shop = res.json()["results"][0]
    staff = shop["staff_preview"][0]

    assert staff["today_available"] is True
    assert staff["next_available_at"].startswith("2025-01-02T10:00:00")
    assert staff["next_available_slot"]["start_at"].startswith("2025-01-02T10:00:00")
    assert staff["next_available_slot"]["end_at"].startswith("2025-01-02T12:00:00")
    # next_available_at must correspond to next_available_slot.start_at
    assert staff["next_available_at"] == staff["next_available_slot"]["start_at"]


def test_search_shops_next_available_at_matches_guest_availability_sot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Invariant: next_available_at must imply has_available and match earliest slot start."""
    therapist_id = uuid4()
    target_day = date(2025, 1, 10)
    shift_start = datetime.combine(
        target_day, datetime.min.time(), tzinfo=JST
    ) + timedelta(hours=10)
    shift_end = shift_start + timedelta(hours=2)
    shift = SimpleNamespace(
        therapist_id=therapist_id,
        date=target_day,
        start_at=shift_start,
        end_at=shift_end,
        break_slots=[],
        availability_status="available",
    )

    async def fake_fetch_therapist_with_buffer(db, therapist_id_arg):
        assert therapist_id_arg == therapist_id
        return None, 0, None

    async def fake_fetch_shifts(db, therapist_id_arg, date_from, date_to):
        assert therapist_id_arg == therapist_id
        assert date_from == target_day
        assert date_to == target_day
        return [shift]

    async def fake_fetch_reservations(db, therapist_id_arg, start_at, end_at):
        assert therapist_id_arg == therapist_id
        return []

    monkeypatch.setattr(
        therapist_availability_domain,
        "_fetch_therapist_with_buffer",
        fake_fetch_therapist_with_buffer,
    )
    monkeypatch.setattr(
        therapist_availability_domain, "_fetch_shifts", fake_fetch_shifts
    )
    monkeypatch.setattr(
        therapist_availability_domain, "_fetch_reservations", fake_fetch_reservations
    )

    intervals = therapist_availability_domain._calculate_available_slots([shift], [], 0)
    filtered = therapist_availability_domain._filter_slots_by_date(
        intervals, target_day
    )
    assert filtered
    expected_start, expected_end = filtered[0]

    shop_doc = _create_mock_shop_doc(
        shop_id=SHOP_ID_1,
        today=False,
        staff_preview=[
            {
                "id": str(therapist_id),
                "name": "ももな",
                "today_available": False,
                "next_available_at": "2025-01-01T00:00:00+00:00",  # stale / must be overwritten
            }
        ],
    )
    _setup_mocks(
        monkeypatch,
        _create_mock_meili_response([shop_doc], total=1),
        mock_staff_next={
            therapist_id: (
                False,
                NextAvailableSlot(
                    start_at=expected_start,
                    end_at=expected_end,
                    status="ok",
                ),
            )
        },
    )

    # 1) shop search provides next_available_at
    res = client.get("/api/v1/shops?q=momona")
    assert res.status_code == 200
    staff = res.json()["results"][0]["staff_preview"][0]
    next_available_at_raw = staff["next_available_at"]
    assert next_available_at_raw is not None

    next_dt = datetime.fromisoformat(next_available_at_raw.replace("Z", "+00:00"))
    date_jst = next_dt.astimezone(JST).date()

    # 2) guest availability_summary must have has_available=true on that date
    summary = client.get(
        f"/api/guest/therapists/{therapist_id}/availability_summary",
        params={"date_from": str(date_jst), "date_to": str(date_jst)},
    )
    assert summary.status_code == 200
    assert summary.json()["items"][0]["has_available"] is True

    # 3) guest availability_slots earliest start must equal next_available_at
    slots = client.get(
        f"/api/guest/therapists/{therapist_id}/availability_slots",
        params={"date": str(date_jst)},
    )
    assert slots.status_code == 200
    earliest_start_raw = slots.json()["slots"][0]["start_at"]
    earliest_start_dt = datetime.fromisoformat(
        earliest_start_raw.replace("Z", "+00:00")
    )
    assert earliest_start_dt == next_dt


def test_search_shops_with_query(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with text query parameter."""
    shop_doc = _create_mock_shop_doc(name="Aroma Paradise")
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?q=aroma")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["results"][0]["name"] == "Aroma Paradise"


def test_search_shops_with_area_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with area filter."""
    shop_doc = _create_mock_shop_doc(area="osaka")
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?area=osaka")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["results"][0]["area"] == "osaka"


def test_search_shops_with_station_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with nearest station filter."""
    shop_doc = _create_mock_shop_doc(nearest_station="Umeda")
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?station=Umeda")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["results"][0]["nearest_station"] == "Umeda"


def test_search_shops_with_price_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with price range filters."""
    shop_doc = _create_mock_shop_doc(price_min=5000, price_max=10000)
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?price_min=3000&price_max=15000")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["results"][0]["min_price"] == 5000
    assert body["results"][0]["max_price"] == 10000


def test_search_shops_with_price_band_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with price band filter."""
    shop_doc = _create_mock_shop_doc(price_band="budget")
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?price_band=budget")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["results"][0]["price_band"] == "budget"


def test_search_shops_with_open_now_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with open_now filter."""
    shop_doc = _create_mock_shop_doc(today=True)
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?open_now=true")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["results"][0]["today_available"] is True


def test_search_shops_with_promotions_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with promotions_only filter."""
    shop_doc = _create_mock_shop_doc(has_promotions=True)
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?promotions_only=true")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["results"][0]["has_promotions"] is True


def test_search_shops_with_discounts_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with discounts_only filter."""
    shop_doc = _create_mock_shop_doc(has_discounts=True)
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?discounts_only=true")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["results"][0]["has_discounts"] is True


def test_search_shops_with_pagination(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with pagination parameters."""
    shop_docs = [_create_mock_shop_doc(name=f"Shop {i}") for i in range(5)]
    _setup_mocks(monkeypatch, _create_mock_meili_response(shop_docs, total=50))

    res = client.get("/api/v1/shops?page=2&page_size=5")

    assert res.status_code == 200
    body = res.json()
    assert body["page"] == 2
    assert body["page_size"] == 5
    assert body["total"] == 50
    assert len(body["results"]) == 5


def test_search_shops_with_sort_recommended(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with recommended sort."""
    shop_doc = _create_mock_shop_doc(ranking_score=0.95)
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?sort=recommended")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1


def test_search_shops_with_sort_price_asc(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with price ascending sort."""
    shop_docs = [
        _create_mock_shop_doc(name="Cheap Shop", price_min=3000),
        _create_mock_shop_doc(name="Expensive Shop", price_min=15000),
    ]
    _setup_mocks(monkeypatch, _create_mock_meili_response(shop_docs, total=2))

    res = client.get("/api/v1/shops?sort=price_asc")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2


def test_search_shops_with_sort_price_desc(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with price descending sort."""
    shop_docs = [
        _create_mock_shop_doc(name="Expensive Shop", price_min=15000),
        _create_mock_shop_doc(name="Cheap Shop", price_min=3000),
    ]
    _setup_mocks(monkeypatch, _create_mock_meili_response(shop_docs, total=2))

    res = client.get("/api/v1/shops?sort=price_desc")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2


def test_search_shops_with_sort_rating(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with rating sort."""
    shop_docs = [
        _create_mock_shop_doc(name="Top Rated", review_score=4.9, review_count=200),
        _create_mock_shop_doc(name="Average", review_score=3.5, review_count=50),
    ]
    _setup_mocks(monkeypatch, _create_mock_meili_response(shop_docs, total=2))

    res = client.get("/api/v1/shops?sort=rating")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2


def test_search_shops_with_service_tags(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with service tags filter."""
    shop_doc = _create_mock_shop_doc(body_tags=["massage", "oil"])
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?service_tags=massage,oil")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert "massage" in body["results"][0]["service_tags"]


def test_search_shops_with_category_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with category (service_type) filter."""
    shop_doc = _create_mock_shop_doc()
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?category=store")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1


def test_search_shops_with_diaries_only_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with diaries_only filter."""
    shop_doc = _create_mock_shop_doc()
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?diaries_only=true")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1


def test_search_shops_with_bust_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with bust size filter range."""
    shop_doc = _create_mock_shop_doc()
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?bust_min=C&bust_max=E")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1


def test_search_shops_with_age_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with age filter range."""
    shop_doc = _create_mock_shop_doc()
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?age_min=20&age_max=30")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1


def test_search_shops_with_height_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with height filter range."""
    shop_doc = _create_mock_shop_doc()
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?height_min=155&height_max=170")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1


def test_search_shops_with_style_filters(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with hair color, hair style, and body shape filters."""
    shop_doc = _create_mock_shop_doc()
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?hair_color=black&hair_style=long&body_shape=slim")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1


def test_search_shops_with_ranking_badges_filter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test search with ranking badges filter."""
    shop_doc = _create_mock_shop_doc(ranking_badges=["new_open", "pickup"])
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?ranking_badges_param=new_open,pickup")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1


def test_search_shops_returns_facets(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search returns facet distribution."""
    facets = {
        "area": {"tokyo": 10, "osaka": 5},
        "price_band": {"budget": 8, "standard": 7},
        "has_promotions": {"true": 6},
    }
    _setup_mocks(monkeypatch, _create_mock_meili_response([], total=15, facets=facets))

    res = client.get("/api/v1/shops")

    assert res.status_code == 200
    body = res.json()
    assert "facets" in body
    assert "area" in body["facets"]
    assert "price_band" in body["facets"]


def test_search_shops_with_multiple_results(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with multiple shop results."""
    shop_docs = [
        _create_mock_shop_doc(shop_id=SHOP_ID_1, name="Shop 1", area="tokyo"),
        _create_mock_shop_doc(shop_id=SHOP_ID_2, name="Shop 2", area="osaka"),
    ]
    _setup_mocks(monkeypatch, _create_mock_meili_response(shop_docs, total=2))

    res = client.get("/api/v1/shops")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2
    assert len(body["results"]) == 2
    assert body["results"][0]["name"] == "Shop 1"
    assert body["results"][1]["name"] == "Shop 2"


def test_search_shops_meilisearch_error_returns_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test that Meilisearch errors return empty results gracefully."""
    _setup_mocks(monkeypatch, Exception("Meilisearch connection failed"))

    res = client.get("/api/v1/shops")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 0
    assert body["results"] == []


def test_search_shops_with_staff_preview(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search returns staff preview when available."""
    staff_preview = [
        {
            "id": str(uuid4()),
            "name": "Yuki",
            "alias": "yuki",
            "headline": "Expert therapist",
            "rating": 4.8,
            "review_count": 50,
            "avatar_url": "https://example.com/yuki.jpg",
            "specialties": ["massage", "aroma"],
        }
    ]
    shop_doc = _create_mock_shop_doc(staff_preview=staff_preview)
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops")

    assert res.status_code == 200
    body = res.json()
    assert len(body["results"][0]["staff_preview"]) == 1
    assert body["results"][0]["staff_preview"][0]["name"] == "Yuki"


def test_search_shops_with_promotions_data(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search returns promotions data correctly."""
    promotions = [
        {"label": "Weekend Special", "description": "20% off"},
        {"label": "First Visit", "description": "Free gift"},
    ]
    shop_doc = _create_mock_shop_doc(
        has_promotions=True,
        promotions=promotions,
    )
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops")

    assert res.status_code == 200
    body = res.json()
    shop = body["results"][0]
    assert shop["has_promotions"] is True
    assert len(shop["promotions"]) == 2
    assert shop["promotions"][0]["label"] == "Weekend Special"


def test_search_shops_combined_filters(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search with multiple filters combined."""
    shop_doc = _create_mock_shop_doc(
        area="tokyo",
        price_min=5000,
        price_max=10000,
        today=True,
        has_promotions=True,
        ranking_badges=["pickup"],
    )
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get(
        "/api/v1/shops"
        "?area=tokyo"
        "&price_min=3000"
        "&price_max=15000"
        "&open_now=true"
        "&promotions_only=true"
        "&ranking_badges_param=pickup"
        "&sort=recommended"
    )

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1


def test_search_shops_page_size_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search respects page_size limit validation."""
    shop_doc = _create_mock_shop_doc()
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    # page_size > 50 should fail validation
    res = client.get("/api/v1/shops?page_size=100")

    assert res.status_code == 422  # Validation error


def test_search_shops_page_must_be_positive(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test search validates page must be >= 1."""
    shop_doc = _create_mock_shop_doc()
    _setup_mocks(monkeypatch, _create_mock_meili_response([shop_doc], total=1))

    res = client.get("/api/v1/shops?page=0")

    assert res.status_code == 422  # Validation error
