"""
予約スロットチェッカーサービス (reservation_slot_service.py)

Guest / Admin 共通の予約可否チェックロジック。
reservations_v2 のみを参照し、buffer_minutes も統一的に適用。

see: specs/identity/reservation-layer-v2.yaml
see: specs/identity/availability-v2.yaml
"""

from __future__ import annotations

from datetime import datetime, date, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import ReservationV2, TherapistShift, Profile


# =============================================================================
# Public Functions
# =============================================================================


async def check_reservation_slot(
    db: AsyncSession,
    therapist_id: UUID,
    shop_id: UUID,
    start_at: datetime,
    end_at: datetime,
    exclude_reservation_id: Optional[UUID] = None,
) -> tuple[bool, Optional[str]]:
    """
    予約スロットの可否を判定する共通関数。

    Guest/Admin 両方から呼ばれる。予約の作成・更新前に必ず呼び出す。

    Args:
        db: AsyncSession - データベースセッション
        therapist_id: UUID - 対象セラピスト
        shop_id: UUID - 対象店舗
        start_at: datetime - 予約開始時刻
        end_at: datetime - 予約終了時刻
        exclude_reservation_id: Optional[UUID] - 更新時に自分自身を除外

    Returns:
        (True, None) - 予約可能
        (False, "invalid_time_range") - 時間範囲不正
        (False, "no_shift") - シフトなし
        (False, "on_break") - 休憩中
        (False, "overlap_existing") - 既存予約と重複
    """
    # 1. 時間範囲バリデーション
    if start_at >= end_at:
        return (False, "invalid_time_range")

    # 2. buffer_minutes 取得
    buffer_minutes = await _get_buffer_minutes(db, therapist_id)

    # 3. シフト取得
    target_date = start_at.date()
    shifts = await _fetch_shifts(db, therapist_id, target_date)

    if not shifts:
        return (False, "no_shift")

    # 4. シフト内かチェック
    is_within_shift = False
    for shift in shifts:
        if shift.availability_status != "available":
            continue
        if shift.start_at <= start_at and end_at <= shift.end_at:
            is_within_shift = True
            # 5. 休憩チェック
            if shift.break_slots:
                for break_slot in shift.break_slots:
                    break_start = _parse_time(break_slot.get("start"), target_date)
                    break_end = _parse_time(break_slot.get("end"), target_date)
                    if break_start and break_end:
                        if _intervals_overlap(start_at, end_at, break_start, break_end):
                            return (False, "on_break")
            break

    if not is_within_shift:
        return (False, "no_shift")

    # 6. 既存予約との重複チェック (buffer 込み)
    reservations = await _fetch_reservations_v2(
        db,
        therapist_id,
        start_at - timedelta(minutes=buffer_minutes),
        end_at + timedelta(minutes=buffer_minutes),
        exclude_reservation_id=exclude_reservation_id,
    )

    for reservation in reservations:
        # buffer を含めた重複判定
        res_start = reservation.start_at - timedelta(minutes=buffer_minutes)
        res_end = reservation.end_at + timedelta(minutes=buffer_minutes)
        if _intervals_overlap(start_at, end_at, res_start, res_end):
            return (False, "overlap_existing")

    return (True, None)


async def is_slot_available(
    db: AsyncSession,
    therapist_id: UUID,
    shop_id: UUID,
    start_at: datetime,
    end_at: datetime,
) -> bool:
    """
    シンプルな空き判定。check_reservation_slot の軽量版。

    詳細な rejected_reasons が不要な場合に使用。
    """
    ok, _ = await check_reservation_slot(db, therapist_id, shop_id, start_at, end_at)
    return ok


