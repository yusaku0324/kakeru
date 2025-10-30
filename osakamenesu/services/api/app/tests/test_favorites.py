import os
import sys
import uuid
from datetime import datetime, UTC, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Dict, Iterable, List, Optional, Tuple

import pytest
from sqlalchemy.exc import IntegrityError


ROOT = Path(__file__).resolve().parents[4]
os.chdir(ROOT)
sys.path.insert(0, str(ROOT / "services" / "api"))

for key in [
    "PROJECT_NAME",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "POSTGRES_HOST",
    "POSTGRES_PORT",
    "API_PORT",
    "API_HOST",
    "NEXT_PUBLIC_API_BASE",
    "API_INTERNAL_BASE",
]:
    os.environ.pop(key, None)

import types

dummy_settings_module = types.ModuleType("app.settings")


class _DummySettings:
    def __init__(self) -> None:
        self.database_url = "postgresql+asyncpg://app:app@localhost:5432/osaka_menesu"
        self.api_origin = "http://localhost:3000"
        self.api_public_base_url = "http://localhost:8000"
        self.meili_host = "http://127.0.0.1:7700"
        self.meili_master_key = "dev_key"
        self.admin_api_key = "dev_admin_key"
        self.rate_limit_redis_url = None
        self.rate_limit_namespace = "test"
        self.rate_limit_redis_error_cooldown = 0.0
        self.init_db_on_startup = False
        self.slack_webhook_url = None
        self.notify_email_endpoint = None
        self.notify_line_endpoint = None
        self.notify_from_email = None
        self.mail_api_key = "test-mail-key"
        self.mail_from_address = "no-reply@example.com"
        self.mail_provider_base_url = "https://api.resend.com"
        self.dashboard_session_cookie_name = "osakamenesu_session"
        self.site_session_cookie_name = "osakamenesu_session"
        self.reservation_notification_max_attempts = 3
        self.reservation_notification_retry_base_seconds = 1
        self.reservation_notification_retry_backoff_multiplier = 2.0
        self.reservation_notification_worker_interval_seconds = 1.0
        self.reservation_notification_batch_size = 10


dummy_settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
dummy_settings_module.settings = _DummySettings()
sys.modules.setdefault("app.settings", dummy_settings_module)

from app import models  # type: ignore  # noqa: E402
from app.domains.site import favorites_router as favorites  # type: ignore  # noqa: E402
from app.schemas import TherapistFavoriteCreate  # type: ignore  # noqa: E402


def _now(offset_minutes: int = 0) -> datetime:
    return datetime.now(UTC) + timedelta(minutes=offset_minutes)


class FakeScalarResult:
    def __init__(self, items: Iterable[object]):
        self._items = list(items)

    def all(self) -> List[object]:
        return list(self._items)


class FakeResult:
    def __init__(self, items: Iterable[object]):
        self._items = list(items)

    def scalars(self) -> FakeScalarResult:
        return FakeScalarResult(self._items)

    def scalar_one(self):
        if not self._items:
            raise AssertionError("No rows returned")
        return self._items[0]

    def all(self) -> List[object]:
        return list(self._items)


