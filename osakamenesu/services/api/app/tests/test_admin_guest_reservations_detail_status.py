from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.domains.admin import guest_reservations_api as api  # noqa: F401 - import for coverage
from app.db import get_session
from app.deps import audit_admin, require_admin
from app.models import GuestReservation, Profile, Therapist


class DummyTherapist:
    def __init__(self, id, name: str):
        self.id = id
        self.name = name


class DummyShop:
    def __init__(self, id, name: str):
        self.id = id
        self.name = name


class DummySession:
    def __init__(self, reservations=None, therapists=None, shops=None):
        self.reservations = reservations or []
        self.therapists = therapists or []
        self.shops = shops or []
        self.added = []
        self.commits = 0

    async def execute(self, stmt):
        model = stmt.column_descriptions[0]["entity"]
        items = []
        if model is GuestReservation:
            items = self.reservations
        elif model is Therapist:
            items = self.therapists
        elif model is Profile:
            items = self.shops

        class R:
            def __init__(self, items):
                self.items = items

            def scalars(self):
                class S:
                    def __init__(self, items):
                        self._items = items

                    def all(self):
                        return self._items

                    def first(self):
                        return self._items[0] if self._items else None

                return S(self.items)

            def scalar_one_or_none(self):
                if not self.items:
                    return None
                return self.items[0]

        return R(items)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1

    async def refresh(self, obj, attribute_names=None):
        return None


client = TestClient(app)


def setup_function():
    app.dependency_overrides[get_session] = lambda: DummySession()
    app.dependency_overrides[require_admin] = lambda: None
    app.dependency_overrides[audit_admin] = lambda: None


def teardown_function():
    app.dependency_overrides.pop(get_session, None)
    app.dependency_overrides.pop(require_admin, None)
    app.dependency_overrides.pop(audit_admin, None)


def _reservation(status: str = "pending") -> GuestReservation:
    now = datetime.now(timezone.utc)
    return GuestReservation(
        id=uuid4(),
        shop_id=uuid4(),
        therapist_id=uuid4(),
        start_at=now,
        end_at=now + timedelta(hours=1),
        status=status,
        contact_info={"email": "guest@example.com"},
        notes="",
        created_at=now,
        updated_at=now,
    )


def test_get_admin_guest_reservation_detail():
    reservation = _reservation(status="confirmed")
    therapist = DummyTherapist(reservation.therapist_id, "セラピストA")
    shop = DummyShop(reservation.shop_id, "店舗A")
    session = DummySession(
        reservations=[reservation], therapists=[therapist], shops=[shop]
    )
    app.dependency_overrides[get_session] = lambda: session

    res = client.get(f"/api/admin/guest_reservations/{reservation.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == str(reservation.id)
    assert body["therapist_name"] == therapist.name
    assert body["shop_name"] == shop.name


def test_get_admin_guest_reservation_not_found():
    app.dependency_overrides[get_session] = lambda: DummySession(reservations=[])
    res = client.get(f"/api/admin/guest_reservations/{uuid4()}")
    assert res.status_code == 404


def test_admin_status_updates_confirm_and_cancel():
    reservation = _reservation(status="pending")
    session = DummySession(reservations=[reservation])
    app.dependency_overrides[get_session] = lambda: session

    res = client.post(
        f"/api/admin/guest_reservations/{reservation.id}/status",
        json={"status": "confirmed"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "confirmed"

    res2 = client.post(
        f"/api/admin/guest_reservations/{reservation.id}/status",
        json={"status": "cancelled", "reason": "admin cancelled"},
    )
    assert res2.status_code == 200
    assert res2.json()["status"] == "cancelled"


def test_admin_status_cancel_idempotent():
    reservation = _reservation(status="cancelled")
    session = DummySession(reservations=[reservation])
    app.dependency_overrides[get_session] = lambda: session

    res = client.post(
        f"/api/admin/guest_reservations/{reservation.id}/status",
        json={"status": "cancelled"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


def test_admin_status_invalid_transition_and_value():
    reservation = _reservation(status="cancelled")
    session = DummySession(reservations=[reservation])
    app.dependency_overrides[get_session] = lambda: session

    bad_status = client.post(
        f"/api/admin/guest_reservations/{reservation.id}/status",
        json={"status": "unknown"},
    )
    assert bad_status.status_code == 400

    invalid_transition = client.post(
        f"/api/admin/guest_reservations/{reservation.id}/status",
        json={"status": "confirmed"},
    )
    assert invalid_transition.status_code == 400
