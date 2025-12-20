"""Database service functions for therapist availability."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ....models import GuestReservation, Therapist, TherapistShift
from ....utils.datetime import JST
from .constants import ACTIVE_RESERVATION_STATUSES
from .helpers import (
    _day_window,
    _ensure_aware,
    _filter_active_reservations,
    _filter_slots_by_date,
    _normalize_intervals,
    _overlaps,
    _parse_breaks,
    _subtract_intervals,
)
from .schemas import AvailabilitySummaryItem, AvailabilitySummaryResponse

logger = logging.getLogger(__name__)


async def _fetch_therapist_with_buffer(
    db: AsyncSession,
    therapist_id: UUID,
) -> tuple[Therapist | None, int, UUID | None]:
    """Therapist と buffer_minutes, profile_id を一括取得するヘルパー。"""
    stmt = (
        select(Therapist)
        .options(joinedload(Therapist.profile))
        .where(Therapist.id == therapist_id)
    )
    result = await db.execute(stmt)
    therapist = result.scalar_one_or_none()

    if not therapist:
        return None, 0, None

    buffer_minutes = 0
    profile_id = None
    if therapist.profile:
        buffer_minutes = therapist.profile.buffer_minutes or 0
        profile_id = therapist.profile_id

    return therapist, buffer_minutes, profile_id


async def has_overlapping_reservation(
    db: AsyncSession,
    therapist_id: UUID,
    start_at: datetime,
    end_at: datetime,
    *,
    lock: bool = False,
) -> bool:
    """指定時間帯に重複する予約があるかチェック。

    Args:
        db: データベースセッション
        therapist_id: セラピストID
        start_at: 開始時刻
        end_at: 終了時刻
        lock: Trueの場合、SELECT FOR UPDATEでロックを取得（レースコンディション対策）
              SQLiteなどFOR UPDATEをサポートしないDBでは自動的にスキップ

    Race Condition Handling:
        - PostgreSQL: FOR UPDATE でロック取得
        - SQLite: FOR UPDATE 非サポートのため、OperationalError 時はロックなしで続行
        - 他のDBエラー: ログ出力後、ロックなしで続行（安全側に倒す）
    """
    stmt = select(GuestReservation).where(
        GuestReservation.therapist_id == therapist_id,
        GuestReservation.status.in_(ACTIVE_RESERVATION_STATUSES),
        and_(
            GuestReservation.start_at < end_at,
            GuestReservation.end_at > start_at,
        ),
    )
    # Use JST for consistency with reservation timestamps
    now = datetime.now(JST)
    if lock:
        try:
            result = await db.execute(stmt.with_for_update())
            reservations = list(result.scalars().all())
            return bool(_filter_active_reservations(reservations, now))
        except Exception as exc:
            # SQLite等ではFOR UPDATEがサポートされない
            # OperationalError 以外は予期しないエラーなのでログ出力
            exc_name = type(exc).__name__
            if "OperationalError" not in exc_name:
                logger.warning(
                    "FOR UPDATE failed with unexpected error: %s(%s), "
                    "falling back to non-locking query",
                    exc_name,
                    exc,
                )
            # ロックなしで再実行（race condition のリスクはあるが、
            # データ損失よりは二重チェックで安全側に倒す）
    result = await db.execute(stmt)
    reservations = list(result.scalars().all())
    return bool(_filter_active_reservations(reservations, now))


async def is_available(
    db: AsyncSession,
    therapist_id: UUID,
    start_at: datetime,
    end_at: datetime,
    check_buffer: bool = True,
    *,
    lock: bool = False,
) -> tuple[bool, dict[str, Any]]:
    """シフトと既存予約を見て予約可否を判定する (fail-soft)。

    バッファ時間の適用ルール:
    - シフト境界: バッファなしで予約時間がシフト内に収まっているかチェック
    - 休憩との重なり: バッファ込みでチェック（休憩の前後にバッファを確保）
    - 既存予約との重なり: バッファ込みでチェック（予約と予約の間にバッファを確保）

    Args:
        lock: Trueの場合、予約重複チェック時にSELECT FOR UPDATEでロックを取得（レースコンディション対策）
    """
    if not start_at or not end_at or start_at >= end_at:
        return False, {"rejected_reasons": ["invalid_time_range"]}

    try:
        # 共通ヘルパーで buffer_minutes を取得
        buffer_minutes = 0
        if check_buffer:
            _, buffer_minutes, _ = await _fetch_therapist_with_buffer(db, therapist_id)

        buffer_delta = timedelta(minutes=buffer_minutes)

        # 1) シフト存在チェック（バッファなしで予約時間がシフト内に収まっているか）
        # シフト開始/終了時刻ぴったりの予約は許可する
        # 同日に複数シフトがある場合に対応するため、全シフトを取得してチェック
        shift_stmt = select(TherapistShift).where(
            TherapistShift.therapist_id == therapist_id,
            TherapistShift.availability_status == "available",
            TherapistShift.start_at <= start_at,  # バッファなし
            TherapistShift.end_at >= end_at,  # バッファなし
        )
        shift_res = await db.execute(shift_stmt)
        shifts = shift_res.scalars().all()
        # いずれかのシフトに予約時間が完全に含まれているかチェック
        shift = next(
            (s for s in shifts if s.start_at <= start_at and s.end_at >= end_at), None
        )
        if not shift:
            return False, {"rejected_reasons": ["no_shift"]}

        # バッファ込みの時間範囲（休憩・予約チェック用）
        buffered_start = start_at - buffer_delta
        buffered_end = end_at + buffer_delta

        # 2) 休憩との重なり（バッファ込みでチェック）
        breaks = _parse_breaks(shift.break_slots, shift.date)
        for br_start_dt, br_end_dt in breaks:
            if _overlaps(buffered_start, buffered_end, br_start_dt, br_end_dt):
                return False, {"rejected_reasons": ["on_break"]}

        # 3) 既存予約との重なり（バッファ込みでチェック）
        # lock=Trueの場合、SELECT FOR UPDATEでロックを取得してレースコンディションを防ぐ
        if await has_overlapping_reservation(
            db, therapist_id, buffered_start, buffered_end, lock=lock
        ):
            return False, {"rejected_reasons": ["overlap_existing_reservation"]}

        return True, {"rejected_reasons": []}
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("is_available_failed: %s", exc)
        return False, {"rejected_reasons": ["internal_error"]}


async def _fetch_shifts(
    db: AsyncSession,
    therapist_id: UUID,
    date_from: date,
    date_to: date,
) -> list[TherapistShift]:
    stmt = select(TherapistShift).where(
        TherapistShift.therapist_id == therapist_id,
        TherapistShift.availability_status == "available",
        TherapistShift.date >= date_from,
        TherapistShift.date <= date_to,
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def _fetch_reservations(
    db: AsyncSession,
    therapist_id: UUID,
    start_at: datetime,
    end_at: datetime,
) -> list[GuestReservation]:
    # Use JST for consistency with reservation timestamps
    now = datetime.now(JST)
    stmt = select(GuestReservation).where(
        GuestReservation.therapist_id == therapist_id,
        GuestReservation.status.in_(ACTIVE_RESERVATION_STATUSES),
        and_(GuestReservation.start_at < end_at, GuestReservation.end_at > start_at),
    )
    res = await db.execute(stmt)
    reservations = list(res.scalars().all())
    return _filter_active_reservations(reservations, now)


def _calculate_available_slots(
    shifts: list[TherapistShift],
    reservations: list[GuestReservation],
    buffer_minutes: int = 0,
) -> list[tuple[datetime, datetime]]:
    intervals: list[tuple[datetime, datetime]] = []
    for shift in shifts:
        if shift.availability_status != "available":
            continue
        # Ensure shift times are timezone-aware (JST if naive)
        shift_start = _ensure_aware(shift.start_at)
        shift_end = _ensure_aware(shift.end_at)
        base_intervals = [(shift_start, shift_end)]
        breaks = _parse_breaks(shift.break_slots, shift.date)
        base_minus_breaks = _subtract_intervals(base_intervals, breaks)
        intervals.extend(base_minus_breaks)

    if not intervals:
        return []

    # Apply buffer to reservations (ensure timezone-aware)
    buffer_delta = timedelta(minutes=buffer_minutes)
    subtracts = [
        (
            _ensure_aware(r.start_at) - buffer_delta,
            _ensure_aware(r.end_at) + buffer_delta,
        )
        for r in reservations
    ]
    open_intervals = _subtract_intervals(intervals, subtracts)
    return _normalize_intervals(open_intervals)


async def list_daily_slots(
    db: AsyncSession,
    therapist_id: UUID,
    target_date: date,
) -> list[tuple[datetime, datetime]]:
    # Import parent package for testability (allows monkeypatching via domain.*)
    from .. import therapist_availability as _pkg

    day_start, day_end = _day_window(target_date)
    shifts = await _pkg._fetch_shifts(db, therapist_id, target_date, target_date)
    reservations = await _pkg._fetch_reservations(db, therapist_id, day_start, day_end)

    # 共通ヘルパーで buffer_minutes と profile_id を取得
    _, buffer_minutes, _profile_id = await _pkg._fetch_therapist_with_buffer(
        db, therapist_id
    )

    slots = _calculate_available_slots(shifts, reservations, buffer_minutes)

    return [
        (
            max(slot_start, day_start),
            min(slot_end, day_end),
        )
        for slot_start, slot_end in slots
        if slot_end > day_start and slot_start < day_end
    ]


async def list_availability_summary(
    db: AsyncSession,
    therapist_id: UUID,
    date_from: date,
    date_to: date,
) -> AvailabilitySummaryResponse:
    """
    複数日の空き状況サマリーを取得する（N+1 問題を解消したバッチ版）。

    改善点:
    - Therapist + buffer_minutes を1回のみ取得
    - シフトと予約を日付範囲でバッチ取得
    - メモリ上で日ごとに処理
    """
    # Import parent package for testability (allows monkeypatching via domain.*)
    from .. import therapist_availability as _pkg

    # 1. Therapist 情報を1回のみ取得
    _, buffer_minutes, _profile_id = await _pkg._fetch_therapist_with_buffer(
        db, therapist_id
    )

    # 2. 日付範囲全体でシフトと予約をバッチ取得
    shifts = await _pkg._fetch_shifts(db, therapist_id, date_from, date_to)

    # JST での日付範囲に対応する datetime 範囲を計算
    range_start = datetime.combine(date_from, time.min).replace(tzinfo=JST)
    range_end = datetime.combine(date_to, time.min).replace(tzinfo=JST) + timedelta(
        days=1
    )
    reservations = await _pkg._fetch_reservations(
        db, therapist_id, range_start, range_end
    )

    # 3. シフトを日付ごとにグループ化
    shifts_by_date: dict[date, list[TherapistShift]] = defaultdict(list)
    for shift in shifts:
        shifts_by_date[shift.date].append(shift)

    # 4. 予約を日付ごとにフィルタリングするヘルパー
    def get_reservations_for_date(target_date: date) -> list[GuestReservation]:
        day_start, day_end = _day_window(target_date)
        return [
            r for r in reservations if r.start_at < day_end and r.end_at > day_start
        ]

    # 5. 日ごとにスロットを計算
    items: list[AvailabilitySummaryItem] = []
    current = date_from
    while current <= date_to:
        day_shifts = shifts_by_date.get(current, [])
        day_reservations = get_reservations_for_date(current)

        slots = _calculate_available_slots(day_shifts, day_reservations, buffer_minutes)

        # 日付範囲でフィルタリング
        filtered_slots = _filter_slots_by_date(slots, current) if slots else []

        items.append(
            AvailabilitySummaryItem(date=current, has_available=bool(filtered_slots))
        )
        current += timedelta(days=1)

    return AvailabilitySummaryResponse(therapist_id=therapist_id, items=items)


async def resolve_therapist_id(
    db: AsyncSession, therapist_id_or_name: str
) -> UUID | None:
    """
    therapist_id (UUID文字列) または名前からTherapist UUIDを解決する。
    1. UUID形式ならそのまま使用
    2. それ以外は名前で検索
    """
    # UUIDとしてパースを試みる
    try:
        return UUID(therapist_id_or_name)
    except (ValueError, TypeError):
        pass

    # 名前でTherapistを検索
    stmt = select(Therapist.id).where(Therapist.name == therapist_id_or_name).limit(1)
    res = await db.execute(stmt)
    row = res.scalar_one_or_none()
    return row
