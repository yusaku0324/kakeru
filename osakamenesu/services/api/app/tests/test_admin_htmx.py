import uuid

import pytest
from fastapi.testclient import TestClient

from app.admin_htmx.views import shifts as shifts_view
from app.deps import require_admin
from app.main import app


@pytest.fixture()
def client():
    app.dependency_overrides[require_admin] = lambda: None
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        app.dependency_overrides = {}


def test_admin_htmx_shifts_renders_form(client):
    resp = client.get("/admin/htmx/shifts")

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/html")
    assert "hx-post" in resp.text
    assert 'id="error_box"' in resp.text


def test_shifts_rebuild_success_partial(client, monkeypatch):
    therapist_id = uuid.uuid4()

    class DummyTherapist:
        def __init__(self, profile_id):
            self.profile_id = profile_id

    async def _fake_get_therapist(session, _):
        return DummyTherapist(uuid.uuid4())

    monkeypatch.setattr(shifts_view, "_get_therapist", _fake_get_therapist)

    async def _fake_lock(*args, **kwargs):
        return True

    async def _fake_release(*args, **kwargs):
        return None

    monkeypatch.setattr(shifts_view, "_with_advisory_lock", _fake_lock)

    async def _fake_sync(*args, **kwargs):
        return None

    async def _fake_slots(*args, **kwargs):
        return [
            {
                "start_at": "10:00",
                "end_at": "11:00",
                "therapist_id": str(therapist_id),
                "status": "open",
            }
        ]

    monkeypatch.setattr(shifts_view, "sync_availability_for_date", _fake_sync)
    monkeypatch.setattr(shifts_view, "_get_slots_for_profile_date", _fake_slots)

    resp = client.post(
        "/admin/htmx/shifts/rebuild",
        data={"target_date": "2024-01-01", "therapist_id": str(therapist_id)},
        headers={"HX-Request": "true"},
    )

    assert resp.status_code == 200
    assert "10:00" in resp.text
    assert "open" in resp.text
    # error box cleared via oob swap
    assert 'id="error_box"' in resp.text


def test_shifts_rebuild_invalid_therapist(client):
    resp = client.post(
        "/admin/htmx/shifts/rebuild",
        data={"target_date": "2024-01-01", "therapist_id": "not-a-uuid"},
        headers={"HX-Request": "true"},
    )
    assert resp.status_code == 400
    assert "セラピストIDが不正" in resp.text


def test_shifts_rebuild_not_found_therapist(client, monkeypatch):
    async def _fake_get_therapist(*args, **kwargs):
        return None

    monkeypatch.setattr(shifts_view, "_get_therapist", _fake_get_therapist)

    resp = client.post(
        "/admin/htmx/shifts/rebuild",
        data={"target_date": "2024-01-01", "therapist_id": str(uuid.uuid4())},
        headers={"HX-Request": "true"},
    )
    assert resp.status_code == 404
    assert "セラピストが見つかりません" in resp.text


def test_shifts_rebuild_lock_conflict(client, monkeypatch):
    therapist_id = uuid.uuid4()

    async def _fake_get_therapist(session, _):
        class DummyTherapist:
            def __init__(self, profile_id):
                self.profile_id = profile_id

        return DummyTherapist(uuid.uuid4())

    async def _fake_lock(*args, **kwargs):
        return False

    monkeypatch.setattr(shifts_view, "_get_therapist", _fake_get_therapist)
    monkeypatch.setattr(shifts_view, "_with_advisory_lock", _fake_lock)

    resp = client.post(
        "/admin/htmx/shifts/rebuild",
        data={"target_date": "2024-01-01", "therapist_id": str(therapist_id)},
        headers={"HX-Request": "true"},
    )
    assert resp.status_code == 409
    assert "処理中" in resp.text


def test_shifts_rebuild_sync_exception(client, monkeypatch):
    therapist_id = uuid.uuid4()

    async def _fake_get_therapist(session, _):
        class DummyTherapist:
            def __init__(self, profile_id):
                self.profile_id = profile_id

        return DummyTherapist(uuid.uuid4())

    async def _fake_lock(*args, **kwargs):
        return True

    async def _fake_sync(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(shifts_view, "_get_therapist", _fake_get_therapist)
    monkeypatch.setattr(shifts_view, "_with_advisory_lock", _fake_lock)
    monkeypatch.setattr(shifts_view, "sync_availability_for_date", _fake_sync)

    resp = client.post(
        "/admin/htmx/shifts/rebuild",
        data={"target_date": "2024-01-01", "therapist_id": str(therapist_id)},
        headers={"HX-Request": "true"},
    )
    assert resp.status_code == 500
    assert "再生成に失敗" in resp.text
