#!/usr/bin/env python3
"""Command-line tool for managing photo embeddings.

Usage:
    python scripts/manage_embeddings.py compute-all [--batch-size=N] [--max-total=N]
    python scripts/manage_embeddings.py compute-therapist <therapist_id> [--force]
    python scripts/manage_embeddings.py status
    python scripts/manage_embeddings.py cleanup [--days-old=N]
"""

import asyncio
import argparse
import logging
from pathlib import Path
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.domains.async_tasks.photo_embeddings import PhotoEmbeddingTask
from app.db import get_session, engine
from app.models import Therapist
from sqlalchemy import select, func

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def compute_all_embeddings(batch_size: int = 50, max_total: int = None):
    """Compute embeddings for all therapists without embeddings."""
    task = PhotoEmbeddingTask()
    logger.info(f"Starting batch embedding computation (batch_size={batch_size}, max_total={max_total})")

    stats = await task.compute_all_missing_embeddings(batch_size=batch_size, max_total=max_total)

    print("\n=== Embedding Computation Complete ===")
    print(f"Total processed: {stats['total_processed']}")
    print(f"Successful: {stats['total_success']}")
    print(f"Failed: {stats['total_failed']}")
    print(f"Duration: {stats.get('duration_seconds', 0):.2f} seconds")

    if stats['errors']:
        print(f"\nFailed therapist IDs:")
        for error in stats['errors'][:10]:  # Show first 10 errors
            print(f"  - {error['therapist_id']} (batch {error['batch']})")
        if len(stats['errors']) > 10:
            print(f"  ... and {len(stats['errors']) - 10} more")


async def compute_specific_therapist(therapist_id: str, force: bool = False):
    """Compute embedding for a specific therapist."""
    task = PhotoEmbeddingTask()
    logger.info(f"Computing embedding for therapist {therapist_id} (force={force})")

    results = await task.update_specific_therapists([therapist_id], force=force)

    if therapist_id in results:
        result = results[therapist_id]
        if result.get('success'):
            if result.get('skipped'):
                print(f"✓ Therapist {therapist_id}: Already has embedding (use --force to recompute)")
            else:
                print(f"✓ Therapist {therapist_id}: Embedding computed successfully")
        else:
            print(f"✗ Therapist {therapist_id}: Failed - {result.get('error', 'Unknown error')}")
    else:
        print(f"✗ Therapist {therapist_id}: Not found")


async def show_embedding_status():
    """Show current status of embeddings."""
    async with get_session() as session:
        # Count total therapists
        total_result = await session.execute(
            select(func.count()).select_from(Therapist).where(
                Therapist.status == "published"
            )
        )
        total_count = total_result.scalar()

        # Count therapists with embeddings
        with_embedding_result = await session.execute(
            select(func.count()).select_from(Therapist).where(
                Therapist.status == "published",
                Therapist.photo_embedding != None
            )
        )
        with_embedding_count = with_embedding_result.scalar()

        # Count therapists with photos but no embeddings
        need_embedding_result = await session.execute(
            select(func.count()).select_from(Therapist).where(
                Therapist.status == "published",
                Therapist.photo_urls != None,
                Therapist.photo_embedding == None
            )
        )
        need_embedding_count = need_embedding_result.scalar()

        # Get some examples of therapists needing embeddings
        examples_result = await session.execute(
            select(Therapist.id, Therapist.name).where(
                Therapist.status == "published",
                Therapist.photo_urls != None,
                Therapist.photo_embedding == None
            ).limit(5)
        )
        examples = examples_result.all()

        print("\n=== Photo Embedding Status ===")
        print(f"Total published therapists: {total_count}")
        print(f"With embeddings: {with_embedding_count} ({with_embedding_count/total_count*100:.1f}%)")
        print(f"Need embeddings: {need_embedding_count}")

        if examples:
            print(f"\nExamples of therapists needing embeddings:")
            for therapist_id, name in examples:
                print(f"  - {therapist_id}: {name}")


async def cleanup_stale_embeddings(days_old: int = 30):
    """Remove old embeddings."""
    task = PhotoEmbeddingTask()
    logger.info(f"Cleaning up embeddings older than {days_old} days")

    stats = await task.cleanup_stale_embeddings(days_old=days_old)

    print(f"\n=== Cleanup Complete ===")
    print(f"Cleaned: {stats.get('cleaned', 0)} embeddings")
    if stats.get('errors'):
        print(f"Errors: {stats['errors']}")


def main():
    parser = argparse.ArgumentParser(description="Manage photo embeddings")
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Compute all embeddings command
    compute_all_parser = subparsers.add_parser('compute-all', help='Compute embeddings for all therapists')
    compute_all_parser.add_argument('--batch-size', type=int, default=50, help='Batch size for processing')
    compute_all_parser.add_argument('--max-total', type=int, help='Maximum total to process')

    # Compute specific therapist command
    compute_therapist_parser = subparsers.add_parser('compute-therapist', help='Compute embedding for specific therapist')
    compute_therapist_parser.add_argument('therapist_id', help='Therapist ID')
    compute_therapist_parser.add_argument('--force', action='store_true', help='Force recomputation')

    # Status command
    subparsers.add_parser('status', help='Show embedding status')

    # Cleanup command
    cleanup_parser = subparsers.add_parser('cleanup', help='Cleanup old embeddings')
    cleanup_parser.add_argument('--days-old', type=int, default=30, help='Remove embeddings older than N days')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Run the appropriate command
    if args.command == 'compute-all':
        asyncio.run(compute_all_embeddings(args.batch_size, args.max_total))
    elif args.command == 'compute-therapist':
        asyncio.run(compute_specific_therapist(args.therapist_id, args.force))
    elif args.command == 'status':
        asyncio.run(show_embedding_status())
    elif args.command == 'cleanup':
        asyncio.run(cleanup_stale_embeddings(args.days_old))


if __name__ == "__main__":
    main()