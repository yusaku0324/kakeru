from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.db import get_session
from app.domains.site import guest_reservations as domain
from app.main import app


class DummySession:
    def add(self, _obj) -> None:  # type: ignore[no-untyped-def]
        return None

    async def commit(self) -> None:
        return None

    async def refresh(self, _obj) -> None:  # type: ignore[no-untyped-def]
        return None

    async def rollback(self) -> None:
        return None


client = TestClient(app)


def setup_function() -> None:
    app.dependency_overrides[get_session] = lambda: DummySession()


def teardown_function() -> None:
    app.dependency_overrides.pop(get_session, None)


def test_create_guest_reservation_rejects_outside_business_hours(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    tz = ZoneInfo("Asia/Tokyo")
    shop_id = uuid4()
    therapist_id = uuid4()

    profile = SimpleNamespace(
        id=shop_id,
        contact_json={
            "booking_hours": {
                "tz": "Asia/Tokyo",
                "weekly": [
                    {
                        "weekday": 0,  # Monday 18:00-02:00 covers Tuesday 01:xx
                        "segments": [{"open": "18:00", "close": "02:00"}],
                    }
                ],
            },
            "booking_rules": {
                "base_buffer_minutes": 20,
                "max_extension_minutes": 120,
                "extension_step_minutes": 15,
            },
        },
    )

    async def fake_fetch_profile(_db, _shop_id):  # type: ignore[no-untyped-def]
        return profile

    async def fake_is_available(_db, _tid, _start_at, _end_at, lock=False):  # type: ignore[no-untyped-def]
        return True, {"rejected_reasons": []}

    monkeypatch.setattr(domain, "_try_fetch_profile", fake_fetch_profile)
    monkeypatch.setattr(domain, "is_available", fake_is_available)
    monkeypatch.setattr(
        domain,
        "now_utc",
        lambda: datetime(2025, 1, 6, 0, 0, tzinfo=timezone.utc),
    )

    start_at = datetime(2025, 1, 7, 1, 30, tzinfo=tz)
    payload = {
        "shop_id": str(shop_id),
        "therapist_id": str(therapist_id),
        "start_at": start_at.isoformat(),
        "end_at": (start_at + domain.timedelta(minutes=30)).isoformat(),
        "duration_minutes": 30,
        "planned_extension_minutes": 15,
    }
    res = client.post("/api/guest/reservations", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "rejected"
    assert "outside_business_hours" in (body.get("debug") or {}).get(
        "rejected_reasons", []
    )
