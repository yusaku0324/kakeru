"""Photo embedding service for computing similarity vectors from therapist photos.

This service handles the computation and storage of photo embeddings used for similarity matching.
For MVP, we use a simple image feature extractor. In production, this would use a proper
vision model like CLIP or similar.
"""

import hashlib
import io
import logging
from datetime import datetime, UTC
from typing import Optional, Sequence

try:
    import numpy as np
    from PIL import Image

    NUMPY_AVAILABLE = True
except ImportError:
    np = None  # type: ignore
    Image = None  # type: ignore
    NUMPY_AVAILABLE = False

import requests
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ....models import Therapist

logger = logging.getLogger(__name__)

# Embedding dimensions - using 512 for balance between accuracy and storage
EMBEDDING_DIM = 512


class PhotoEmbeddingService:
    """Service for generating and managing photo embeddings for therapists."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def compute_embedding_for_photo_url(
        self, photo_url: str
    ) -> Optional[list[float]]:
        """Compute embedding vector for a single photo URL.

        For MVP, this generates a deterministic pseudo-embedding based on the URL.
        In production, this would:
        1. Download the image
        2. Preprocess it (resize, normalize)
        3. Pass through a vision model (CLIP, ResNet, etc.)
        4. Return the feature vector
        """
        if not NUMPY_AVAILABLE:
            logger.warning("numpy not available, cannot compute photo embedding")
            return None

        try:
            # For MVP: Generate deterministic pseudo-embedding from URL hash
            # This ensures same photo always gets same embedding
            url_hash = hashlib.sha256(photo_url.encode()).hexdigest()

            # Convert hash to numbers and normalize
            # Take chunks of the hash and convert to floats
            embedding = []
            chunk_size = len(url_hash) // EMBEDDING_DIM

            for i in range(EMBEDDING_DIM):
                chunk = url_hash[i * chunk_size : (i + 1) * chunk_size]
                # Convert hex to int and normalize to [-1, 1]
                value = int(chunk[:4], 16) / 32768.0 - 1.0
                embedding.append(value)

            # Add some variation based on position
            for i in range(len(embedding)):
                embedding[i] += np.sin(i * 0.1) * 0.1

            # Normalize to unit vector
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = [x / norm for x in embedding]

            return embedding

        except Exception as e:
            logger.warning(f"Failed to compute embedding for {photo_url}: {e}")
            return None

    async def compute_therapist_embedding(self, therapist_id: str) -> bool:
        """Compute and store photo embedding for a therapist.

        Returns True if successful, False otherwise.
        """
        try:
            # Fetch therapist
            result = await self.db.execute(
                select(Therapist).where(Therapist.id == therapist_id)
            )
            therapist = result.scalar_one_or_none()

            if not therapist:
                logger.warning(f"Therapist {therapist_id} not found")
                return False

            # Check if therapist has photos
            if not therapist.photo_urls or len(therapist.photo_urls) == 0:
                logger.info(f"Therapist {therapist_id} has no photos")
                return False

            # Use main photo or first photo
            main_index = therapist.main_photo_index or 0
            if main_index >= len(therapist.photo_urls):
                main_index = 0

            photo_url = therapist.photo_urls[main_index]

            # Compute embedding
            embedding = await self.compute_embedding_for_photo_url(photo_url)

            if embedding is None:
                logger.warning(
                    f"Failed to compute embedding for therapist {therapist_id}"
                )
                return False

            # Update therapist with embedding
            await self.db.execute(
                update(Therapist)
                .where(Therapist.id == therapist_id)
                .values(
                    photo_embedding=embedding,
                    photo_embedding_computed_at=datetime.now(UTC),
                    main_photo_index=main_index,
                )
            )
            await self.db.commit()

            logger.info(f"Successfully computed embedding for therapist {therapist_id}")
            return True

        except Exception as e:
            logger.error(f"Error computing embedding for therapist {therapist_id}: {e}")
            await self.db.rollback()
            return False

    async def compute_embeddings_batch(
        self, therapist_ids: Optional[Sequence[str]] = None, limit: int = 100
    ) -> dict[str, bool]:
        """Compute embeddings for multiple therapists.

        Args:
            therapist_ids: Specific therapist IDs to process. If None, process uncomputed ones.
            limit: Maximum number to process in this batch.

        Returns:
            Dict mapping therapist_id to success status.
        """
        results = {}

        try:
            # Build query
            query = select(Therapist).where(
                Therapist.status == "published", Therapist.photo_urls != None
            )

            if therapist_ids:
                query = query.where(Therapist.id.in_(therapist_ids))
            else:
                # Process therapists without embeddings
                query = query.where(Therapist.photo_embedding == None)

            query = query.limit(limit)

            # Fetch therapists
            result = await self.db.execute(query)
            therapists = result.scalars().all()

            logger.info(f"Processing {len(therapists)} therapists for embeddings")

            # Process each therapist
            for therapist in therapists:
                success = await self.compute_therapist_embedding(str(therapist.id))
                results[str(therapist.id)] = success

            return results

        except Exception as e:
            logger.error(f"Error in batch embedding computation: {e}")
            return results

    async def needs_recomputation(self, therapist_id: str) -> bool:
        """Check if a therapist needs embedding recomputation.

        Returns True if:
        - No embedding exists
        - Photos have changed since last computation
        - Main photo index has changed
        """
        result = await self.db.execute(
            select(Therapist).where(Therapist.id == therapist_id)
        )
        therapist = result.scalar_one_or_none()

        if not therapist:
            return False

        # No embedding yet
        if therapist.photo_embedding is None:
            return True

        # No photos
        if not therapist.photo_urls:
            return False

        # Check if updated after embedding was computed
        if (
            therapist.photo_embedding_computed_at
            and therapist.updated_at > therapist.photo_embedding_computed_at
        ):
            return True

        return False

    @staticmethod
    def compute_cosine_similarity(
        embedding1: list[float], embedding2: list[float]
    ) -> float:
        """Compute cosine similarity between two embeddings.

        Returns value between -1 and 1, where:
        - 1 means identical
        - 0 means orthogonal (unrelated)
        - -1 means opposite

        For similarity matching, we typically use values > 0.5 as "similar".
        """
        if not embedding1 or not embedding2:
            return 0.0

        if len(embedding1) != len(embedding2):
            logger.warning(
                f"Embedding dimension mismatch: {len(embedding1)} vs {len(embedding2)}"
            )
            return 0.0

        try:
            # Compute dot product and norms
            import math

            dot_product = sum(a * b for a, b in zip(embedding1, embedding2))
            norm1 = math.sqrt(sum(a * a for a in embedding1))
            norm2 = math.sqrt(sum(b * b for b in embedding2))

            if norm1 == 0 or norm2 == 0:
                return 0.0

            # Cosine similarity
            similarity = dot_product / (norm1 * norm2)

            # Clamp to [-1, 1] to handle floating point errors
            return max(-1.0, min(1.0, similarity))

        except Exception as e:
            logger.error(f"Error computing cosine similarity: {e}")
            return 0.0
