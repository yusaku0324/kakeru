"""
TherapistShift から Availability テーブルへの同期ユーティリティ。

このモジュールは dashboard/shifts と admin/therapist_shifts_api の
両方から使用される共通の同期処理を提供します。
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))


async def sync_availability_for_date(
    db: AsyncSession,
    shop_id: UUID,
    target_date: date,
) -> None:
    """
    指定した店舗・日付のTherapistShiftからAvailabilityテーブルを同期する。
    TherapistShiftが真のソースになり、Availabilityはキャッシュとして機能。

    Args:
        db: データベースセッション
        shop_id: 店舗ID（profile_id）
        target_date: 同期対象の日付
    """
    try:
        # 指定日のすべてのシフトを取得
        shift_stmt = select(models.TherapistShift).where(
            models.TherapistShift.shop_id == shop_id,
            models.TherapistShift.date == target_date,
            models.TherapistShift.availability_status == "available",
        )
        res = await db.execute(shift_stmt)
        shifts = res.scalars().all()

        # 該当日のAvailabilityを削除
        del_stmt = delete(models.Availability).where(
            models.Availability.profile_id == shop_id,
            models.Availability.date == target_date,
        )
        await db.execute(del_stmt)

        if not shifts:
            logger.debug(
                "No available shifts for shop %s on %s, cleared availability",
                shop_id,
                target_date,
            )
            return

        # セラピスト情報を取得
        therapist_ids = {s.therapist_id for s in shifts}
        therapist_stmt = select(models.Therapist).where(
            models.Therapist.id.in_(therapist_ids)
        )
        therapist_res = await db.execute(therapist_stmt)
        therapists = {t.id: t for t in therapist_res.scalars().all()}

        # スロットを構築
        slots = []
        for shift in shifts:
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

        # 今日かどうか判定
        now_utc = datetime.now(timezone.utc)
        today_jst = now_utc.astimezone(JST).date()
        is_today = target_date == today_jst

        # Availabilityを作成
        availability = models.Availability(
            profile_id=shop_id,
            date=target_date,
            slots_json={"slots": slots},
            is_today=is_today,
        )
        db.add(availability)
        logger.info(
            "Synced availability for shop %s date %s with %d slots",
            shop_id,
            target_date,
            len(slots),
        )
    except Exception as e:
        logger.error(
            "Failed to sync availability for shop %s date %s: %s",
            shop_id,
            target_date,
            e,
        )
        raise  # エラーを再送出して呼び出し側で処理できるようにする


async def sync_availability_for_dates(
    db: AsyncSession,
    shop_id: UUID,
    dates: list[date],
) -> None:
    """
    複数の日付についてAvailabilityを同期する。

    Args:
        db: データベースセッション
        shop_id: 店舗ID
        dates: 同期対象の日付リスト
    """
    for target_date in dates:
        await sync_availability_for_date(db, shop_id, target_date)