class FakeSession:
    def __init__(
        self,
        *,
        therapists: Iterable[models.Therapist] = (),
        favorites: Iterable[models.UserTherapistFavorite] = (),
    ) -> None:
        self.therapists: Dict[uuid.UUID, models.Therapist] = {t.id: t for t in therapists}
        self.user_therapist_favorites: Dict[Tuple[uuid.UUID, uuid.UUID], models.UserTherapistFavorite] = {
            (fav.user_id, fav.therapist_id): fav for fav in favorites
        }
        self._pending_favorite: Optional[models.UserTherapistFavorite] = None
        self._pending_key: Optional[Tuple[uuid.UUID, uuid.UUID]] = None
        self._raise_integrity = False

    async def get(self, model, pk):  # type: ignore[override]
        if model is models.Therapist:
            return self.therapists.get(pk)
        if model is models.Profile:
            # Profiles are not required for therapist favorites in these tests
            return None
        return None

    def add(self, instance):  # type: ignore[override]
        if isinstance(instance, models.UserTherapistFavorite):
            key = (instance.user_id, instance.therapist_id)
            self._pending_favorite = instance
            self._pending_key = key
            self._raise_integrity = key in self.user_therapist_favorites

    async def commit(self) -> None:  # type: ignore[override]
        if self._raise_integrity:
            self._raise_integrity = False
            self._pending_favorite = None
            self._pending_key = None
            raise IntegrityError("duplicate", params=None, orig=None)

        if self._pending_favorite is not None and self._pending_key is not None:
            favorite = self._pending_favorite
            if getattr(favorite, "created_at", None) is None:
                favorite.created_at = _now()
            self.user_therapist_favorites[self._pending_key] = favorite

        self._pending_favorite = None
        self._pending_key = None

    async def rollback(self) -> None:  # type: ignore[override]
        self._pending_favorite = None
        self._pending_key = None
        self._raise_integrity = False

    async def refresh(self, instance):  # type: ignore[override]
        if isinstance(instance, models.UserTherapistFavorite) and getattr(instance, "created_at", None) is None:
            instance.created_at = _now()

    async def execute(self, stmt):  # type: ignore[override]
        if hasattr(stmt, "column_descriptions") and stmt.column_descriptions:
            desc = stmt.column_descriptions[0]
            entity = desc.get("entity")

            if entity is models.UserTherapistFavorite:
                favorites = list(self.user_therapist_favorites.values())
                user_id: Optional[uuid.UUID] = None
                therapist_id: Optional[uuid.UUID] = None

                for criterion in getattr(stmt, "_where_criteria", []):
                    left = getattr(criterion, "left", None)
                    right = getattr(criterion, "right", None)
                    name = getattr(left, "name", None)
                    value = getattr(right, "value", None)
                    if name == "user_id":
                        user_id = uuid.UUID(str(value))
                    elif name == "therapist_id":
                        therapist_id = uuid.UUID(str(value))

                if user_id is not None:
                    favorites = [fav for fav in favorites if fav.user_id == user_id]
                if therapist_id is not None:
                    favorites = [fav for fav in favorites if fav.therapist_id == therapist_id]

                orderings = getattr(stmt, "_order_by_clauses", [])
                for order_clause in orderings:
                    target = getattr(order_clause, "element", None)
                    direction = getattr(order_clause, "direction", None)
                    if getattr(target, "name", None) == "created_at" and getattr(direction, "name", "").lower() == "desc":
                        favorites = sorted(favorites, key=lambda fav: fav.created_at, reverse=True)

                return FakeResult(favorites)

        raw_columns = getattr(stmt, "_raw_columns", [])
        if raw_columns:
            names = [getattr(col, "name", None) for col in raw_columns]
            if names == ["id", "profile_id"]:
                ids: Optional[Iterable[uuid.UUID]] = None
                for criterion in getattr(stmt, "_where_criteria", []):
                    left = getattr(criterion, "left", None)
                    if getattr(left, "name", None) == "id":
                        values = getattr(criterion.right, "value", None)
                        if isinstance(values, (list, tuple, set)):
                            ids = [uuid.UUID(str(item)) for item in values]
                        elif values is not None:
                            ids = [uuid.UUID(str(values))]

                target_ids = set(ids or self.therapists.keys())
                rows = []
                for therapist_id, therapist in self.therapists.items():
                    if therapist_id in target_ids:
                        rows.append(SimpleNamespace(id=therapist_id, profile_id=therapist.profile_id))
                return FakeResult(rows)

        if hasattr(stmt, "table") and getattr(stmt.table, "name", None) == "user_therapist_favorites":
            user_id: Optional[uuid.UUID] = None
            therapist_id: Optional[uuid.UUID] = None
            for criterion in getattr(stmt, "_where_criteria", []):
                left = getattr(criterion, "left", None)
                right = getattr(criterion, "right", None)
                name = getattr(left, "name", None)
                value = getattr(right, "value", None)
                if name == "user_id":
                    user_id = uuid.UUID(str(value))
                elif name == "therapist_id":
                    therapist_id = uuid.UUID(str(value))

            if user_id is not None and therapist_id is not None:
                self.user_therapist_favorites.pop((user_id, therapist_id), None)
            return None

        raise AssertionError(f"Unhandled statement: {stmt}")


