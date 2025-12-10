#!/usr/bin/env python3
"""
TherapistShiftテーブルからAvailabilityテーブルへの同期スクリプト。

このスクリプトは、TherapistShiftを真のソースとして
Availabilityテーブルを再構築します。

Usage:
    python scripts/sync_availability_from_shifts.py [--dry-run] [--shop-id UUID]

Options:
    --dry-run       実際の変更を行わずにシミュレーション
    --shop-id UUID  特定の店舗のみ同期
"""

import asyncio
import argparse
import logging
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import models
from app.config import settings

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


JST = timezone(timedelta(hours=9))


async def sync_availability_for_shop(
    db: AsyncSession,
    shop_id: UUID,
    today: date,
    lookahead_days: int = 14,
    dry_run: bool = False,
) -> dict:
    """店舗のAvailabilityをTherapistShiftから再構築する"""
    stats = {"deleted": 0, "created": 0, "slots_total": 0}

    # 対象期間
    end_date = today + timedelta(days=lookahead_days)

    # 既存のAvailabilityを削除
    if not dry_run:
        del_stmt = delete(models.Availability).where(
            models.Availability.profile_id == shop_id,
            models.Availability.date >= today,
            models.Availability.date <= end_date,
        )
        result = await db.execute(del_stmt)
        stats["deleted"] = result.rowcount
    else:
        count_stmt = (
            select(func.count())
            .select_from(models.Availability)
            .where(
                models.Availability.profile_id == shop_id,
                models.Availability.date >= today,
                models.Availability.date <= end_date,
            )
        )
        result = await db.execute(count_stmt)
        stats["deleted"] = result.scalar() or 0

    # TherapistShiftを取得
    shift_stmt = select(models.TherapistShift).where(
        models.TherapistShift.shop_id == shop_id,
        models.TherapistShift.date >= today,
        models.TherapistShift.date <= end_date,
        models.TherapistShift.availability_status == "available",
    )
    res = await db.execute(shift_stmt)
    shifts = res.scalars().all()

    if not shifts:
        return stats

    # セラピスト情報を取得
    therapist_ids = {s.therapist_id for s in shifts}
    therapist_stmt = select(models.Therapist).where(
        models.Therapist.id.in_(therapist_ids)
    )
    therapist_res = await db.execute(therapist_stmt)
    therapists = {t.id: t for t in therapist_res.scalars().all()}

    # 日付ごとにグループ化
    shifts_by_date: dict[date, list] = {}
    for shift in shifts:
        if shift.date not in shifts_by_date:
            shifts_by_date[shift.date] = []
        shifts_by_date[shift.date].append(shift)

    # 日付ごとにAvailabilityを作成
    for target_date, date_shifts in shifts_by_date.items():
        slots = []
        for shift in date_shifts:
            therapist = therapists.get(shift.therapist_id)
            staff_name = therapist.name if therapist else None

            # 1時間刻みでスロットを生成
            current = shift.start_at
            while current < shift.end_at:
                slot_end = min(current + timedelta(hours=1), shift.end_at)
                slots.append(
                    {
                        "start_at": current.isoformat(),
                        "end_at": slot_end.isoformat(),
                        "status": "open",
                        "staff_name": staff_name,
                        "therapist_id": str(shift.therapist_id),
                    }
                )
                current = slot_end

        is_today = target_date == today

        if not dry_run:
            availability = models.Availability(
                profile_id=shop_id,
                date=target_date,
                slots_json={"slots": slots},
                is_today=is_today,
            )
            db.add(availability)

        stats["created"] += 1
        stats["slots_total"] += len(slots)

    return stats


async def main():
    parser = argparse.ArgumentParser(
        description="Sync Availability from TherapistShift"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Simulate without making changes"
    )
    parser.add_argument("--shop-id", type=str, help="Sync only a specific shop")
    parser.add_argument(
        "--lookahead-days", type=int, default=14, help="Days to sync ahead"
    )
    args = parser.parse_args()

    dry_run = args.dry_run
    if dry_run:
        logger.info("=== DRY RUN MODE - No changes will be made ===")

    # DB接続
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # JST基準の今日
    now_utc = datetime.now(timezone.utc)
    today = now_utc.astimezone(JST).date()
    logger.info(f"Today (JST): {today}")

    async with async_session() as db:
        # 対象店舗を取得
        if args.shop_id:
            shop_ids = [UUID(args.shop_id)]
            logger.info(f"Syncing single shop: {args.shop_id}")
        else:
            # TherapistShiftが存在する店舗を取得
            shop_stmt = (
                select(models.TherapistShift.shop_id)
                .where(models.TherapistShift.date >= today)
                .distinct()
            )
            res = await db.execute(shop_stmt)
            shop_ids = [row[0] for row in res.fetchall()]
            logger.info(f"Found {len(shop_ids)} shops with shifts")

        total_stats = {"deleted": 0, "created": 0, "slots_total": 0, "shops": 0}

        for shop_id in shop_ids:
            stats = await sync_availability_for_shop(
                db, shop_id, today, args.lookahead_days, dry_run
            )
            total_stats["deleted"] += stats["deleted"]
            total_stats["created"] += stats["created"]
            total_stats["slots_total"] += stats["slots_total"]
            total_stats["shops"] += 1

            if stats["created"] > 0:
                logger.info(
                    f"Shop {shop_id}: deleted={stats['deleted']}, "
                    f"created={stats['created']} days, "
                    f"slots={stats['slots_total']}"
                )

        if not dry_run:
            await db.commit()

        logger.info("=== Summary ===")
        logger.info(f"Shops processed: {total_stats['shops']}")
        logger.info(f"Availability records deleted: {total_stats['deleted']}")
        logger.info(f"Availability records created: {total_stats['created']}")
        logger.info(f"Total slots synced: {total_stats['slots_total']}")

        if dry_run:
            logger.info("=== DRY RUN - No changes were made ===")


if __name__ == "__main__":
    asyncio.run(main())
