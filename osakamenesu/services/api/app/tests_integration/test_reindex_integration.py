import os
import uuid
from datetime import date, datetime, UTC

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, text
from sqlalchemy.exc import OperationalError
import anyio

from app import models
from app.db import SessionLocal
from app.main import app
from app.meili import ensure_indexes, purge_all
from app.settings import settings


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


async def _create_profile() -> models.Profile:
    profile = models.Profile(
        id=uuid.uuid4(),
        name="体験サロンA",
        area="難波/日本橋",
        price_min=11000,
        price_max=17000,
        bust_tag="D",
        service_type="store",
        height_cm=158,
        age=24,
        body_tags=["癒し", "丁寧"],
        photos=["https://example.com/photo1.jpg"],
        contact_json={
            "store_name": "リラクゼーションA",
            "ranking_reason": "編集部ピックアップ",
            "promotions": [
                {
                    "label": "朝割キャンペーン",
                    "description": "11時までのコースが1,000円OFF",
                }
            ],
            "reviews": {
                "average_score": 4.8,
                "review_count": 8,
                "highlighted": [
                    {
                        "title": "極上の癒し",
                        "body": "接客が非常に丁寧でリピート決定",
                        "score": 5,
                        "visited_at": date.today().isoformat(),
                        "author_alias": "匿名会員",
                    }
                ],
            },
        },
        discounts=[
            {
                "label": "WEB予約割",
                "description": "ネット予約で500円OFF",
            }
        ],
        ranking_badges=["人気No.1"],
        ranking_weight=90,
        status="published",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    availability = models.Availability(
        id=uuid.uuid4(),
        profile_id=profile.id,
        date=date.today(),
        slots_json={
            "slots": [
                {
                    "start_at": f"{date.today()}T10:00:00",
                    "end_at": f"{date.today()}T11:30:00",
                    "status": "open",
                }
            ]
        },
        is_today=True,
    )

    outlink = models.Outlink(
        id=uuid.uuid4(),
        profile_id=profile.id,
        kind="web",
        token="web-token",
        target_url="https://example.com",
        utm=None,
    )

    review = models.Review(
        id=uuid.uuid4(),
        profile_id=profile.id,
        status="published",
        score=5,
        title="極上の癒し",
        body="接客が非常に丁寧でリピート決定",
        author_alias="匿名会員",
        visited_at=date.today(),
    )

    async with SessionLocal() as session:
        session.add(profile)
        await session.flush()
        session.add(availability)
        session.add(outlink)
        session.add(review)
        await session.commit()

    return profile


@pytest.mark.anyio("asyncio")
async def test_reindex_all_end_to_end(anyio_backend_name: str) -> None:
    if anyio_backend_name != "asyncio":
        pytest.skip("test requires asyncio backend")

    await _reset_database()
    purge_all()
    ensure_indexes()

    profile = await _create_profile()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/admin/reindex",
            headers={"X-Admin-Key": settings.admin_api_key},
        )
        assert resp.status_code == 200

        resp = await client.get("/api/v1/shops?page_size=5")
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["total"] >= 1
        first = payload["results"][0]
        assert first["id"] == str(profile.id)
        assert any(
            promo["label"] == "朝割キャンペーン"
            for promo in first.get("promotions", [])
        )
        assert first.get("rating") == pytest.approx(5.0)
        assert first.get("ranking_reason") == "編集部ピックアップ"

        # Submit a user review (pending by default)
        create_resp = await client.post(
            f"/api/v1/shops/{profile.id}/reviews",
            json={
                "score": 4,
                "title": "良かったです",
                "body": "手技が丁寧でまたお願いしたいです",
                "author_alias": "体験ユーザー",
                "visited_at": date.today().isoformat(),
            },
        )
        assert create_resp.status_code == 201
        created_review = create_resp.json()
        assert created_review["status"] == "pending"

        # Publish the review via admin API
        resp = await client.patch(
            f"/api/admin/reviews/{created_review['id']}",
            headers={"X-Admin-Key": settings.admin_api_key},
            json={"status": "published"},
        )
        assert resp.status_code == 200

        # Reindex to reflect updated review aggregates in search
        resp = await client.post(
            "/api/admin/reindex",
            headers={"X-Admin-Key": settings.admin_api_key},
        )
        assert resp.status_code == 200

        # Listing reviews should include both published items
        resp = await client.get(f"/api/v1/shops/{profile.id}/reviews")
        assert resp.status_code == 200
        review_list = resp.json()
        assert review_list["total"] == 2

        # Detail view reflects updated averages
        resp = await client.get(f"/api/v1/shops/{profile.id}")
        assert resp.status_code == 200
        detail = resp.json()
        assert detail["reviews"]["review_count"] == 2
        assert detail["reviews"]["average_score"] == pytest.approx(4.5, rel=1e-3)

        # Search results reflect new aggregated rating
        resp = await client.get("/api/v1/shops?page_size=5")
        assert resp.status_code == 200
        payload = resp.json()
        first = payload["results"][0]
        assert first["review_count"] == 2
        assert first["rating"] == pytest.approx(4.5, rel=1e-3)

    purge_all()
