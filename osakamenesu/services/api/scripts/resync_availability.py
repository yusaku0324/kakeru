#!/usr/bin/env python3
"""
Resync Availability table from TherapistShift data.

This script re-syncs the Availability table for all shops, ensuring that
availability slots are correctly generated from TherapistShift records.

Usage:
    # Local development
    cd services/api
    python scripts/resync_availability.py

    # Production (via fly.io or railway)
    fly ssh console -a osakamenesu-api
    python scripts/resync_availability.py

    # With specific database URL
    DATABASE_URL=postgresql://... python scripts/resync_availability.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

JST = ZoneInfo("Asia/Tokyo")


async def resync_all_availability() -> None:
    """Resync availability for all shops for the next 14 days."""
    from app import models
    from app.services.availability_sync import sync_availability_for_date

    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/osakamenesu",
    )

    # Convert to async URL
    if database_url.startswith("postgresql://"):
        async_database_url = database_url.replace(
            "postgresql://", "postgresql+asyncpg://", 1
        )
    else:
        async_database_url = database_url

    print(f"Connecting to database...")
    engine = create_async_engine(async_database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    today_jst = datetime.now(JST).date()
    days_to_sync = 14

    async with async_session() as db:
        # Get all shop IDs (profiles)
        result = await db.execute(
            select(models.Profile.id, models.Profile.name).where(
                models.Profile.status == "published"
            )
        )
        shops = result.fetchall()

        print(f"Found {len(shops)} published shops")
        print(
            f"Syncing availability from {today_jst} to {today_jst + timedelta(days=days_to_sync - 1)}"
        )
        print()

        total_synced = 0
        errors = []

        for shop_id, shop_name in shops:
            shop_synced = 0
            for day_offset in range(days_to_sync):
                target_date = today_jst + timedelta(days=day_offset)
                try:
                    await sync_availability_for_date(db, shop_id, target_date)
                    await db.commit()
                    shop_synced += 1
                except Exception as e:
                    errors.append(f"{shop_name} ({target_date}): {e}")
                    await db.rollback()

            total_synced += shop_synced
            print(f"  ✓ {shop_name}: {shop_synced} days synced")

        print()
        print(f"Total: {total_synced} shop-days synced")

        if errors:
            print()
            print(f"Errors ({len(errors)}):")
            for error in errors[:10]:  # Show first 10 errors
                print(f"  ✗ {error}")
            if len(errors) > 10:
                print(f"  ... and {len(errors) - 10} more errors")

    await engine.dispose()
    print()
    print("Done!")


def main() -> None:
    """Entry point."""
    asyncio.run(resync_all_availability())


if __name__ == "__main__":
    main()