def build_therapist_timeline(
    shifts: list[TherapistShift],
    reservations: list[ReservationV2],
    buffer_minutes: int = 0,
) -> list[tuple[datetime, datetime]]:
    """
    日単位の空きタイムラインを組み立てる純粋関数。

    DB アクセスは呼び出し側で行い、この関数は計算のみ。

    Args:
        shifts: list[TherapistShift] - 対象日のシフト一覧
        reservations: list[ReservationV2] - 対象日の予約一覧（pending/confirmed）
        buffer_minutes: int - バッファ時間（分）

    Returns:
        list[tuple[datetime, datetime]] - 空き区間のリスト（半開区間）
    """
    # Step 1: シフトから空き区間を抽出
    available_intervals: list[tuple[datetime, datetime]] = []
    for shift in shifts:
        if shift.availability_status != "available":
            continue
        available_intervals.append((shift.start_at, shift.end_at))

    if not available_intervals:
        return []

    # Step 2: break_slots を除外
    for shift in shifts:
        if shift.break_slots:
            target_date = shift.date
            for break_slot in shift.break_slots:
                break_start = _parse_time(break_slot.get("start"), target_date)
                break_end = _parse_time(break_slot.get("end"), target_date)
                if break_start and break_end:
                    available_intervals = _subtract_interval(
                        available_intervals, break_start, break_end
                    )

    # Step 3: 既存予約 + buffer を除外
    for reservation in reservations:
        res_start = reservation.start_at - timedelta(minutes=buffer_minutes)
        res_end = reservation.end_at + timedelta(minutes=buffer_minutes)
        available_intervals = _subtract_interval(
            available_intervals, res_start, res_end
        )

    # Step 4: 正規化（ソート済み、マージ済み）
    return _normalize_intervals(available_intervals)


async def list_available_slots(
    db: AsyncSession,
    therapist_id: UUID,
    target_date: date,
    shop_id: Optional[UUID] = None,
) -> list[tuple[datetime, datetime]]:
    """
    指定日の空き枠リストを返す。

    既存の list_daily_slots を置き換える。

    Args:
        db: AsyncSession
        therapist_id: UUID
        target_date: date
        shop_id: Optional[UUID] - 店舗ID（将来のshop_idフィルタ用、現在は未使用）

    Returns:
        list[tuple[datetime, datetime]] - 空き区間のリスト
    """
    # 1. シフト取得
    shifts = await _fetch_shifts(db, therapist_id, target_date)

    if not shifts:
        return []

    # 2. buffer_minutes 取得
    buffer_minutes = await _get_buffer_minutes(db, therapist_id)

    # 3. 予約取得（日全体）
    from datetime import timezone

    day_start = datetime.combine(target_date, datetime.min.time()).replace(
        tzinfo=timezone.utc
    )
    day_end = datetime.combine(target_date, datetime.max.time()).replace(
        tzinfo=timezone.utc
    )
    reservations = await _fetch_reservations_v2(db, therapist_id, day_start, day_end)

    # 4. build_therapist_timeline 呼び出し
    return build_therapist_timeline(shifts, reservations, buffer_minutes)


async def find_next_available_slot(
    db: AsyncSession,
    therapist_id: UUID,
    shop_id: UUID,
    from_dt: datetime,
    duration_minutes: int,
    max_days: int = 7,
) -> Optional[tuple[datetime, datetime]]:
    """
    指定時刻以降の「最初の空きスロット」を返す。

    セラピストカードの「次回◯時から」表示に使用。
    list_available_slots と同じロジックを通るため、
    返されたスロットは check_reservation_slot で True になることが保証される。

    Args:
        db: AsyncSession
        therapist_id: UUID - 対象セラピスト
        shop_id: UUID - 対象店舗
        from_dt: datetime - 検索開始時刻
        duration_minutes: int - 必要な施術時間（分）
        max_days: int - 検索する最大日数（デフォルト7日）

    Returns:
        Optional[tuple[datetime, datetime]] - 最初の空きスロット (start, end)
        見つからない場合は None
    """
    from datetime import timezone

    # 現在時刻を確認（過去は検索しない）
    now = datetime.now(timezone.utc)
    search_start = max(from_dt, now)

    duration = timedelta(minutes=duration_minutes)

    for day_offset in range(max_days):
        target_date = (search_start + timedelta(days=day_offset)).date()

        # その日の空きスロット一覧を取得
        slots = await list_available_slots(db, therapist_id, target_date, shop_id)

        for slot_start, slot_end in slots:
            # 検索開始時刻より前のスロットはスキップ
            effective_start = max(slot_start, search_start)

            # スロット内に duration_minutes 分の枠が収まるか
            if effective_start + duration <= slot_end:
                return (effective_start, effective_start + duration)

    return None


