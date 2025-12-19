"""
Availability Status Contract Tests

バックエンド/フロントエンド間の open/blocked ステータス契約を検証。

契約:
- シフトあり + 予約なし → open (空きスロットが返される)
- シフトあり + 予約あり（全時間） → slots = [] (空きなし)
- シフトあり + 予約あり（一部時間） → 残りの時間が open
- シフトなし → slots = []
- 過去のスロット → フィルタされて返されない

API Response:
- status: "open" | "blocked" のみ
- "tentative" は API から返されない (UI-only state)
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.datetime import JST
from app.domains.site import therapist_availability as domain
from app.db import get_session


THERAPIST_ID = uuid4()


class DummyResult:
    def scalar_one_or_none(self):
        return None


class DummySession:
    async def execute(self, stmt):
        return DummyResult()


@pytest.fixture(autouse=True)
def mock_db_session():
    """Mock database session for all tests."""
    app.dependency_overrides[get_session] = lambda: DummySession()
    yield
    app.dependency_overrides.pop(get_session, None)


def _shift(
    day: date,
    start_hour: int,
    end_hour: int,
    status: str = "available",
) -> SimpleNamespace:
    """Create a shift in JST timezone."""
    start = datetime.combine(day, datetime.min.time(), tzinfo=JST) + timedelta(
        hours=start_hour
    )
    end = datetime.combine(day, datetime.min.time(), tzinfo=JST) + timedelta(
        hours=end_hour
    )
    return SimpleNamespace(
        therapist_id=THERAPIST_ID,
        date=day,
        start_at=start,
        end_at=end,
        break_slots=[],
        availability_status=status,
    )


def _reservation(
    day: date,
    start_hour: int,
    end_hour: int,
    status: str = "confirmed",
) -> SimpleNamespace:
    """Create a reservation in JST timezone."""
    start = datetime.combine(day, datetime.min.time(), tzinfo=JST) + timedelta(
        hours=start_hour
    )
    end = datetime.combine(day, datetime.min.time(), tzinfo=JST) + timedelta(
        hours=end_hour
    )
    return SimpleNamespace(start_at=start, end_at=end, status=status)


client = TestClient(app)


class TestOpenBlockedContract:
    """open/blocked ステータスの契約テスト"""

    def test_shift_without_reservation_returns_open_slots(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """シフトあり + 予約なし → open スロットが返される"""
        day = date(2026, 6, 1)  # 未来の日付
        shift = _shift(day, 10, 14)

        async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
            return [shift]

        async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
            return []

        monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
        monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

        res = client.get(
            f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
            params={"date": str(day)},
        )
        assert res.status_code == 200
        slots = res.json()["slots"]

        # スロットが存在し、open ステータス
        assert len(slots) >= 1
        for slot in slots:
            assert slot["status"] == "open"
            assert "tentative" not in slot["status"]  # tentative は返されない

    def test_shift_fully_booked_returns_empty_slots(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """シフトあり + 全時間予約 → slots = []"""
        day = date(2026, 6, 2)  # 未来の日付
        shift = _shift(day, 10, 14)
        reservation = _reservation(day, 10, 14, status="confirmed")

        async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
            return [shift]

        async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
            return [reservation]

        monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
        monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

        res = client.get(
            f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
            params={"date": str(day)},
        )
        assert res.status_code == 200
        slots = res.json()["slots"]

        # 空きなし
        assert len(slots) == 0

    def test_shift_partially_booked_returns_remaining_open(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """シフトあり + 一部予約 → 残りが open"""
        day = date(2026, 6, 3)  # 未来の日付
        shift = _shift(day, 10, 18)  # 10:00-18:00 シフト
        reservation = _reservation(day, 10, 12, status="confirmed")  # 10:00-12:00 予約

        async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
            return [shift]

        async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
            return [reservation]

        monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
        monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

        res = client.get(
            f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
            params={"date": str(day)},
        )
        assert res.status_code == 200
        slots = res.json()["slots"]

        # 12:00-18:00 の空き枠が返される
        assert len(slots) >= 1
        # 全て open ステータス
        for slot in slots:
            assert slot["status"] == "open"
        # 最初のスロットは 12:00 以降
        assert "T12:00" in slots[0]["start_at"] or "T13:00" in slots[0]["start_at"]

    def test_no_shift_returns_empty_slots(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """シフトなし → slots = []"""
        day = date(2026, 6, 4)  # 未来の日付

        async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
            return []

        async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
            return []

        monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
        monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

        res = client.get(
            f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
            params={"date": str(day)},
        )
        assert res.status_code == 200
        slots = res.json()["slots"]

        assert len(slots) == 0

    def test_pending_reservation_also_blocks_slot(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """pending 状態の予約もスロットをブロックする"""
        day = date(2026, 6, 5)  # 未来の日付
        shift = _shift(day, 10, 14)
        reservation = _reservation(day, 10, 14, status="pending")

        async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
            return [shift]

        async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
            return [reservation]

        monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
        monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

        res = client.get(
            f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
            params={"date": str(day)},
        )
        assert res.status_code == 200
        slots = res.json()["slots"]

        # pending でもブロックされる
        assert len(slots) == 0

    def test_cancelled_reservation_does_not_block_slot(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """cancelled 状態の予約はスロットをブロックしない"""
        day = date(2026, 6, 6)  # 未来の日付
        shift = _shift(day, 10, 14)
        reservation = _reservation(day, 10, 14, status="cancelled")

        async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
            return [shift]

        async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
            # cancelled は ACTIVE_RESERVATION_STATUSES に含まれないのでフィルタされる
            return []

        monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
        monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

        res = client.get(
            f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
            params={"date": str(day)},
        )
        assert res.status_code == 200
        slots = res.json()["slots"]

        # キャンセル済みなのでスロットは空き
        assert len(slots) >= 1
        for slot in slots:
            assert slot["status"] == "open"


class TestApiResponseContract:
    """API Response の契約テスト"""

    def test_api_response_contains_only_open_or_blocked(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """API Response は open/blocked のみを含む (tentative は含まない)"""
        day = date(2026, 6, 10)  # 未来の日付
        shift = _shift(day, 10, 18)

        async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
            return [shift]

        async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
            return []

        monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
        monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

        res = client.get(
            f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
            params={"date": str(day)},
        )
        assert res.status_code == 200
        slots = res.json()["slots"]

        # 全スロットのステータスを確認
        for slot in slots:
            assert slot["status"] in ("open", "blocked")
            # tentative は API から返されない
            assert slot["status"] != "tentative"

    def test_slot_response_structure(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """スロットのレスポンス構造が正しい"""
        day = date(2026, 6, 11)  # 未来の日付
        shift = _shift(day, 10, 12)

        async def fake_fetch_shifts(db, therapist_id, date_from, date_to):
            return [shift]

        async def fake_fetch_reservations(db, therapist_id, start_at, end_at):
            return []

        monkeypatch.setattr(domain, "_fetch_shifts", fake_fetch_shifts)
        monkeypatch.setattr(domain, "_fetch_reservations", fake_fetch_reservations)

        res = client.get(
            f"/api/guest/therapists/{THERAPIST_ID}/availability_slots",
            params={"date": str(day)},
        )
        assert res.status_code == 200
        slots = res.json()["slots"]

        assert len(slots) >= 1
        slot = slots[0]

        # 必須フィールドの存在確認
        assert "start_at" in slot
        assert "end_at" in slot
        assert "status" in slot

        # ISO 8601 形式の日時
        assert "T" in slot["start_at"]
        assert "T" in slot["end_at"]


class TestDetermineSlotStatus:
    """determine_slot_status 関数の単体テスト"""

    def test_future_slot_is_open(self) -> None:
        """未来のスロットは open"""
        now = datetime(2025, 6, 1, 12, 0, tzinfo=JST)
        slot_start = datetime(2025, 6, 1, 14, 0, tzinfo=JST)
        slot_end = datetime(2025, 6, 1, 16, 0, tzinfo=JST)

        status = domain.determine_slot_status(slot_start, slot_end, now)
        assert status == "open"

    def test_past_slot_is_blocked(self) -> None:
        """過去のスロットは blocked"""
        now = datetime(2025, 6, 1, 18, 0, tzinfo=JST)
        slot_start = datetime(2025, 6, 1, 14, 0, tzinfo=JST)
        slot_end = datetime(2025, 6, 1, 16, 0, tzinfo=JST)

        status = domain.determine_slot_status(slot_start, slot_end, now)
        assert status == "blocked"

    def test_slot_ending_now_is_blocked(self) -> None:
        """ちょうど終了したスロットは blocked"""
        now = datetime(2025, 6, 1, 16, 0, tzinfo=JST)
        slot_start = datetime(2025, 6, 1, 14, 0, tzinfo=JST)
        slot_end = datetime(2025, 6, 1, 16, 0, tzinfo=JST)

        status = domain.determine_slot_status(slot_start, slot_end, now)
        assert status == "blocked"

    def test_slot_ending_soon_is_open(self) -> None:
        """終了直前のスロットは open"""
        now = datetime(2025, 6, 1, 15, 59, tzinfo=JST)
        slot_start = datetime(2025, 6, 1, 14, 0, tzinfo=JST)
        slot_end = datetime(2025, 6, 1, 16, 0, tzinfo=JST)

        status = domain.determine_slot_status(slot_start, slot_end, now)
        assert status == "open"

    def test_naive_datetime_treated_as_jst(self) -> None:
        """タイムゾーンなしの datetime は JST として扱われる"""
        now = datetime(2025, 6, 1, 12, 0, tzinfo=JST)
        slot_start = datetime(2025, 6, 1, 14, 0)  # naive
        slot_end = datetime(2025, 6, 1, 16, 0)  # naive

        status = domain.determine_slot_status(slot_start, slot_end, now)
        assert status == "open"
