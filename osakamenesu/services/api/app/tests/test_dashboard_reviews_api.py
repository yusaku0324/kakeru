"""Tests for dashboard review management endpoints."""

from __future__ import annotations

import sys
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

_HELPER_DIR = Path(__file__).resolve().parent
if str(_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_HELPER_DIR))

from _path_setup import configure_paths

ROOT = configure_paths(Path(__file__))

from app.main import app
from app.db import get_session
from app.deps import require_dashboard_user
from app import models

from _dashboard_fixtures import (
    DummyUser,
    DummyShopManager,
    DummyProfile,
    DummyReview,
    DummySession,
)


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
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)
    # scalar_values: total count
    session = DummySession(
        profile=profile,
        reviews=reviews,
        scalar_values=[2],
        shop_managers=[shop_manager],
    )

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
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)
    session = DummySession(
        profile=profile,
        reviews=reviews,
        scalar_values=[1],
        shop_managers=[shop_manager],
    )

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
    """Return 404 if shop not found (user has no access)."""
    user = DummyUser()
    session = DummySession(profile=None, shop_managers=[])

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/dashboard/shops/{uuid4()}/reviews")
    assert (
        res.status_code == 403
    )  # Changed from 404 - now returns 403 for no shop access


def test_get_shop_review_detail():
    """Get a single review detail."""
    user = DummyUser()
    profile = DummyProfile()
    review = DummyReview(profile.id, status="published")
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)
    session = DummySession(
        profile=profile, reviews=[review], shop_managers=[shop_manager]
    )

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
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)
    session = DummySession(profile=profile, reviews=[], shop_managers=[shop_manager])

    app.dependency_overrides[require_dashboard_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/dashboard/shops/{profile.id}/reviews/{uuid4()}")
    assert res.status_code == 404


def test_update_review_status_publish():
    """Update review status to published."""
    user = DummyUser()
    profile = DummyProfile()
    review = DummyReview(profile.id, status="pending")
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)
    session = DummySession(
        profile=profile, reviews=[review], shop_managers=[shop_manager]
    )

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
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)
    session = DummySession(
        profile=profile, reviews=[review], shop_managers=[shop_manager]
    )

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
    shop_manager = DummyShopManager(user_id=user.id, shop_id=profile.id)
    # scalar_values: pending count, published count, rejected count, avg score
    session = DummySession(
        profile=profile,
        scalar_values=[5, 10, 2, 4.2],
        shop_managers=[shop_manager],
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
