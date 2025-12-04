"""Tests for photo embedding service and API endpoints.

These tests require a real database connection via db_session fixture.
Skipped until conftest.py with db_session is implemented.
"""

import pytest

# Skip entire module until db_session fixture is available
pytestmark = pytest.mark.skip(
    reason="db_session fixture not available - requires conftest.py setup"
)
from uuid import uuid4
from datetime import datetime, UTC
from sqlalchemy import select
from app.models import Therapist
from app.domains.site.services.photo_embedding_service import PhotoEmbeddingService


@pytest.fixture
async def therapist_with_photos(db_session):
    """Create a therapist with photo URLs."""
    therapist = Therapist(
        id=uuid4(),
        name="Test Therapist",
        profile_id=uuid4(),
        status="published",
        photo_urls=[
            "https://example.com/photo1.jpg",
            "https://example.com/photo2.jpg",
            "https://example.com/photo3.jpg",
        ],
        specialties=["massage", "relaxation"],
        headline="Professional therapist",
    )
    db_session.add(therapist)
    await db_session.commit()
    return therapist


@pytest.fixture
async def therapist_without_photos(db_session):
    """Create a therapist without photos."""
    therapist = Therapist(
        id=uuid4(),
        name="Test Therapist No Photos",
        profile_id=uuid4(),
        status="published",
        photo_urls=[],
        specialties=["massage"],
        headline="Professional therapist",
    )
    db_session.add(therapist)
    await db_session.commit()
    return therapist


class TestPhotoEmbeddingService:
    """Test the photo embedding service."""

    async def test_compute_embedding_for_photo_url(self, db_session):
        """Test computing embedding for a single photo URL."""
        service = PhotoEmbeddingService(db_session)

        # Test with a valid URL
        embedding = await service.compute_embedding_for_photo_url(
            "https://example.com/test.jpg"
        )

        assert embedding is not None
        assert isinstance(embedding, list)
        assert len(embedding) == 512  # EMBEDDING_DIM
        assert all(isinstance(x, float) for x in embedding)

        # Check that embeddings are normalized
        import numpy as np

        norm = np.linalg.norm(embedding)
        assert abs(norm - 1.0) < 0.01  # Should be unit vector

    async def test_compute_embedding_deterministic(self, db_session):
        """Test that same URL produces same embedding (deterministic)."""
        service = PhotoEmbeddingService(db_session)
        url = "https://example.com/same-photo.jpg"

        embedding1 = await service.compute_embedding_for_photo_url(url)
        embedding2 = await service.compute_embedding_for_photo_url(url)

        assert embedding1 == embedding2

    async def test_compute_therapist_embedding_success(
        self, db_session, therapist_with_photos
    ):
        """Test computing embedding for a therapist with photos."""
        service = PhotoEmbeddingService(db_session)

        # Compute embedding
        success = await service.compute_therapist_embedding(
            str(therapist_with_photos.id)
        )
        assert success is True

        # Verify embedding was stored
        result = await db_session.execute(
            select(Therapist).where(Therapist.id == therapist_with_photos.id)
        )
        updated_therapist = result.scalar_one()

        assert updated_therapist.photo_embedding is not None
        assert len(updated_therapist.photo_embedding) == 512
        assert updated_therapist.photo_embedding_computed_at is not None
        assert updated_therapist.main_photo_index == 0

    async def test_compute_therapist_embedding_no_photos(
        self, db_session, therapist_without_photos
    ):
        """Test computing embedding for therapist without photos."""
        service = PhotoEmbeddingService(db_session)

        success = await service.compute_therapist_embedding(
            str(therapist_without_photos.id)
        )
        assert success is False

        # Verify no embedding was stored
        result = await db_session.execute(
            select(Therapist).where(Therapist.id == therapist_without_photos.id)
        )
        therapist = result.scalar_one()
        assert therapist.photo_embedding is None

    async def test_compute_therapist_embedding_invalid_id(self, db_session):
        """Test computing embedding for non-existent therapist."""
        service = PhotoEmbeddingService(db_session)

        success = await service.compute_therapist_embedding(str(uuid4()))
        assert success is False

    async def test_needs_recomputation(self, db_session, therapist_with_photos):
        """Test checking if therapist needs embedding recomputation."""
        service = PhotoEmbeddingService(db_session)

        # Initially should need computation
        needs_computation = await service.needs_recomputation(
            str(therapist_with_photos.id)
        )
        assert needs_computation is True

        # Compute embedding
        await service.compute_therapist_embedding(str(therapist_with_photos.id))

        # Should not need computation anymore
        needs_computation = await service.needs_recomputation(
            str(therapist_with_photos.id)
        )
        assert needs_computation is False

        # Update therapist to trigger recomputation need
        therapist_with_photos.photo_urls.append("https://example.com/new-photo.jpg")
        therapist_with_photos.updated_at = datetime.now(UTC)
        await db_session.commit()

        # Should need computation again
        needs_computation = await service.needs_recomputation(
            str(therapist_with_photos.id)
        )
        assert needs_computation is True

    async def test_compute_cosine_similarity(self):
        """Test cosine similarity computation."""
        # Test identical vectors
        vec1 = [1.0, 0.0, 0.0]
        similarity = PhotoEmbeddingService.compute_cosine_similarity(vec1, vec1)
        assert abs(similarity - 1.0) < 0.001

        # Test orthogonal vectors
        vec2 = [0.0, 1.0, 0.0]
        similarity = PhotoEmbeddingService.compute_cosine_similarity(vec1, vec2)
        assert abs(similarity - 0.0) < 0.001

        # Test opposite vectors
        vec3 = [-1.0, 0.0, 0.0]
        similarity = PhotoEmbeddingService.compute_cosine_similarity(vec1, vec3)
        assert abs(similarity - (-1.0)) < 0.001

        # Test with None values
        similarity = PhotoEmbeddingService.compute_cosine_similarity(None, vec1)
        assert similarity == 0.0

        similarity = PhotoEmbeddingService.compute_cosine_similarity(vec1, None)
        assert similarity == 0.0

        # Test with mismatched dimensions
        vec4 = [1.0, 0.0]
        similarity = PhotoEmbeddingService.compute_cosine_similarity(vec1, vec4)
        assert similarity == 0.0

    async def test_compute_embeddings_batch(self, db_session):
        """Test batch processing of embeddings."""
        # Create multiple therapists
        therapists = []
        for i in range(5):
            therapist = Therapist(
                id=uuid4(),
                name=f"Batch Test Therapist {i}",
                profile_id=uuid4(),
                status="published",
                photo_urls=[f"https://example.com/batch-photo-{i}.jpg"],
                specialties=["massage"],
                headline="Test therapist",
            )
            db_session.add(therapist)
            therapists.append(therapist)
        await db_session.commit()

        # Process batch
        service = PhotoEmbeddingService(db_session)
        results = await service.compute_embeddings_batch(limit=3)  # Process only 3

        assert len(results) == 3
        assert all(success for success in results.values())

        # Verify embeddings were computed
        for therapist_id in results:
            result = await db_session.execute(
                select(Therapist).where(Therapist.id == therapist_id)
            )
            therapist = result.scalar_one()
            assert therapist.photo_embedding is not None