def _make_user() -> models.User:
    now = _now()
    return models.User(
        id=uuid.uuid4(),
        email="user@example.com",
        status="active",
        created_at=now,
        updated_at=now,
    )


def _make_therapist(profile_id: uuid.UUID) -> models.Therapist:
    now = _now()
    return models.Therapist(
        id=uuid.uuid4(),
        profile_id=profile_id,
        name="セラピストA",
        alias=None,
        headline=None,
        biography=None,
        specialties=None,
        qualifications=None,
        experience_years=None,
        photo_urls=None,
        display_order=0,
        status="published",
        is_booking_enabled=True,
        created_at=now,
        updated_at=now,
    )


def _make_favorite(user_id: uuid.UUID, therapist: models.Therapist, created_at: datetime) -> models.UserTherapistFavorite:
    return models.UserTherapistFavorite(
        id=uuid.uuid4(),
        user_id=user_id,
        therapist_id=therapist.id,
        created_at=created_at,
    )


@pytest.mark.anyio
async def test_list_therapist_favorites_returns_items():
    user = _make_user()
    profile_id = uuid.uuid4()
    therapist = _make_therapist(profile_id)
    existing = _make_favorite(user.id, therapist, _now(-10))

    session = FakeSession(therapists=[therapist], favorites=[existing])

    result = await favorites.list_therapist_favorites(user=user, db=session)

    assert len(result) == 1
    assert result[0].therapist_id == therapist.id
    assert result[0].shop_id == profile_id


@pytest.mark.anyio
async def test_add_therapist_favorite_creates_record():
    user = _make_user()
    profile_id = uuid.uuid4()
    therapist = _make_therapist(profile_id)

    session = FakeSession(therapists=[therapist])
    payload = TherapistFavoriteCreate(therapist_id=therapist.id)

    item = await favorites.add_therapist_favorite(payload=payload, user=user, db=session)

    assert item.therapist_id == therapist.id
    assert item.shop_id == profile_id
    assert (user.id, therapist.id) in session.user_therapist_favorites


@pytest.mark.anyio
async def test_add_therapist_favorite_returns_existing_on_duplicate():
    user = _make_user()
    profile_id = uuid.uuid4()
    therapist = _make_therapist(profile_id)
    existing = _make_favorite(user.id, therapist, _now(-5))

    session = FakeSession(therapists=[therapist], favorites=[existing])
    payload = TherapistFavoriteCreate(therapist_id=therapist.id)

    item = await favorites.add_therapist_favorite(payload=payload, user=user, db=session)

    assert item.therapist_id == therapist.id
    assert item.shop_id == profile_id
    # Ensure duplicate was not added
    stored = session.user_therapist_favorites[(user.id, therapist.id)]
    assert stored.created_at == existing.created_at


@pytest.mark.anyio
async def test_add_therapist_favorite_missing_therapist_raises():
    user = _make_user()
    session = FakeSession()
    payload = TherapistFavoriteCreate(therapist_id=uuid.uuid4())

    with pytest.raises(favorites.HTTPException) as exc:
        await favorites.add_therapist_favorite(payload=payload, user=user, db=session)

    assert exc.value.status_code == favorites.status.HTTP_404_NOT_FOUND
    assert exc.value.detail == "therapist_not_found"


@pytest.mark.anyio
async def test_remove_therapist_favorite_deletes_record():
    user = _make_user()
    profile_id = uuid.uuid4()
    therapist = _make_therapist(profile_id)
    existing = _make_favorite(user.id, therapist, _now(-1))

    session = FakeSession(therapists=[therapist], favorites=[existing])

    await favorites.remove_therapist_favorite(therapist_id=therapist.id, user=user, db=session)

    assert (user.id, therapist.id) not in session.user_therapist_favorites
