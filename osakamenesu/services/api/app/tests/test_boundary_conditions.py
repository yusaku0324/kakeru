"""Boundary condition tests for availability and shift validation.

境界条件テストケース:
1. 予約がシフト境界ぴったり開始・終了
2. 休憩とバッファ込みでぴったり隣接
3. 複数シフト時の正しいシフトの休憩チェック
4. break_slotsがシフト境界ぴったり
5. 空・None入力のハンドリング
"""

from __future__ import annotations

import os

os.environ["DATABASE_URL"] = "postgresql+asyncpg://app:app@localhost:5432/osaka_menesu"

from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.domains.site import therapist_availability as domain
from app.domains.site.therapist_availability import _overlaps, _parse_breaks
from app.utils.datetime import JST


THERAPIST_ID = uuid4()


def _dt(hour: int, minute: int = 0) -> datetime:
    """Create a JST datetime for testing on 2025-01-01."""
    return datetime(2025, 1, 1, hour, minute, 0, tzinfo=JST)


def _shift(
    start_hour: int,
    end_hour: int,
    break_slots: list[dict] | None = None,
) -> SimpleNamespace:
    """Create a shift stub."""
    return SimpleNamespace(
        therapist_id=THERAPIST_ID,
        date=date(2025, 1, 1),
        start_at=_dt(start_hour),
        end_at=_dt(end_hour),
        break_slots=break_slots or [],
        availability_status="available",
    )


# ==============================================================================
# Test: _overlaps() 半開区間重なり判定
# ==============================================================================


class TestOverlaps:
    """境界条件: _overlaps() 半開区間 [a_start, a_end) と [b_start, b_end)"""

    def test_no_overlap_adjacent(self):
        """隣接する区間は重ならない (半開区間)"""
        # [10:00, 11:00) と [11:00, 12:00) は重ならない
        assert _overlaps(_dt(10), _dt(11), _dt(11), _dt(12)) is False

    def test_no_overlap_adjacent_reverse(self):
        """逆順でも隣接は重ならない"""
        # [11:00, 12:00) と [10:00, 11:00) は重ならない
        assert _overlaps(_dt(11), _dt(12), _dt(10), _dt(11)) is False

    def test_overlap_1_minute(self):
        """1分でも重なれば True"""
        # [10:00, 11:01) と [11:00, 12:00) は重なる
        assert _overlaps(_dt(10), _dt(11, 1), _dt(11), _dt(12)) is True

    def test_overlap_identical(self):
        """完全一致は重なる"""
        assert _overlaps(_dt(10), _dt(12), _dt(10), _dt(12)) is True

    def test_overlap_contained(self):
        """包含関係は重なる"""
        # [10:00, 18:00) が [12:00, 13:00) を含む
        assert _overlaps(_dt(10), _dt(18), _dt(12), _dt(13)) is True

    def test_no_overlap_separate(self):
        """離れた区間は重ならない"""
        assert _overlaps(_dt(8), _dt(9), _dt(11), _dt(12)) is False


# ==============================================================================
# Test: _parse_breaks() 休憩パース
# ==============================================================================


class TestParseBreaks:
    """境界条件: _parse_breaks() の入力バリエーション"""

    def test_empty_list(self):
        """空リストは空を返す"""
        assert _parse_breaks([]) == []

    def test_none_input(self):
        """Noneは空を返す"""
        assert _parse_breaks(None) == []

    def test_valid_break(self):
        """正常な休憩スロット"""
        breaks = _parse_breaks(
            [
                {
                    "start_at": "2025-01-01T12:00:00+09:00",
                    "end_at": "2025-01-01T13:00:00+09:00",
                }
            ]
        )
        assert len(breaks) == 1
        assert breaks[0][0].hour == 12
        assert breaks[0][1].hour == 13

    def test_invalid_range_skipped(self):
        """start >= end の休憩はスキップ"""
        breaks = _parse_breaks(
            [
                {
                    "start_at": "2025-01-01T13:00:00+09:00",
                    "end_at": "2025-01-01T12:00:00+09:00",
                }
            ]
        )
        assert breaks == []

    def test_missing_keys_skipped(self):
        """start_at/end_at がない場合はスキップ"""
        breaks = _parse_breaks(
            [
                {"start_at": "2025-01-01T12:00:00+09:00"},  # end_at missing
                {"end_at": "2025-01-01T13:00:00+09:00"},  # start_at missing
                {},
            ]
        )
        assert breaks == []

    def test_naive_datetime_converted_to_jst(self):
        """naive datetime は JST として扱われる"""
        breaks = _parse_breaks(
            [
                {
                    "start_at": datetime(2025, 1, 1, 12, 0),
                    "end_at": datetime(2025, 1, 1, 13, 0),
                }
            ]
        )
        assert len(breaks) == 1
        assert breaks[0][0].tzinfo == JST


# ==============================================================================
# Test: break_slots バリデーション境界条件 (Pydantic)
# ==============================================================================


