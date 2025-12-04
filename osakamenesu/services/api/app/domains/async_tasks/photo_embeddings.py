"""Async task for computing photo embeddings in batches.

This module provides background tasks for computing therapist photo embeddings.
It can be run periodically to ensure all therapists have up-to-date embeddings.
"""

import asyncio
import logging
from typing import Optional
from uuid import UUID
from datetime import datetime, UTC

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from ...settings import get_settings
from ...models import Therapist
from ..site.services.photo_embedding_service import PhotoEmbeddingService

logger = logging.getLogger(__name__)
settings = get_settings()


class PhotoEmbeddingTask:
    """Task for computing photo embeddings in batches."""

    def __init__(self):
        self.engine = create_async_engine(settings.DATABASE_URL, echo=False)
        self.async_session = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def compute_all_missing_embeddings(
        self,
        batch_size: int = 50,
        max_total: Optional[int] = None
    ) -> dict:
        """Compute embeddings for all therapists without embeddings.

        Args:
            batch_size: Number of therapists to process in each batch
            max_total: Maximum total number to process (None = unlimited)

        Returns:
            Dictionary with statistics about the process
        """
        stats = {
            "started_at": datetime.now(UTC),
            "total_processed": 0,
            "total_success": 0,
            "total_failed": 0,
            "batches_processed": 0,
            "errors": []
        }

        try:
            async with self.async_session() as session:
                service = PhotoEmbeddingService(session)

                processed = 0
                while True:
                    # Check if we've hit the max limit
                    if max_total and processed >= max_total:
                        break

                    # Process next batch
                    current_batch_size = batch_size
                    if max_total:
                        remaining = max_total - processed
                        current_batch_size = min(batch_size, remaining)

                    logger.info(f"Processing batch {stats['batches_processed'] + 1}, size: {current_batch_size}")

                    # Compute embeddings for this batch
                    results = await service.compute_embeddings_batch(
                        therapist_ids=None,  # Process those without embeddings
                        limit=current_batch_size
                    )

                    # If no results, we're done
                    if not results:
                        logger.info("No more therapists to process")
                        break

                    # Update statistics
                    stats["batches_processed"] += 1
                    for therapist_id, success in results.items():
                        stats["total_processed"] += 1
                        processed += 1
                        if success:
                            stats["total_success"] += 1
                        else:
                            stats["total_failed"] += 1
                            stats["errors"].append({
                                "therapist_id": therapist_id,
                                "batch": stats["batches_processed"]
                            })

                    # Log progress
                    logger.info(
                        f"Batch {stats['batches_processed']} complete: "
                        f"{len(results)} processed, "
                        f"{sum(1 for s in results.values() if s)} succeeded"
                    )

                    # Small delay between batches
                    await asyncio.sleep(1)

        except Exception as e:
            logger.error(f"Error in embedding computation task: {e}")
            stats["error"] = str(e)
        finally:
            stats["completed_at"] = datetime.now(UTC)
            stats["duration_seconds"] = (
                stats["completed_at"] - stats["started_at"]
            ).total_seconds()

        logger.info(
            f"Embedding computation task completed: "
            f"{stats['total_processed']} processed, "
            f"{stats['total_success']} succeeded, "
            f"{stats['total_failed']} failed"
        )

        return stats

    async def update_specific_therapists(
        self,
        therapist_ids: list[str],
        force: bool = False
    ) -> dict:
        """Update embeddings for specific therapists.

        Args:
            therapist_ids: List of therapist IDs to update
            force: Force update even if embeddings exist

        Returns:
            Dictionary with results for each therapist
        """
        results = {}

        try:
            async with self.async_session() as session:
                service = PhotoEmbeddingService(session)

                for therapist_id in therapist_ids:
                    try:
                        # Check if update needed
                        if not force:
                            needs_update = await service.needs_recomputation(therapist_id)
                            if not needs_update:
                                logger.info(f"Therapist {therapist_id} does not need update")
                                results[therapist_id] = {"success": True, "skipped": True}
                                continue

                        # Compute embedding
                        success = await service.compute_therapist_embedding(therapist_id)
                        results[therapist_id] = {"success": success}

                        if success:
                            logger.info(f"Successfully updated embedding for therapist {therapist_id}")
                        else:
                            logger.warning(f"Failed to update embedding for therapist {therapist_id}")

                    except Exception as e:
                        logger.error(f"Error updating therapist {therapist_id}: {e}")
                        results[therapist_id] = {"success": False, "error": str(e)}

        except Exception as e:
            logger.error(f"Error in update task: {e}")
            return {"error": str(e), "results": results}

        return results

    async def cleanup_stale_embeddings(
        self,
        days_old: int = 30
    ) -> dict:
        """Remove embeddings older than specified days.

        This can be useful if the embedding model changes and old
        embeddings need to be recomputed.

        Args:
            days_old: Remove embeddings older than this many days

        Returns:
            Dictionary with cleanup statistics
        """
        from datetime import timedelta

        stats = {
            "cleaned": 0,
            "errors": 0
        }

        try:
            async with self.async_session() as session:
                cutoff_date = datetime.now(UTC) - timedelta(days=days_old)

                # Find therapists with old embeddings
                result = await session.execute(
                    select(Therapist).where(
                        Therapist.photo_embedding != None,
                        Therapist.photo_embedding_computed_at < cutoff_date
                    )
                )
                therapists = result.scalars().all()

                logger.info(f"Found {len(therapists)} therapists with stale embeddings")

                # Clear their embeddings
                for therapist in therapists:
                    try:
                        therapist.photo_embedding = None
                        therapist.photo_embedding_computed_at = None
                        stats["cleaned"] += 1
                    except Exception as e:
                        logger.error(f"Error cleaning therapist {therapist.id}: {e}")
                        stats["errors"] += 1

                await session.commit()

        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")
            stats["error"] = str(e)

        logger.info(f"Cleanup completed: {stats['cleaned']} cleaned, {stats['errors']} errors")
        return stats


# Convenience function for running the task
async def run_embedding_computation(
    batch_size: int = 50,
    max_total: Optional[int] = None
) -> dict:
    """Run the embedding computation task.

    This is the main entry point for scheduled jobs or manual runs.
    """
    task = PhotoEmbeddingTask()
    return await task.compute_all_missing_embeddings(batch_size, max_total)