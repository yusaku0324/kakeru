import importlib
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ops_router_module = importlib.import_module("app.domains.ops.router")
from app.domains.ops.router import router as ops_router, require_ops_token
from app.schemas import OpsOutboxChannelSummary, OpsOutboxSummary, OpsQueueStats, OpsSlotsSummary
from app.db import get_session


@pytest.fixture
def client(monkeypatch):
    app = FastAPI()
    app.include_router(ops_router)

    def _noop_token():
        return None

    app.dependency_overrides[require_ops_token] = _noop_token

    async def _fake_session():
        class DummySession:
            pass

        yield DummySession()

    app.dependency_overrides[get_session] = _fake_session
    return TestClient(app)


def test_get_ops_queue_returns_stub(monkeypatch, client):
    expected = OpsQueueStats(
        pending=3,
        lag_seconds=12.5,
        oldest_created_at=None,
        next_attempt_at=None,
    )

    async def _fake_stats(db):
        return expected

    monkeypatch.setattr(ops_router_module, "_get_queue_stats", _fake_stats)
    response = client.get("/api/ops/queue")
    assert response.status_code == 200
    assert response.json() == expected.model_dump(mode="json")


def test_get_ops_outbox_returns_channels(monkeypatch, client):
    expected = OpsOutboxSummary(
        channels=[
            OpsOutboxChannelSummary(channel="email", pending=2),
            OpsOutboxChannelSummary(channel="slack", pending=1),
        ]
    )

    async def _fake_summary(db):
        return expected

    monkeypatch.setattr(ops_router_module, "_get_outbox_summary", _fake_summary)
    response = client.get("/api/ops/outbox")
    assert response.status_code == 200
    assert response.json() == expected.model_dump()


def test_get_ops_slots_returns_window(monkeypatch, client):
    expected = OpsSlotsSummary(
        pending_total=5,
        pending_stale=1,
        confirmed_next_24h=4,
        window_start=datetime(2025, 11, 8, 12, 0, tzinfo=timezone.utc),
        window_end=datetime(2025, 11, 9, 12, 0, tzinfo=timezone.utc),
    )

    async def _fake_slots(db):
        return expected

    monkeypatch.setattr(ops_router_module, "_get_slots_summary", _fake_slots)
    response = client.get("/api/ops/slots")
    assert response.status_code == 200
    assert response.json() == expected.model_dump(mode="json")