class TestPhotoEmbeddingAPI:
    """Test the photo embedding API endpoints."""

    async def test_generate_embeddings_endpoint(
        self, client, db_session, therapist_with_photos
    ):
        """Test the generate embeddings API endpoint."""
        # Test generating for specific therapist
        response = await client.post(
            "/api/admin/therapists/embeddings/generate",
            json={"therapist_ids": [str(therapist_with_photos.id)], "force": False},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["processed"] == 1
        assert data["success"] == 1
        assert data["failed"] == 0
        assert str(therapist_with_photos.id) in data["results"]

    async def test_get_embedding_status_endpoint(
        self, client, db_session, therapist_with_photos
    ):
        """Test getting embedding status for a therapist."""
        # Generate embedding first
        service = PhotoEmbeddingService(db_session)
        await service.compute_therapist_embedding(str(therapist_with_photos.id))

        # Get status
        response = await client.get(
            f"/api/admin/therapists/{therapist_with_photos.id}/embedding"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["therapist_id"] == str(therapist_with_photos.id)
        assert data["has_embedding"] is True
        assert data["embedding_computed_at"] is not None
        assert data["main_photo_index"] == 0
        assert len(data["photo_urls"]) == 3
        assert data["embedding_dimensions"] == 512

    async def test_batch_embedding_endpoint(self, client, db_session):
        """Test the batch embedding background task endpoint."""
        response = await client.post(
            "/api/admin/therapists/embeddings/batch",
            json={"batch_size": 10, "max_total": 50},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "started"
        assert "task_id" in data
        assert data["task_id"] is not None

    async def test_get_embedding_status_not_found(self, client):
        """Test getting embedding status for non-existent therapist."""
        fake_id = uuid4()
        response = await client.get(f"/api/admin/therapists/{fake_id}/embedding")

        assert response.status_code == 404
        assert response.json()["detail"] == "Therapist not found"