async def get_next_slot_display(
    db: AsyncSession,
    therapist_id: UUID,
    shop_id: UUID,
    default_duration_minutes: int = 60,
) -> Optional[dict]:
    """
    セラピストカード表示用の「次回空き」情報を返す。

    Args:
        db: AsyncSession
        therapist_id: UUID
        shop_id: UUID
        default_duration_minutes: int - デフォルト施術時間（分）

    Returns:
        Optional[dict] - 次回空き情報
        {
            "start_at": datetime,
            "end_at": datetime,
            "date": date,
            "time_str": str,  # "14:00" 形式
            "is_today": bool,
        }
        見つからない場合は None
    """
    from datetime import timezone

    now = datetime.now(timezone.utc)
    slot = await find_next_available_slot(
        db,
        therapist_id,
        shop_id,
        from_dt=now,
        duration_minutes=default_duration_minutes,
    )

    if not slot:
        return None

    start_at, end_at = slot
    return {
        "start_at": start_at,
        "end_at": end_at,
        "date": start_at.date(),
        "time_str": start_at.strftime("%H:%M"),
        "is_today": start_at.date() == now.date(),
    }


# =============================================================================
# Internal Functions
# =============================================================================


async def _fetch_reservations_v2(
    db: AsyncSession,
    therapist_id: UUID,
    start_at: datetime,
    end_at: datetime,
    exclude_reservation_id: Optional[UUID] = None,
) -> list[ReservationV2]:
    """
    reservations_v2 から pending/confirmed の予約を取得。

    従来の _fetch_reservations (GuestReservation のみ) を置き換え。
    これにより Guest/Admin 両方の予約を考慮できる。
    """
    conditions = [
        ReservationV2.therapist_id == therapist_id,
        ReservationV2.status.in_(("pending", "confirmed")),
        ReservationV2.start_at < end_at,
        ReservationV2.end_at > start_at,
    ]

    if exclude_reservation_id:
        conditions.append(ReservationV2.id != exclude_reservation_id)

    stmt = select(ReservationV2).where(and_(*conditions))
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def _fetch_shifts(
    db: AsyncSession,
    therapist_id: UUID,
    target_date: date,
) -> list[TherapistShift]:
    """
    対象日のシフトを取得。
    """
    stmt = select(TherapistShift).where(
        TherapistShift.therapist_id == therapist_id,
        TherapistShift.date == target_date,
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def _get_buffer_minutes(
    db: AsyncSession,
    therapist_id: UUID,
) -> int:
    """
    セラピストの buffer_minutes を取得。

    Profile.buffer_minutes がない場合はデフォルト 0。
    """
    stmt = select(Profile.buffer_minutes).where(Profile.id == therapist_id)
    result = await db.execute(stmt)
    buffer_minutes = result.scalar_one_or_none()
    return buffer_minutes or 0


def _parse_time(time_str: Optional[str], target_date: date) -> Optional[datetime]:
    """
    時刻文字列 ("HH:MM") を datetime に変換。
    """
    if not time_str:
        return None
    try:
        from datetime import timezone

        hour, minute = map(int, time_str.split(":"))
        return datetime(
            target_date.year,
            target_date.month,
            target_date.day,
            hour,
            minute,
            tzinfo=timezone.utc,
        )
    except (ValueError, AttributeError):
        return None


def _intervals_overlap(
    start1: datetime, end1: datetime, start2: datetime, end2: datetime
) -> bool:
    """
    2つの半開区間 [start1, end1) と [start2, end2) が重複するか判定。
    """
    return start1 < end2 and start2 < end1


def _subtract_interval(
    intervals: list[tuple[datetime, datetime]],
    sub_start: datetime,
    sub_end: datetime,
) -> list[tuple[datetime, datetime]]:
    """
    intervals から [sub_start, sub_end) を差し引く。
    """
    result: list[tuple[datetime, datetime]] = []
    for start, end in intervals:
        if end <= sub_start or start >= sub_end:
            # 重複なし
            result.append((start, end))
        elif start < sub_start and end > sub_end:
            # 中央を削る
            result.append((start, sub_start))
            result.append((sub_end, end))
        elif start < sub_start:
            # 右側を削る
            result.append((start, sub_start))
        elif end > sub_end:
            # 左側を削る
            result.append((sub_end, end))
        # else: 完全に覆われる → 削除
    return result


def _normalize_intervals(
    intervals: list[tuple[datetime, datetime]],
) -> list[tuple[datetime, datetime]]:
    """
    区間をソートしてマージ。
    """
    if not intervals:
        return []

    sorted_intervals = sorted(intervals, key=lambda x: x[0])
    result: list[tuple[datetime, datetime]] = []

    current_start, current_end = sorted_intervals[0]
    for start, end in sorted_intervals[1:]:
        if start <= current_end:
            # マージ
            current_end = max(current_end, end)
        else:
            result.append((current_start, current_end))
            current_start, current_end = start, end

    result.append((current_start, current_end))
    return result