class TestBreakSlotsValidation:
    """境界条件: ShiftCreatePayload の break_slots バリデーション"""

    def test_break_at_shift_start_boundary(self):
        """休憩がシフト開始ぴったりから始まる場合 -> OK"""
        from app.domains.dashboard.shifts.router import ShiftCreatePayload, BreakSlot

        payload = ShiftCreatePayload(
            therapist_id=uuid4(),
            date=date(2025, 1, 1),
            start_at=_dt(10),
            end_at=_dt(18),
            break_slots=[BreakSlot(start_at=_dt(10), end_at=_dt(11))],
        )
        assert len(payload.break_slots) == 1

    def test_break_at_shift_end_boundary(self):
        """休憩がシフト終了ぴったりで終わる場合 -> OK"""
        from app.domains.dashboard.shifts.router import ShiftCreatePayload, BreakSlot

        payload = ShiftCreatePayload(
            therapist_id=uuid4(),
            date=date(2025, 1, 1),
            start_at=_dt(10),
            end_at=_dt(18),
            break_slots=[BreakSlot(start_at=_dt(17), end_at=_dt(18))],
        )
        assert len(payload.break_slots) == 1

    def test_break_1_minute_before_shift_start_rejected(self):
        """休憩がシフト開始の1分前から始まる場合 -> NG"""
        from app.domains.dashboard.shifts.router import ShiftCreatePayload, BreakSlot
        from pydantic import ValidationError

        with pytest.raises(ValidationError) as exc_info:
            ShiftCreatePayload(
                therapist_id=uuid4(),
                date=date(2025, 1, 1),
                start_at=_dt(10),
                end_at=_dt(18),
                break_slots=[BreakSlot(start_at=_dt(9, 59), end_at=_dt(11))],
            )
        assert "break slot" in str(exc_info.value).lower()

    def test_break_1_minute_after_shift_end_rejected(self):
        """休憩がシフト終了の1分後に終わる場合 -> NG"""
        from app.domains.dashboard.shifts.router import ShiftCreatePayload, BreakSlot
        from pydantic import ValidationError

        with pytest.raises(ValidationError) as exc_info:
            ShiftCreatePayload(
                therapist_id=uuid4(),
                date=date(2025, 1, 1),
                start_at=_dt(10),
                end_at=_dt(18),
                break_slots=[BreakSlot(start_at=_dt(17), end_at=_dt(18, 1))],
            )
        assert "break slot" in str(exc_info.value).lower()

    def test_break_exactly_shift_range(self):
        """休憩がシフト範囲全体 -> OK (仕様上許可)"""
        from app.domains.dashboard.shifts.router import ShiftCreatePayload, BreakSlot

        payload = ShiftCreatePayload(
            therapist_id=uuid4(),
            date=date(2025, 1, 1),
            start_at=_dt(10),
            end_at=_dt(18),
            break_slots=[BreakSlot(start_at=_dt(10), end_at=_dt(18))],
        )
        assert len(payload.break_slots) == 1


# ==============================================================================
# Test: is_available() 境界条件 (高レベル)
# ==============================================================================


class TestIsAvailableBoundary:
    """境界条件: is_available() の入力バリエーション"""

    def test_invalid_time_range_equal(self):
        """start_at == end_at は invalid_time_range"""
        import asyncio

        async def run():
            return await domain.is_available(
                db=None,  # type: ignore
                therapist_id=THERAPIST_ID,
                start_at=_dt(10),
                end_at=_dt(10),  # same as start
            )

        ok, debug = asyncio.run(run())
        assert ok is False
        assert "invalid_time_range" in debug["rejected_reasons"]

    def test_invalid_time_range_reversed(self):
        """start_at > end_at は invalid_time_range"""
        import asyncio

        async def run():
            return await domain.is_available(
                db=None,  # type: ignore
                therapist_id=THERAPIST_ID,
                start_at=_dt(12),
                end_at=_dt(10),  # before start
            )

        ok, debug = asyncio.run(run())
        assert ok is False
        assert "invalid_time_range" in debug["rejected_reasons"]

    def test_none_start_at(self):
        """start_at が None は invalid_time_range"""
        import asyncio

        async def run():
            return await domain.is_available(
                db=None,  # type: ignore
                therapist_id=THERAPIST_ID,
                start_at=None,  # type: ignore
                end_at=_dt(12),
            )

        ok, debug = asyncio.run(run())
        assert ok is False
        assert "invalid_time_range" in debug["rejected_reasons"]

    def test_none_end_at(self):
        """end_at が None は invalid_time_range"""
        import asyncio

        async def run():
            return await domain.is_available(
                db=None,  # type: ignore
                therapist_id=THERAPIST_ID,
                start_at=_dt(10),
                end_at=None,  # type: ignore
            )

        ok, debug = asyncio.run(run())
        assert ok is False
        assert "invalid_time_range" in debug["rejected_reasons"]
