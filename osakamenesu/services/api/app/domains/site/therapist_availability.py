from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Iterable, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ...models import GuestReservation, TherapistShift, Therapist, Profile
from ...db import get_session
from ...utils.datetime import ensure_jst_datetime, JST

logger = logging.getLogger(__name__)

ACTIVE_RESERVATION_STATUSES = ("pending", "confirmed", "reserved")


def _reservation_status_value(reservation: GuestReservation) -> str:
    value = reservation.status
    if hasattr(value, "value"):
        value = value.value
    return str(value)


def _is_active_reservation(reservation: GuestReservation, now: datetime) -> bool:
    """Check if reservation is active based on status and reserved_until.

    Final Decision (reserved_until Validity):
    - status in {"pending", "confirmed"} → active (reserved_until ignored)
    - status == "reserved" → check reserved_until:
        - None → active (defensive: treat as valid to avoid data loss)
        - > now → active
        - <= now → expired (inactive)
    - other statuses → inactive
    """
    status_value = _reservation_status_value(reservation)
    if status_value in {"pending", "confirmed"}:
        return True
    if status_value != "reserved":
        return False
    reserved_until = getattr(reservation, "reserved_until", None)
    if reserved_until is None:
        # Final Decision: None = valid (defensive)
        # This can happen if reserved_until was cleared but status wasn't updated
        logger.debug(
            "reserved_until is None for status=reserved reservation_id=%s",
            getattr(reservation, "id", "unknown"),
        )
        return True
    return reserved_until > now


def _filter_active_reservations(
    reservations: Iterable[GuestReservation], now: datetime
) -> list[GuestReservation]:
    return [r for r in reservations if _is_active_reservation(r, now)]


def _overlaps(
    a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime
) -> bool:
    """半開区間 [a_start, a_end) と [b_start, b_end) の重なり判定。"""
    return a_start < b_end and b_start < a_end


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


# ---- Availability listing for guests ----

router = APIRouter(
    prefix="/api/guest/therapists",
    tags=["guest-therapist-availability"],
)


class AvailabilitySummaryItem(BaseModel):
    date: date
    has_available: bool


class AvailabilitySummaryResponse(BaseModel):
    therapist_id: UUID
    items: list[AvailabilitySummaryItem]


# ステータス定義: open=予約可, tentative=要確認, blocked=予約不可
AvailabilitySlotStatus = Literal["open", "tentative", "blocked"]


class AvailabilitySlot(BaseModel):
    start_at: datetime = Field(..., description="ISO datetime of the available start")
    end_at: datetime = Field(..., description="ISO datetime of the available end")
    status: AvailabilitySlotStatus = Field(
        default="open",
        description="Slot status: open=available, tentative=needs confirmation, blocked=unavailable",
    )


class AvailabilitySlotsResponse(BaseModel):
    therapist_id: UUID
    date: date
    slots: list[AvailabilitySlot]


def determine_slot_status(
    slot_start: datetime,
    slot_end: datetime,
    now: datetime | None = None,
) -> AvailabilitySlotStatus:
    """
    スロットのステータスを決定する。

    Rules:
    - 過去のスロット（end_at <= now）→ blocked
    - それ以外 → open

    Note: tentative ステータスは将来的に予約中（未確定）の場合に使用予定
    """
    if now is None:
        now = datetime.now(JST)

    # Ensure timezone-aware comparison
    slot_end_aware = slot_end if slot_end.tzinfo else slot_end.replace(tzinfo=JST)
    now_aware = now if now.tzinfo else now.replace(tzinfo=JST)

    # 過去のスロットは blocked
    if slot_end_aware <= now_aware:
        return "blocked"

    return "open"


