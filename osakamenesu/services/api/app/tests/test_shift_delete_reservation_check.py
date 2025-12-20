"""
Shift Delete with Reservation Check Tests

シフト削除時に既存予約のチェックを検証するテスト。

契約:
- シフト時間帯にアクティブな予約がある場合、削除は 409 Conflict を返す
- force=true クエリパラメータで強制削除可能
- cancelled/expired 予約はブロックしない
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.models import TherapistShift, GuestReservation
from app.db import get_session
from app.deps import require_admin, audit_admin
from app.domains.admin import therapist_shifts_api as api


SHOP_ID = uuid4()
THERAPIST_ID = uuid4()
SHIFT_ID = uuid4()


class MockResult:
    def __init__(self, items: list):
        self._items = items
        self._index = 0

    def scalar_one_or_none(self):
        return self._items[0] if self._items else None

    def scalars(self):
        return self

    def all(self):
        return self._items


class MockSession:
    """Mock session for testing."""

    def __init__(
        self, shift: TherapistShift | None, reservation: GuestReservation | None = None
    ):
        self.shift = shift
        self.reservation = reservation
        self.deleted = []
        self.committed = False

    async def execute(self, stmt):
        # Check if this is a shift query
        stmt_str = str(stmt)
        if "therapist_shifts" in stmt_str.lower():
            return MockResult([self.shift] if self.shift else [])
        # Reservation query
        if "guest_reservations" in stmt_str.lower():
            return MockResult([self.reservation] if self.reservation else [])
        return MockResult([])

    def add(self, obj):
        pass

    async def refresh(self, obj):
        pass

    async def delete(self, obj):
        self.deleted.append(obj)

    async def commit(self):
        self.committed = True


def _create_shift(
    day: date, start_hour: int = 10, end_hour: int = 18
) -> TherapistShift:
    """Create a mock shift."""
    return SimpleNamespace(
        id=SHIFT_ID,
        shop_id=SHOP_ID,
        therapist_id=THERAPIST_ID,
        date=day,
        start_at=datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
        + timedelta(hours=start_hour),
        end_at=datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
        + timedelta(hours=end_hour),
        break_slots=[],
        availability_status="available",
        notes=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def _create_reservation(
    day: date,
    start_hour: int = 10,
    end_hour: int = 12,
    status: str = "confirmed",
) -> GuestReservation:
    """Create a mock reservation."""
    return SimpleNamespace(
        id=uuid4(),
        shop_id=SHOP_ID,
        therapist_id=THERAPIST_ID,
        start_at=datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
        + timedelta(hours=start_hour),
        end_at=datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
        + timedelta(hours=end_hour),
        status=status,
    )


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_auth_overrides():
    """Setup auth mocks for all tests."""
    app.dependency_overrides[require_admin] = lambda: None
    app.dependency_overrides[audit_admin] = lambda: None
    yield
    app.dependency_overrides.pop(require_admin, None)
    app.dependency_overrides.pop(audit_admin, None)


class TestShiftDeleteWithReservationCheck:
    """シフト削除時の予約チェックテスト"""

    def test_delete_shift_without_reservations_succeeds(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """予約がないシフトは正常に削除できる"""
        day = date(2026, 6, 1)
        shift = _create_shift(day)
        session = MockSession(shift=shift, reservation=None)

        # Mock availability sync
        async def mock_sync(*args, **kwargs):
            pass

        monkeypatch.setattr(api, "sync_availability_for_date", mock_sync)

        app.dependency_overrides[get_session] = lambda: session
        try:
            res = client.delete(f"/api/admin/therapist_shifts/{SHIFT_ID}")
            assert res.status_code == 204
        finally:
            app.dependency_overrides.pop(get_session, None)

    def test_delete_shift_with_confirmed_reservation_fails(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """confirmed 予約があるシフトは削除できない"""
        day = date(2026, 6, 2)
        shift = _create_shift(day)
        reservation = _create_reservation(day, status="confirmed")
        session = MockSession(shift=shift, reservation=reservation)

        app.dependency_overrides[get_session] = lambda: session
        try:
            res = client.delete(f"/api/admin/therapist_shifts/{SHIFT_ID}")
            assert res.status_code == 409
            assert res.json()["detail"] == "shift_has_reservations"
        finally:
            app.dependency_overrides.pop(get_session, None)

    def test_delete_shift_with_pending_reservation_fails(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """pending 予約があるシフトは削除できない"""
        day = date(2026, 6, 3)
        shift = _create_shift(day)
        reservation = _create_reservation(day, status="pending")
        session = MockSession(shift=shift, reservation=reservation)

        app.dependency_overrides[get_session] = lambda: session
        try:
            res = client.delete(f"/api/admin/therapist_shifts/{SHIFT_ID}")
            assert res.status_code == 409
            assert res.json()["detail"] == "shift_has_reservations"
        finally:
            app.dependency_overrides.pop(get_session, None)

    def test_delete_shift_with_reserved_hold_fails(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """reserved ホールドがあるシフトは削除できない"""
        day = date(2026, 6, 4)
        shift = _create_shift(day)
        reservation = _create_reservation(day, status="reserved")
        session = MockSession(shift=shift, reservation=reservation)

        app.dependency_overrides[get_session] = lambda: session
        try:
            res = client.delete(f"/api/admin/therapist_shifts/{SHIFT_ID}")
            assert res.status_code == 409
            assert res.json()["detail"] == "shift_has_reservations"
        finally:
            app.dependency_overrides.pop(get_session, None)

    def test_delete_shift_with_force_parameter_succeeds(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """force=true で予約があっても削除できる"""
        day = date(2026, 6, 5)
        shift = _create_shift(day)
        reservation = _create_reservation(day, status="confirmed")
        session = MockSession(shift=shift, reservation=reservation)

        async def mock_sync(*args, **kwargs):
            pass

        monkeypatch.setattr(api, "sync_availability_for_date", mock_sync)

        app.dependency_overrides[get_session] = lambda: session
        try:
            res = client.delete(f"/api/admin/therapist_shifts/{SHIFT_ID}?force=true")
            assert res.status_code == 204
        finally:
            app.dependency_overrides.pop(get_session, None)

    def test_delete_shift_with_cancelled_reservation_succeeds(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """cancelled 予約はブロックしない"""
        day = date(2026, 6, 6)
        shift = _create_shift(day)
        # cancelled はアクティブではないのでブロックしない
        session = MockSession(
            shift=shift, reservation=None
        )  # cancelled は検索にヒットしない

        async def mock_sync(*args, **kwargs):
            pass

        monkeypatch.setattr(api, "sync_availability_for_date", mock_sync)

        app.dependency_overrides[get_session] = lambda: session
        try:
            res = client.delete(f"/api/admin/therapist_shifts/{SHIFT_ID}")
            assert res.status_code == 204
        finally:
            app.dependency_overrides.pop(get_session, None)


class TestShiftUpdateReservationCheck:
    """シフト時間短縮時の予約チェックテスト"""

    def test_update_shift_reduction_with_overlapping_reservation_fails(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """シフト時間短縮で予約がはみ出す場合は更新できない"""
        day = date(2026, 6, 10)
        # 元のシフト: 10:00-18:00
        shift = _create_shift(day, start_hour=10, end_hour=18)
        # 予約: 16:00-17:00 (新しいシフト終了時刻 15:00 より後)
        reservation = _create_reservation(
            day, start_hour=16, end_hour=17, status="confirmed"
        )

        class UpdateMockSession(MockSession):
            async def execute(self, stmt):
                stmt_str = str(stmt)
                # シフトオーバーラップチェック (exclude_id がある場合) は空を返す
                if "therapist_shifts" in stmt_str.lower() and "!=" in stmt_str:
                    return MockResult([])
                if "therapist_shifts" in stmt_str.lower():
                    return MockResult([self.shift] if self.shift else [])
                if "guest_reservations" in stmt_str.lower():
                    return MockResult([self.reservation] if self.reservation else [])
                return MockResult([])

        session = UpdateMockSession(shift=shift, reservation=reservation)

        app.dependency_overrides[get_session] = lambda: session
        try:
            # シフトを 10:00-15:00 に短縮しようとする
            res = client.put(
                f"/api/admin/therapist_shifts/{SHIFT_ID}",
                json={
                    "therapist_id": str(THERAPIST_ID),
                    "shop_id": str(SHOP_ID),
                    "date": str(day),
                    "start_at": f"{day}T10:00:00+09:00",
                    "end_at": f"{day}T15:00:00+09:00",  # 短縮
                    "break_slots": [],
                },
            )
            assert res.status_code == 409
            assert res.json()["detail"] == "shift_reduction_conflicts_reservations"
        finally:
            app.dependency_overrides.pop(get_session, None)

    def test_update_shift_reduction_with_force_succeeds(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """force=true でシフト時間短縮を強制できる"""
        day = date(2026, 6, 11)
        shift = _create_shift(day, start_hour=10, end_hour=18)
        reservation = _create_reservation(
            day, start_hour=16, end_hour=17, status="confirmed"
        )

        class UpdateMockSession(MockSession):
            async def execute(self, stmt):
                stmt_str = str(stmt)
                if "therapist_shifts" in stmt_str.lower() and "!=" in stmt_str:
                    return MockResult([])
                if "therapist_shifts" in stmt_str.lower():
                    return MockResult([self.shift] if self.shift else [])
                if "guest_reservations" in stmt_str.lower():
                    return MockResult([self.reservation] if self.reservation else [])
                return MockResult([])

            async def refresh(self, obj):
                pass

        session = UpdateMockSession(shift=shift, reservation=reservation)

        async def mock_sync(*args, **kwargs):
            pass

        monkeypatch.setattr(api, "sync_availability_for_date", mock_sync)

        app.dependency_overrides[get_session] = lambda: session
        try:
            res = client.put(
                f"/api/admin/therapist_shifts/{SHIFT_ID}?force=true",
                json={
                    "therapist_id": str(THERAPIST_ID),
                    "shop_id": str(SHOP_ID),
                    "date": str(day),
                    "start_at": f"{day}T10:00:00+09:00",
                    "end_at": f"{day}T15:00:00+09:00",
                    "break_slots": [],
                },
            )
            assert res.status_code == 200
        finally:
            app.dependency_overrides.pop(get_session, None)

    def test_update_shift_extension_without_reservation_check(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """シフト時間延長は予約チェック不要"""
        day = date(2026, 6, 12)
        shift = _create_shift(day, start_hour=10, end_hour=14)

        class UpdateMockSession(MockSession):
            async def execute(self, stmt):
                stmt_str = str(stmt)
                if "therapist_shifts" in stmt_str.lower() and "!=" in stmt_str:
                    return MockResult([])
                if "therapist_shifts" in stmt_str.lower():
                    return MockResult([self.shift] if self.shift else [])
                # 予約チェックは呼ばれないはず
                return MockResult([])

            async def refresh(self, obj):
                pass

        session = UpdateMockSession(shift=shift, reservation=None)

        async def mock_sync(*args, **kwargs):
            pass

        monkeypatch.setattr(api, "sync_availability_for_date", mock_sync)

        app.dependency_overrides[get_session] = lambda: session
        try:
            res = client.put(
                f"/api/admin/therapist_shifts/{SHIFT_ID}",
                json={
                    "therapist_id": str(THERAPIST_ID),
                    "shop_id": str(SHOP_ID),
                    "date": str(day),
                    "start_at": f"{day}T10:00:00+09:00",
                    "end_at": f"{day}T18:00:00+09:00",  # 延長
                    "break_slots": [],
                },
            )
            assert res.status_code == 200
        finally:
            app.dependency_overrides.pop(get_session, None)


class TestActiveReservationStatuses:
    """アクティブな予約ステータスの定義テスト"""

    def test_active_statuses_include_pending(self) -> None:
        """pending はアクティブ"""
        from app.domains.admin.therapist_shifts_api import ACTIVE_RESERVATION_STATUSES

        assert "pending" in ACTIVE_RESERVATION_STATUSES

    def test_active_statuses_include_confirmed(self) -> None:
        """confirmed はアクティブ"""
        from app.domains.admin.therapist_shifts_api import ACTIVE_RESERVATION_STATUSES

        assert "confirmed" in ACTIVE_RESERVATION_STATUSES

    def test_active_statuses_include_reserved(self) -> None:
        """reserved (ホールド) はアクティブ"""
        from app.domains.admin.therapist_shifts_api import ACTIVE_RESERVATION_STATUSES

        assert "reserved" in ACTIVE_RESERVATION_STATUSES

    def test_active_statuses_do_not_include_cancelled(self) -> None:
        """cancelled はアクティブではない"""
        from app.domains.admin.therapist_shifts_api import ACTIVE_RESERVATION_STATUSES

        assert "cancelled" not in ACTIVE_RESERVATION_STATUSES

    def test_active_statuses_do_not_include_expired(self) -> None:
        """expired はアクティブではない"""
        from app.domains.admin.therapist_shifts_api import ACTIVE_RESERVATION_STATUSES

        assert "expired" not in ACTIVE_RESERVATION_STATUSES
