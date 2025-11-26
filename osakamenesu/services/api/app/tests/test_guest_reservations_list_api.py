from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.domains.site import guest_reservations as domain
from app.db import get_session


class DummyReservation:
    def __init__(self, guest_token: str, status: str = "confirmed"):
        now = datetime.now(timezone.utc)
        self.id = uuid4()
        self.status = status
        self.shop_id = uuid4()
        self.therapist_id = uuid4()
        self.start_at = now
        self.end_at = now
        self.duration_minutes = 60
        self.course_id = None
        self.price = None
        self.payment_method = None
        self.contact_info = None
        self.guest_token = guest_token
        self.notes = None
        self.base_staff_id = None
        self.created_at = now
        self.updated_at = now


class DummySession:
    def __init__(self, rows):
        self.rows = rows

    async def execute(self, stmt):
        class R:
            def __init__(self, values):
                self.values = values

            def scalars(self):
                class S:
                    def __init__(self, values):
                        self.values = values

                    def all(self):
                        return self.values

                return S(self.values)

        return R(self.rows)


client = TestClient(app)


def setup_function() -> None:
    return None


def teardown_function() -> None:
    app.dependency_overrides.pop(get_session, None)


def test_list_by_guest_token_returns_own_reservations():
    token = "guest-token-1"
    r1 = DummyReservation(token)
    r2 = DummyReservation(token)
    session = DummySession([r1, r2])
    app.dependency_overrides[get_session] = lambda: session

    res = client.get("/api/guest/reservations", params={"guest_token": token})
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 2
    assert all(item["guest_token"] == token for item in body)


def test_list_empty_when_no_reservations():
    token = "no-token"
    session = DummySession([])
    app.dependency_overrides[get_session] = lambda: session

    res = client.get("/api/guest/reservations", params={"guest_token": token})
    assert res.status_code == 200
    assert res.json() == []