def _ensure_aware(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware. Naive datetimes are treated as JST."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=JST)
    return dt


def _parse_breaks(
    break_slots: Iterable[dict[str, Any]] | None,
    shift_date: date | None = None,
) -> list[tuple[datetime, datetime]]:
    """Parse break slots and ensure all datetimes are timezone-aware (JST if naive).

    Final Decision: break_slots format priority:
    1. ISO 8601 format (start_at/end_at with +09:00) - canonical
    2. Legacy HH:MM format (start_time/end_time) - fallback, requires shift_date
    """
    parsed: list[tuple[datetime, datetime]] = []
    for br in break_slots or []:
        start_dt: datetime | None = None
        end_dt: datetime | None = None

        # Priority 1: ISO 8601 format (start_at/end_at)
        start_raw = br.get("start_at")
        end_raw = br.get("end_at")
        if start_raw and end_raw:
            try:
                start_dt = (
                    start_raw
                    if isinstance(start_raw, datetime)
                    else datetime.fromisoformat(start_raw)
                )
                end_dt = (
                    end_raw
                    if isinstance(end_raw, datetime)
                    else datetime.fromisoformat(end_raw)
                )
            except Exception:
                start_dt = None
                end_dt = None

        # Priority 2: Legacy HH:MM format (start_time/end_time)
        if start_dt is None or end_dt is None:
            start_time_raw = br.get("start_time")
            end_time_raw = br.get("end_time")
            if start_time_raw and end_time_raw and shift_date:
                try:
                    # Parse HH:MM format
                    start_time = time.fromisoformat(start_time_raw)
                    end_time = time.fromisoformat(end_time_raw)
                    # Combine with shift_date and JST timezone
                    start_dt = datetime.combine(shift_date, start_time).replace(
                        tzinfo=JST
                    )
                    end_dt = datetime.combine(shift_date, end_time).replace(tzinfo=JST)
                except Exception:
                    continue

        if start_dt is None or end_dt is None:
            continue

        # Ensure timezone-aware (naive datetimes are treated as JST)
        start_dt = _ensure_aware(start_dt)
        end_dt = _ensure_aware(end_dt)

        if start_dt >= end_dt:
            continue
        parsed.append((start_dt, end_dt))
    return parsed


def _subtract_intervals(
    base: list[tuple[datetime, datetime]],
    subtracts: list[tuple[datetime, datetime]],
) -> list[tuple[datetime, datetime]]:
    """Return base intervals minus all subtract intervals (half-open)."""
    if not subtracts:
        return base[:]

    subtracts_sorted = sorted(subtracts, key=lambda x: x[0])
    remaining: list[tuple[datetime, datetime]] = []
    for start, end in base:
        cursor = start
        for sub_start, sub_end in subtracts_sorted:
            if sub_end <= cursor or sub_start >= end:
                continue
            if sub_start > cursor:
                remaining.append((cursor, min(sub_start, end)))
            cursor = max(cursor, sub_end)
            if cursor >= end:
                break
        if cursor < end:
            remaining.append((cursor, end))
    return remaining


def _normalize_intervals(
    intervals: list[tuple[datetime, datetime]],
) -> list[tuple[datetime, datetime]]:
    if not intervals:
        return []
    intervals.sort(key=lambda x: x[0])
    merged: list[tuple[datetime, datetime]] = []
    cur_start, cur_end = intervals[0]
    for start, end in intervals[1:]:
        if start <= cur_end:
            cur_end = max(cur_end, end)
        else:
            merged.append((cur_start, cur_end))
            cur_start, cur_end = start, end
    merged.append((cur_start, cur_end))
    return merged


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


def _day_window(target_date: date) -> tuple[datetime, datetime]:
    """Return the JST day window [00:00 JST, 24:00 JST) for the target date."""
    start = datetime.combine(target_date, time.min).replace(tzinfo=JST)
    end = start + timedelta(days=1)
    return start, end


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
    day_start, day_end = _day_window(target_date)
    shifts = await _fetch_shifts(db, therapist_id, target_date, target_date)
    reservations = await _fetch_reservations(db, therapist_id, day_start, day_end)

    # 共通ヘルパーで buffer_minutes と profile_id を取得
    _, buffer_minutes, _profile_id = await _fetch_therapist_with_buffer(
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


def _filter_slots_by_date(
    slots: list[tuple[datetime, datetime]],
    target_date: date,
) -> list[tuple[datetime, datetime]]:
    """指定日に重なるスロットをフィルタリングする。"""
    day_start, day_end = _day_window(target_date)
    return [
        (max(slot_start, day_start), min(slot_end, day_end))
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
    # 1. Therapist 情報を1回のみ取得
    _, buffer_minutes, _profile_id = await _fetch_therapist_with_buffer(
        db, therapist_id
    )

    # 2. 日付範囲全体でシフトと予約をバッチ取得
    shifts = await _fetch_shifts(db, therapist_id, date_from, date_to)

    # JST での日付範囲に対応する datetime 範囲を計算
    range_start = datetime.combine(date_from, time.min).replace(tzinfo=JST)
    range_end = datetime.combine(date_to, time.min).replace(tzinfo=JST) + timedelta(
        days=1
    )
    reservations = await _fetch_reservations(db, therapist_id, range_start, range_end)

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


@router.get(
    "/{therapist_id}/availability_summary",
    response_model=AvailabilitySummaryResponse,
    status_code=status.HTTP_200_OK,
)
async def get_availability_summary_api(
    therapist_id: UUID,
    date_from: date = Query(..., description="inclusive YYYY-MM-DD"),
    date_to: date = Query(..., description="inclusive YYYY-MM-DD"),
    db: AsyncSession = Depends(get_session),
):
    if date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_date_range"
        )
    summary = await list_availability_summary(db, therapist_id, date_from, date_to)
    return summary


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


@router.get(
    "/{therapist_id}/availability_slots",
    response_model=AvailabilitySlotsResponse,
    status_code=status.HTTP_200_OK,
)
async def get_availability_slots_api(
    therapist_id: str,
    date: date = Query(..., description="target YYYY-MM-DD"),
    db: AsyncSession = Depends(get_session),
):
    resolved_id = await resolve_therapist_id(db, therapist_id)
    if not resolved_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="therapist_not_found",
        )
    slots = await list_daily_slots(db, resolved_id, date)
    now = datetime.now(JST)
    return AvailabilitySlotsResponse(
        therapist_id=resolved_id,
        date=date,
        slots=[
            AvailabilitySlot(
                start_at=start,
                end_at=end,
                status=determine_slot_status(start, end, now),
            )
            for start, end in slots
        ],
    )


class SlotVerificationResponse(BaseModel):
    """スロット検証結果"""

    therapist_id: UUID
    start_at: datetime
    end_at: datetime
    status: AvailabilitySlotStatus
    verified_at: datetime = Field(..., description="Verification timestamp in JST")
    is_available: bool = Field(..., description="True if slot can be booked")


@router.get(
    "/{therapist_id}/verify_slot",
    response_model=SlotVerificationResponse,
    status_code=status.HTTP_200_OK,
    responses={
        409: {
            "description": "Slot is no longer available",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "slot_unavailable",
                        "status": "blocked",
                        "conflicted_at": "2025-01-01T12:00:00+09:00",
                    }
                }
            },
        }
    },
)
async def verify_slot_api(
    therapist_id: str,
    start_at: datetime = Query(..., description="Slot start time (ISO format)"),
    db: AsyncSession = Depends(get_session),
):
    """
    予約前にスロットの最新状態を検証する。

    - 200: スロットが予約可能
    - 409: スロットが予約不可（他の予約が入った等）
    """
    resolved_id = await resolve_therapist_id(db, therapist_id)
    if not resolved_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="therapist_not_found",
        )

    now = datetime.now(JST)

    # start_at から日付を取得してスロット一覧を取得
    target_date = (
        start_at.date() if start_at.tzinfo else start_at.replace(tzinfo=JST).date()
    )
    slots = await list_daily_slots(db, resolved_id, target_date)

    # 指定された start_at に一致するスロットを検索
    matching_slot = None
    start_at_aware = start_at if start_at.tzinfo else start_at.replace(tzinfo=JST)

    for slot_start, slot_end in slots:
        slot_start_aware = (
            slot_start if slot_start.tzinfo else slot_start.replace(tzinfo=JST)
        )
        # タイムスタンプが一致するか確認（秒単位で比較）
        if abs((slot_start_aware - start_at_aware).total_seconds()) < 60:
            matching_slot = (slot_start, slot_end)
            break

    if not matching_slot:
        # スロットが存在しない（予約済み or シフト外）
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "detail": "slot_unavailable",
                "status": "blocked",
                "conflicted_at": now.isoformat(),
            },
        )

    slot_start, slot_end = matching_slot
    slot_status = determine_slot_status(slot_start, slot_end, now)

    if slot_status == "blocked":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "detail": "slot_unavailable",
                "status": slot_status,
                "conflicted_at": now.isoformat(),
            },
        )

    return SlotVerificationResponse(
        therapist_id=resolved_id,
        start_at=slot_start,
        end_at=slot_end,
        status=slot_status,
        verified_at=now,
        is_available=slot_status in ("open", "tentative"),
    )
