"""Tests for dashboard review management endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import get_session
from app.deps import require_dashboard_user
from app import models


class DummyUser:
    """Minimal user stub for dashboard auth."""

    def __init__(self):
        self.id = uuid4()
        self.email = "shop@example.com"
        self.role = "dashboard"


class DummyProfile:
    """Minimal profile stub."""

    def __init__(self, profile_id=None):
        self.id = profile_id or uuid4()
        self.name = "Test Shop"


class DummyReview:
    """Minimal review stub."""

    def __init__(self, profile_id, status="pending"):
        now = datetime.now(timezone.utc)
        self.id = uuid4()
        self.profile_id = profile_id
        self.status = status
        self.score = 4
        self.title = "Great service"
        self.body = "Really enjoyed my visit"
        self.author_alias = "Anonymous"
        self.visited_at = None
        self.created_at = now
        self.updated_at = now
        self.aspect_scores = {}


class DummySession:
    """Session stub that returns configured values."""

    def __init__(self, profile=None, reviews=None, scalar_values=None):
        self.profile = profile
        self.reviews = reviews or []
        self.scalar_values = scalar_values or []
        self._scalar_index = 0
        self._committed = False

    async def get(self, model_class, pk):
        if model_class == models.Profile:
            return self.profile
        if model_class == models.Review:
            for r in self.reviews:
                if r.id == pk:
                    return r
            return None
        return None

    async def scalar(self, stmt):
        if self._scalar_index < len(self.scalar_values):
            val = self.scalar_values[self._scalar_index]
            self._scalar_index += 1
            return val
        return 0

    async def scalars(self, stmt):
        class ScalarResult:
            def __init__(self, items):
                self._items = items

            def __iter__(self):
                return iter(self._items)

        return ScalarResult(self.reviews)

    async def commit(self):
        self._committed = True

    async def refresh(self, obj):
        pass


client = TestClient(app)


def setup_function():
    """Reset dependency overrides before each test."""
    app.dependency_overrides.clear()


def teardown_function():
    """Clean up dependency overrides after each test."""
    app.dependency_overrides.clear()


def test_list_shop_reviews_success():
    """List reviews for a shop."""
    user = DummyUser()
    profile = DummyProfile()
    reviews = [
        DummyReview(profile.id, status="pending"),
        DummyReview(profile.id, status="published"),
    ]
    # scalar_values: total count
    session = DummySession(profile=profile, reviews=reviews, scalar_values=[2])

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/dashboard/shops/{profile.id}/reviews")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2
    assert len(body["items"]) == 2


def test_list_shop_reviews_with_status_filter():
    """List reviews filtered by status."""
    user = DummyUser()
    profile = DummyProfile()
    reviews = [DummyReview(profile.id, status="pending")]
    session = DummySession(profile=profile, reviews=reviews, scalar_values=[1])

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(
        f"/api/dashboard/shops/{profile.id}/reviews",
        params={"status_filter": "pending"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1


def test_list_shop_reviews_not_found():
    """Return 404 if shop not found."""
    user = DummyUser()
    session = DummySession(profile=None)

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/dashboard/shops/{uuid4()}/reviews")
    assert res.status_code == 404


def test_get_shop_review_detail():
    """Get a single review detail."""
    user = DummyUser()
    profile = DummyProfile()
    review = DummyReview(profile.id, status="published")
    session = DummySession(profile=profile, reviews=[review])

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/dashboard/shops/{profile.id}/reviews/{review.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == str(review.id)
    assert body["status"] == "published"


def test_get_shop_review_not_found():
    """Return 404 if review not found."""
    user = DummyUser()
    profile = DummyProfile()
    session = DummySession(profile=profile, reviews=[])

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/dashboard/shops/{profile.id}/reviews/{uuid4()}")
    assert res.status_code == 404


def test_update_review_status_publish():
    """Update review status to published."""
    user = DummyUser()
    profile = DummyProfile()
    review = DummyReview(profile.id, status="pending")
    session = DummySession(profile=profile, reviews=[review])

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.put(
        f"/api/dashboard/shops/{profile.id}/reviews/{review.id}/status",
        json={"status": "published"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "published"
    assert session._committed


def test_update_review_status_reject():
    """Update review status to rejected."""
    user = DummyUser()
    profile = DummyProfile()
    review = DummyReview(profile.id, status="pending")
    session = DummySession(profile=profile, reviews=[review])

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.put(
        f"/api/dashboard/shops/{profile.id}/reviews/{review.id}/status",
        json={"status": "rejected"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "rejected"


def test_get_shop_review_stats():
    """Get review statistics for a shop."""
    user = DummyUser()
    profile = DummyProfile()
    # scalar_values: pending count, published count, rejected count, avg score
    session = DummySession(
        profile=profile,
        scalar_values=[5, 10, 2, 4.2],
    )

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/dashboard/shops/{profile.id}/reviews/stats")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 17
    assert body["pending"] == 5
    assert body["published"] == 10
    assert body["rejected"] == 2
    assert body["average_score"] == 4.2
