import os
import uuid
from datetime import UTC, date, datetime

import anyio
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, text
from sqlalchemy.exc import OperationalError


for key in [
    "PROJECT_NAME",
    "project_name",
    "POSTGRES_USER",
    "postgres_user",
    "POSTGRES_PASSWORD",
    "postgres_password",
    "POSTGRES_DB",
    "postgres_db",
    "POSTGRES_HOST",
    "postgres_host",
    "POSTGRES_PORT",
    "postgres_port",
    "API_PORT",
    "api_port",
    "API_HOST",
    "api_host",
    "NEXT_PUBLIC_API_BASE",
    "next_public_api_base",
    "API_INTERNAL_BASE",
    "api_internal_base",
    "ADMIN_BASIC_USER",
    "admin_basic_user",
    "ADMIN_BASIC_PASS",
    "admin_basic_pass",
]:
    os.environ.pop(key, None)


from app import models
from app.db import SessionLocal
from app.main import app


os.environ.setdefault("ANYIO_BACKEND", "asyncio")


pytestmark = [pytest.mark.integration]


def _ensure_local_db_available() -> None:
    async def _ping() -> None:
        try:
            async with SessionLocal() as session:
                await session.execute(text("SELECT 1"))
        except OperationalError as exc:  # pragma: no cover - network path
            raise RuntimeError("postgres unavailable") from exc

    try:
        anyio.run(_ping)
    except Exception as exc:  # pragma: no cover - skip condition
        pytestmark.append(pytest.mark.skip(reason=f"requires local Postgres: {exc}"))


_ensure_local_db_available()


async def _reset_database() -> None:
    async with SessionLocal() as session:
        for table in (models.Availability, models.Outlink, models.Profile):
            await session.execute(delete(table))
        await session.commit()


async def _seed_profile_with_today_slots() -> tuple[
    uuid.UUID, str, dict[str, list[dict[str, str]]]
]:
    today = date.today()
    today_iso = today.isoformat()
    slots_json = {
        "slots": [
            {
                "start_at": f"{today_iso}T10:00:00",
                "end_at": f"{today_iso}T11:30:00",
                "status": "open",
            },
            {
                "start_at": f"{today_iso}T13:00:00",
                "end_at": f"{today_iso}T14:00:00",
                "status": "tentative",
            },
        ]
    }

    profile = models.Profile(
        id=uuid.uuid4(),
        slug="iyashi-salon-b",
        name="癒しサロンB",
        area="梅田/北新地",
        price_min=15000,
        price_max=21000,
        bust_tag="E",
        service_type="store",
        height_cm=162,
        age=26,
        body_tags=["relax", "soothe"],
        photos=["https://example.com/detail-photo.jpg"],
        contact_json={
            "store_name": "癒しサロンB",
            "website_url": "https://salon.example.jp",
        },
        discounts=[
            {
                "label": "WEB予約割",
                "description": "ネット予約で1,000円OFF",
            }
        ],
        ranking_badges=["注目店"],
        ranking_weight=80,
        status="published",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    availability = models.Availability(
        id=uuid.uuid4(),
        profile_id=profile.id,
        date=today,
        slots_json=slots_json,
        is_today=True,
    )

    outlink_specs = [
        {
            "kind": "web",
            "token": "web-token",
            "target_url": "https://salon.example.jp",
        },
        {
            "kind": "line",
            "token": "line-token",
            "target_url": "https://line.me/ti/p/abcd",
        },
    ]
    outlinks = [
        models.Outlink(
            id=uuid.uuid4(),
            profile_id=profile.id,
            kind=spec["kind"],
            token=spec["token"],
            target_url=spec["target_url"],
            utm=None,
        )
        for spec in outlink_specs
    ]

    async with SessionLocal() as session:
        session.add(profile)
        await session.flush()
        session.add(availability)
        for outlink in outlinks:
            session.add(outlink)
        await session.commit()

    return profile.id, profile.slug or "", slots_json


def _expected_payload(profile_id: uuid.UUID, slug: str, slots_json: dict) -> dict:
    today_iso = date.today().isoformat()
    expected_outlinks = sorted(
        [
            {"kind": "line", "token": "line-token"},
            {"kind": "web", "token": "web-token"},
        ],
        key=lambda item: item["kind"],
    )
    return {
        "id": str(profile_id),
        "slug": slug,
        "name": "癒しサロンB",
        "area": "梅田/北新地",
        "price_min": 15000,
        "price_max": 21000,
        "bust_tag": "E",
        "service_type": "store",
        "store_name": "癒しサロンB",
        "height_cm": 162,
        "age": 26,
        "body_tags": ["relax", "soothe"],
        "photos": ["https://example.com/detail-photo.jpg"],
        "discounts": [
            {
                "label": "WEB予約割",
                "description": "ネット予約で1,000円OFF",
            }
        ],
        "ranking_badges": ["注目店"],
        "ranking_weight": 80,
        "status": "published",
        "today": True,
        "availability_today": {
            "date": today_iso,
            "is_today": True,
            "slots_json": slots_json,
        },
        "outlinks": expected_outlinks,
    }


@pytest.mark.anyio("asyncio")
async def test_profile_detail_contract_matches_clients(anyio_backend_name: str) -> None:
    if anyio_backend_name != "asyncio":
        pytest.skip("test requires asyncio backend")

    await _reset_database()
    profile_id, slug, slots_json = await _seed_profile_with_today_slots()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        by_id = await client.get(f"/api/profiles/{profile_id}")
        by_slug = await client.get(f"/api/profiles/{slug}")

    assert by_id.status_code == 200
    assert by_slug.status_code == 200

    payload = by_id.json()
    assert by_slug.json() == payload

    canonical = dict(payload)
    canonical["outlinks"] = sorted(payload["outlinks"], key=lambda item: item["kind"])
    assert canonical == _expected_payload(profile_id, slug, slots_json)
