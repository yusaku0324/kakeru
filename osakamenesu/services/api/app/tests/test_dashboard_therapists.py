import io
import os
import sys
import types
import uuid
from datetime import datetime, UTC
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status  # type: ignore
from starlette.datastructures import Headers, UploadFile

ROOT = Path(__file__).resolve().parents[4]
os.chdir(ROOT)
sys.path.insert(0, str(ROOT / "services" / "api"))

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
        self.escalation_pending_threshold_minutes = 30
        self.escalation_check_interval_minutes = 5
        self.notify_from_email = None
        self.mail_api_key = "test-mail-key"
        self.mail_from_address = "no-reply@example.com"
        self.mail_provider_base_url = "https://api.resend.com"
        self.reservation_notification_max_attempts = 3
        self.reservation_notification_retry_base_seconds = 1
        self.reservation_notification_retry_backoff_multiplier = 2.0
        self.reservation_notification_worker_interval_seconds = 1.0
        self.reservation_notification_batch_size = 10
        self.dashboard_session_cookie_name = "osakamenesu_session"
        self.site_session_cookie_name = "osakamenesu_session"
        self.site_base_url = None
        self.media_storage_backend = "local"
        self.media_local_directory = "test-media"
        self.media_url_prefix = "/media"
        self.media_cdn_base_url = None
        self.media_s3_bucket = None
        self.media_s3_region = None
        self.media_s3_endpoint = None
        self.media_s3_access_key_id = None
        self.media_s3_secret_access_key = None

    @property
    def media_root(self) -> Path:
        return Path.cwd() / self.media_local_directory


dummy_settings_module.Settings = _DummySettings  # type: ignore[attr-defined]
dummy_settings_module.settings = _DummySettings()
sys.modules.setdefault("app.settings", dummy_settings_module)

from app import models  # type: ignore  # noqa: E402
from app.domains.dashboard.therapists import router as dashboard_therapists  # type: ignore  # noqa: E402
from app.storage import StoredMedia  # type: ignore  # noqa: E402


class FakeSession:
    def __init__(self, profile: models.Profile) -> None:
        self.profile = profile
        self.committed = False
        self.added: list[models.AdminChangeLog] = []

    async def get(self, model, pk):  # type: ignore[override]
        if model is models.Profile and pk == self.profile.id:
            return self.profile
        return None

    async def commit(self) -> None:
        self.committed = True

    async def flush(self, *args, **kwargs):  # type: ignore[override]
        return None

    async def refresh(self, instance):  # type: ignore[override]
        return None

    def add(self, instance):  # type: ignore[override]
        self.added.append(instance)


class FakeRequest:
    def __init__(self) -> None:
        self.headers: dict[str, str] = {}
        self.client = SimpleNamespace(host="127.0.0.1")


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
    mime, extension = dashboard_therapists._detect_image_type("photo.png", "image/png", payload)  # type: ignore[attr-defined]
    assert mime == "image/png"
    assert extension == ".png"


def test_detect_image_type_rejects_unknown():
    with pytest.raises(HTTPException) as exc:
        dashboard_therapists._detect_image_type("memo.txt", "text/plain", b"hello")  # type: ignore[attr-defined]
    assert exc.value.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE


@pytest.mark.anyio
async def test_upload_dashboard_therapist_photo_saves_image(monkeypatch, tmp_path):
    now = datetime.now(UTC)
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
    session = FakeSession(profile)

    class DummyStorage:
        def __init__(self) -> None:
            self.calls: list[dict[str, str]] = []

        async def save_photo(self, *, folder: str, filename: str, content: bytes, content_type: str) -> StoredMedia:
            self.calls.append({"folder": folder, "filename": filename, "content_type": content_type})
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
    upload = UploadFile(file=io.BytesIO(payload), filename="photo.png", headers=Headers({"content-type": "image/png"}))

    response = await dashboard_therapists.upload_dashboard_therapist_photo(  # type: ignore[attr-defined]
        request=FakeRequest(),
        profile_id=profile.id,
        file=upload,
        db=session,
        user=SimpleNamespace(id=uuid.uuid4()),
    )

    assert response.content_type == "image/png"
    assert response.size == len(payload)
    assert response.url.endswith(response.filename)
    assert storage.calls[0]["folder"] == f"therapists/{profile.id}"
    assert session.committed is True
    assert any(isinstance(item, models.AdminChangeLog) and item.action == "upload_photo" for item in session.added)


@pytest.mark.anyio
async def test_upload_dashboard_therapist_photo_rejects_large_file():
    now = datetime.now(UTC)
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
    session = FakeSession(profile)

    payload = b"\x00" * (dashboard_therapists.MAX_PHOTO_BYTES + 1)  # type: ignore[attr-defined]
    upload = UploadFile(file=io.BytesIO(payload), filename="photo.png", headers=Headers({"content-type": "image/png"}))

    with pytest.raises(HTTPException) as exc:
        await dashboard_therapists.upload_dashboard_therapist_photo(  # type: ignore[attr-defined]
            request=FakeRequest(),
            profile_id=profile.id,
            file=upload,
            db=session,
            user=SimpleNamespace(id=uuid.uuid4()),
        )

    assert exc.value.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
