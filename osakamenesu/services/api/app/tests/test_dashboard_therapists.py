import io
import os
import sys
import uuid
from datetime import datetime, UTC
from pathlib import Path

_HELPER_DIR = Path(__file__).resolve().parent
if str(_HELPER_DIR) not in sys.path:
    sys.path.insert(0, str(_HELPER_DIR))

from _path_setup import configure_paths
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status  # type: ignore
from starlette.datastructures import Headers, UploadFile

ROOT = configure_paths(Path(__file__))

# Import fixtures first (this sets up dummy settings)
from _dashboard_fixtures import (
    DummyShopManager,
    FakeRequest,
    FakeSession,
    setup_dummy_settings,
)

# Ensure settings are set up before importing dashboard modules
setup_dummy_settings()

import importlib
from app import models  # noqa: E402

dashboard_therapists = importlib.import_module(
    "app.domains.dashboard.therapists.router"
)  # noqa: E402
from app.storage import StoredMedia  # noqa: E402


def test_sanitize_strings_filters_blanks():
    values = ["  a  ", "", "  ", "b", None, "c "]
    result = dashboard_therapists._sanitize_strings(values)  # type: ignore[attr-defined]
    assert result == ["a", "b", "c"]


def test_serialize_and_summary_roundtrip():
    now = datetime.now(UTC)
    profile_id = uuid.uuid4()
    therapist = models.Therapist(
        id=uuid.uuid4(),
        profile_id=profile_id,
        name="佐藤 さゆり",
        alias="Sayuri",
        headline="極上癒し",
        biography="3年経験",
        specialties=["オイル", "ヘッド"],
        qualifications=["認定セラピスト"],
        experience_years=3,
        photo_urls=["https://example.com/1.jpg"],
        display_order=5,
        status="draft",
        is_booking_enabled=True,
        created_at=now,
        updated_at=now,
    )

    detail = dashboard_therapists._serialize_therapist(therapist)  # type: ignore[attr-defined]
    summary = dashboard_therapists._summary_from_detail(detail)  # type: ignore[attr-defined]

    assert summary.name == therapist.name
    assert summary.alias == therapist.alias
    assert summary.status == therapist.status
    assert summary.display_order == therapist.display_order
    assert summary.specialties == therapist.specialties
    assert detail.qualifications == therapist.qualifications


def test_detect_image_type_accepts_png():
    payload = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    mime, extension = dashboard_therapists._detect_image_type(
        "photo.png", "image/png", payload
    )  # type: ignore[attr-defined]
    assert mime == "image/png"
    assert extension == ".png"


def test_detect_image_type_rejects_unknown():
    with pytest.raises(HTTPException) as exc:
        dashboard_therapists._detect_image_type("memo.txt", "text/plain", b"hello")  # type: ignore[attr-defined]
    assert exc.value.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE


@pytest.mark.anyio
async def test_upload_dashboard_therapist_photo_saves_image(monkeypatch, tmp_path):
    now = datetime.now(UTC)
    user_id = uuid.uuid4()
    profile = models.Profile(
        id=uuid.uuid4(),
        name="アップロードテスト",
        area="梅田",
        price_min=9000,
        price_max=16000,
        bust_tag="C",
        service_type="store",
        contact_json={},
        status="draft",
        created_at=now,
        updated_at=now,
    )
    shop_manager = DummyShopManager(user_id=user_id, shop_id=profile.id)
    session = FakeSession(profile, shop_managers=[shop_manager])

    class DummyStorage:
        def __init__(self) -> None:
            self.calls: list[dict[str, str]] = []

        async def save_photo(
            self, *, folder: str, filename: str, content: bytes, content_type: str
        ) -> StoredMedia:
            self.calls.append(
                {"folder": folder, "filename": filename, "content_type": content_type}
            )
            return StoredMedia(
                key=f"{folder}/{filename}",
                url=f"https://cdn.test/{folder}/{filename}",
                content_type=content_type,
                size=len(content),
                path=tmp_path / filename,
            )

    storage = DummyStorage()
    monkeypatch.setattr(dashboard_therapists, "get_media_storage", lambda: storage)  # type: ignore[attr-defined]

    payload = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
    upload = UploadFile(
        file=io.BytesIO(payload),
        filename="photo.png",
        headers=Headers({"content-type": "image/png"}),
    )

    response = await dashboard_therapists.upload_dashboard_therapist_photo(  # type: ignore[attr-defined]
        request=FakeRequest(),
        profile_id=profile.id,
        file=upload,
        db=session,
        user=SimpleNamespace(id=user_id),
    )

    assert response.content_type == "image/png"
    assert response.size == len(payload)
    assert response.url.endswith(response.filename)
    assert storage.calls[0]["folder"] == f"therapists/{profile.id}"
    assert session.committed is True
    assert any(
        isinstance(item, models.AdminChangeLog) and item.action == "upload_photo"
        for item in session.added
    )


@pytest.mark.anyio
async def test_upload_dashboard_therapist_photo_rejects_large_file():
    now = datetime.now(UTC)
    user_id = uuid.uuid4()
    profile = models.Profile(
        id=uuid.uuid4(),
        name="サイズエラー",
        area="梅田",
        price_min=9000,
        price_max=16000,
        bust_tag="C",
        service_type="store",
        contact_json={},
        status="draft",
        created_at=now,
        updated_at=now,
    )
    shop_manager = DummyShopManager(user_id=user_id, shop_id=profile.id)
    session = FakeSession(profile, shop_managers=[shop_manager])

    payload = b"\x00" * (dashboard_therapists.MAX_PHOTO_BYTES + 1)  # type: ignore[attr-defined]
    upload = UploadFile(
        file=io.BytesIO(payload),
        filename="photo.png",
        headers=Headers({"content-type": "image/png"}),
    )

    with pytest.raises(HTTPException) as exc:
        await dashboard_therapists.upload_dashboard_therapist_photo(  # type: ignore[attr-defined]
            request=FakeRequest(),
            profile_id=profile.id,
            file=upload,
            db=session,
            user=SimpleNamespace(id=user_id),
        )

    assert exc.value.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
