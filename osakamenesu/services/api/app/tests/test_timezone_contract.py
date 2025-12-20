"""
Timezone Contract Tests

UTC/JST タイムゾーン使用の契約を検証。

契約:
- DBタイムスタンプ (created_at, reserved_until 等): UTC で保存
- ビジネスロジック (可用性判定等): JST で計算
- 全ての datetime は timezone-aware であり、比較は正しく動作する
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.utils.datetime import JST, ensure_jst_datetime, ensure_aware_datetime


class TestTimezoneAwareComparison:
    """UTC と JST の比較が正しく動作することを検証"""

    def test_utc_and_jst_comparison_works_correctly(self) -> None:
        """UTC と JST の datetime を比較可能"""
        now_utc = datetime.now(timezone.utc)
        now_jst = datetime.now(JST)

        # 差は数ミリ秒以内
        diff = abs((now_jst - now_utc).total_seconds())
        assert diff < 1.0

    def test_reserved_until_utc_compared_with_jst_now(self) -> None:
        """reserved_until (UTC) と now (JST) の比較が正しく動作"""
        # reserved_until は UTC で保存される
        reserved_until_utc = datetime(2026, 6, 1, 10, 0, 0, tzinfo=timezone.utc)

        # 可用性チェックは JST で行われる
        # 2026-06-01 10:00 UTC = 2026-06-01 19:00 JST
        now_jst_before = datetime(
            2026, 6, 1, 18, 0, 0, tzinfo=JST
        )  # 18:00 JST < 19:00 JST
        now_jst_after = datetime(
            2026, 6, 1, 20, 0, 0, tzinfo=JST
        )  # 20:00 JST > 19:00 JST

        # before: reserved_until > now なのでホールドは有効
        assert reserved_until_utc > now_jst_before

        # after: reserved_until <= now なのでホールドは期限切れ
        assert reserved_until_utc <= now_jst_after

    def test_slot_time_jst_compared_with_now_utc(self) -> None:
        """スロット時間 (JST) と現在時刻 (UTC) の比較"""
        # シフトは JST で定義される
        slot_start_jst = datetime(2026, 6, 1, 10, 0, 0, tzinfo=JST)  # 10:00 JST
        slot_end_jst = datetime(2026, 6, 1, 12, 0, 0, tzinfo=JST)  # 12:00 JST

        # 現在時刻は UTC で取得される場合
        # 10:00 JST = 01:00 UTC
        now_utc = datetime(
            2026, 6, 1, 0, 0, 0, tzinfo=timezone.utc
        )  # 00:00 UTC = 09:00 JST

        # スロット開始前
        assert slot_start_jst > now_utc


class TestEnsureAwareDatetime:
    """ensure_aware_datetime のテスト"""

    def test_naive_datetime_becomes_utc(self) -> None:
        """タイムゾーンなしの datetime は UTC として扱われる"""
        naive = datetime(2026, 6, 1, 10, 0, 0)
        aware = ensure_aware_datetime(naive)

        assert aware.tzinfo == timezone.utc
        assert aware.hour == 10

    def test_jst_datetime_converted_to_utc(self) -> None:
        """JST datetime は UTC に変換される"""
        jst = datetime(2026, 6, 1, 19, 0, 0, tzinfo=JST)  # 19:00 JST
        utc = ensure_aware_datetime(jst)

        assert utc.tzinfo == timezone.utc
        assert utc.hour == 10  # 19:00 JST = 10:00 UTC


class TestEnsureJstDatetime:
    """ensure_jst_datetime のテスト"""

    def test_naive_datetime_becomes_jst(self) -> None:
        """タイムゾーンなしの datetime は JST として扱われる"""
        naive = datetime(2026, 6, 1, 10, 0, 0)
        jst = ensure_jst_datetime(naive)

        assert jst.tzinfo == JST
        assert jst.hour == 10

    def test_utc_datetime_converted_to_jst(self) -> None:
        """UTC datetime は JST に変換される"""
        utc = datetime(2026, 6, 1, 10, 0, 0, tzinfo=timezone.utc)  # 10:00 UTC
        jst = ensure_jst_datetime(utc)

        assert jst.tzinfo == JST
        assert jst.hour == 19  # 10:00 UTC = 19:00 JST


class TestReservedUntilContract:
    """reserved_until フィールドの契約テスト"""

    def test_hold_ttl_calculation_uses_utc(self) -> None:
        """reserved_until は UTC ベースで計算される"""
        from app.domains.site.guest_reservations import HOLD_TTL_MINUTES

        now_utc = datetime(2026, 6, 1, 10, 0, 0, tzinfo=timezone.utc)
        reserved_until = now_utc + timedelta(minutes=HOLD_TTL_MINUTES)

        # 15分後 (デフォルト TTL)
        expected = datetime(2026, 6, 1, 10, 15, 0, tzinfo=timezone.utc)
        assert reserved_until == expected

    def test_is_active_shop_reservation_with_mixed_timezones(self) -> None:
        """_is_active_shop_reservation は UTC/JST 混在でも正しく動作"""
        from types import SimpleNamespace

        from app.domains.site.guest_reservations import _is_active_shop_reservation

        # reserved_until は UTC (DBからの値)
        reserved_until_utc = datetime(2026, 6, 1, 10, 15, 0, tzinfo=timezone.utc)
        reservation = SimpleNamespace(
            status="reserved",
            reserved_until=reserved_until_utc,
        )

        # now は JST かもしれない
        now_jst_before = datetime(2026, 6, 1, 19, 0, 0, tzinfo=JST)  # 10:00 UTC
        now_jst_after = datetime(2026, 6, 1, 19, 30, 0, tzinfo=JST)  # 10:30 UTC

        # 有効期限内 (reserved_until > now)
        assert _is_active_shop_reservation(reservation, now_jst_before) is True

        # 有効期限切れ (reserved_until <= now)
        assert _is_active_shop_reservation(reservation, now_jst_after) is False


class TestReservedUntilNullHandling:
    """reserved_until が NULL の場合の処理契約テスト"""

    def test_null_reserved_until_treated_as_active(self) -> None:
        """reserved_until が NULL の予約はアクティブとして扱われる（防御的）"""
        from types import SimpleNamespace
        from app.domains.site.guest_reservations import _is_active_shop_reservation

        reservation = SimpleNamespace(
            status="reserved",
            reserved_until=None,  # NULL
        )
        now = datetime.now(timezone.utc)

        # NULL reserved_until は防御的にアクティブとして扱う
        assert _is_active_shop_reservation(reservation, now) is True

    def test_null_reserved_until_cleanup_by_created_at(self) -> None:
        """reserved_until が NULL の予約は created_at ベースでクリーンアップされる"""
        from types import SimpleNamespace
        from app.services.reservation_holds import (
            _should_expire_hold,
            DEFAULT_HOLD_TTL_MINUTES,
        )

        now = datetime.now(timezone.utc)
        old_created_at = now - timedelta(minutes=DEFAULT_HOLD_TTL_MINUTES + 5)

        reservation = SimpleNamespace(
            status="reserved",
            reserved_until=None,
            created_at=old_created_at,
        )

        # created_at が TTL を超えた予約は期限切れとして扱う
        assert (
            _should_expire_hold(
                reservation, now=now, ttl_minutes=DEFAULT_HOLD_TTL_MINUTES
            )
            is True
        )

    def test_null_reserved_until_not_expired_if_recent(self) -> None:
        """reserved_until が NULL でも created_at が最近なら期限切れではない"""
        from types import SimpleNamespace
        from app.services.reservation_holds import (
            _should_expire_hold,
            DEFAULT_HOLD_TTL_MINUTES,
        )

        now = datetime.now(timezone.utc)
        recent_created_at = now - timedelta(minutes=5)  # 5分前

        reservation = SimpleNamespace(
            status="reserved",
            reserved_until=None,
            created_at=recent_created_at,
        )

        # 最近作成された予約は期限切れではない
        assert (
            _should_expire_hold(
                reservation, now=now, ttl_minutes=DEFAULT_HOLD_TTL_MINUTES
            )
            is False
        )


class TestDetermineSlotStatusTimezone:
    """determine_slot_status のタイムゾーン処理テスト"""

    def test_jst_slot_with_utc_now(self) -> None:
        """JST スロットと UTC 現在時刻の比較"""
        from app.domains.site.therapist_availability import determine_slot_status

        # スロットは JST
        slot_start = datetime(2026, 6, 1, 14, 0, 0, tzinfo=JST)  # 14:00 JST
        slot_end = datetime(2026, 6, 1, 16, 0, 0, tzinfo=JST)  # 16:00 JST

        # 現在時刻は UTC で来ることもある
        now_utc = datetime(
            2026, 6, 1, 3, 0, 0, tzinfo=timezone.utc
        )  # 03:00 UTC = 12:00 JST

        # スロットは未来なので open
        status = determine_slot_status(slot_start, slot_end, now_utc)
        assert status == "open"

    def test_mixed_timezone_past_slot(self) -> None:
        """過去スロットの判定（混在タイムゾーン）"""
        from app.domains.site.therapist_availability import determine_slot_status

        slot_start = datetime(2026, 6, 1, 10, 0, 0, tzinfo=JST)
        slot_end = datetime(2026, 6, 1, 12, 0, 0, tzinfo=JST)  # 12:00 JST = 03:00 UTC

        # 12:00 JST より後
        now_utc = datetime(
            2026, 6, 1, 4, 0, 0, tzinfo=timezone.utc
        )  # 04:00 UTC = 13:00 JST

        status = determine_slot_status(slot_start, slot_end, now_utc)
        assert status == "blocked"
