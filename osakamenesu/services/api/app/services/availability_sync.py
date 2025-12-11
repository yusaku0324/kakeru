"""
TherapistShift から Availability テーブルへの同期ユーティリティ。

このモジュールは dashboard/shifts と admin/therapist_shifts_api の
両方から使用される共通の同期処理を提供します。
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone, time as dt_time
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import models

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))
UTC = timezone.utc


def get_default_slot_duration_minutes(profile: models.Profile | None) -> int:
    """
    店舗のデフォルトスロット時間を取得する。

    Args:
        profile: 店舗のProfileオブジェクト

    Returns:
        スロット時間（分）。デフォルトは60分。
    """
    if profile and profile.default_slot_duration_minutes:
        return profile.default_slot_duration_minutes

    # 将来的にメニューから最短コース時間を取得する場合はここに実装
    # duration = get_min_course_duration_from_menu(profile.id)
    # if duration:
    #     return duration

    # デフォルトは60分
    return 60


def _ensure_jst(dt: datetime) -> datetime:
    """
    datetime を JST として解釈する。
    naive な datetime は JST とみなし、aware な datetime は JST に変換する。
    """
    if dt.tzinfo is None:
        # naive datetime は JST として扱う
        return dt.replace(tzinfo=JST)
    return dt.astimezone(JST)


def _format_slot_time_jst(dt: datetime) -> str:
    """
    datetime を JST の ISO 形式文字列に変換する。
    フロントエンドでの解析を容易にするため、タイムゾーン情報を含める。
    """
    jst_dt = _ensure_jst(dt)
    return jst_dt.isoformat()


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

        # 店舗のProfileを取得
        profile_stmt = select(models.Profile).where(models.Profile.id == shop_id)
        profile_res = await db.execute(profile_stmt)
        profile = profile_res.scalar_one_or_none()

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

        # 店舗のデフォルトスロット時間を取得
        slot_duration_minutes = get_default_slot_duration_minutes(profile)
        slot_delta = timedelta(minutes=slot_duration_minutes)

        # スロットを構築
        slots = []
        for shift in shifts:
            therapist = therapists.get(shift.therapist_id)
            staff_name = therapist.name if therapist else None

            # シフトの開始・終了時間を JST として解釈
            shift_start_jst = _ensure_jst(shift.start_at)
            shift_end_jst = _ensure_jst(shift.end_at)

            logger.debug(
                "Processing shift: therapist=%s, start=%s, end=%s (JST: %s - %s)",
                shift.therapist_id,
                shift.start_at,
                shift.end_at,
                shift_start_jst,
                shift_end_jst,
            )

            # 指定された時間刻みでスロットを生成
            # 修正: slot_start が shift.end_at より前であれば予約可能
            # （slot_end が shift.end_at を超えても、slot_start が範囲内なら OK）
            current = shift_start_jst
            while current < shift_end_jst:
                slot_end = current + slot_delta

                # スロット開始時間がシフト終了時間より前なら予約可能
                # slot_end > shift_end_jst でも、current < shift_end_jst なら許可
                slots.append(
                    {
                        "start_at": _format_slot_time_jst(current),
                        "end_at": _format_slot_time_jst(slot_end),
                        "status": "open",
                        "staff_name": staff_name,
                        "therapist_id": str(shift.therapist_id),
                    }
                )
                current = current + slot_delta

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
