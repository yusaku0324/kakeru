from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Protocol
from urllib.parse import quote

from .settings import Settings, settings


class MediaStorageError(Exception):
    """Raised when media storage cannot persist a file."""


@dataclass
class StoredMedia:
    key: str
    url: str
    content_type: str
    size: int
    path: Optional[Path] = None


class StorageBackend(Protocol):
    async def save(self, *, folder: str, filename: str, content: bytes, content_type: str) -> StoredMedia:
        ...


class LocalMediaStorage:
    def __init__(
        self,
        root: Path,
        url_prefix: str,
        cdn_base_url: Optional[str],
        public_origin: Optional[str],
    ) -> None:
        self._root = root
        normalized_prefix = (url_prefix or "").strip() or "/media"
        if not normalized_prefix.startswith("/"):
            normalized_prefix = f"/{normalized_prefix}"
        self._url_prefix = normalized_prefix.rstrip("/") or "/media"
        self._cdn_base_url = cdn_base_url.rstrip("/") if cdn_base_url else None
        self._public_origin = public_origin.rstrip("/") if public_origin else None

    async def save(self, *, folder: str, filename: str, content: bytes, content_type: str) -> StoredMedia:
        parts = [segment for segment in folder.split("/") if segment and segment not in (".", "..")]
        destination = self._root.joinpath(*parts)
        await asyncio.to_thread(destination.mkdir, parents=True, exist_ok=True)
        file_path = destination / filename
        await asyncio.to_thread(file_path.write_bytes, content)

        if self._cdn_base_url:
            base_url = self._cdn_base_url
        elif self._public_origin:
            base_url = f"{self._public_origin}{self._url_prefix}"
        else:
            base_url = self._url_prefix
        plain_folder = "/".join(parts)
        quoted_folder = "/".join(quote(part) for part in parts)
        if quoted_folder:
            url = f"{base_url.rstrip('/')}/{quoted_folder}/{quote(filename)}"
            key = f"{plain_folder}/{filename}"
        else:
            url = f"{base_url.rstrip('/')}/{quote(filename)}"
            key = filename
        return StoredMedia(
            key=key,
            url=url,
            content_type=content_type,
            size=len(content),
            path=file_path,
        )


class S3MediaStorage:
    def __init__(
        self,
        *,
        bucket: str,
        region: Optional[str],
        base_url: Optional[str],
        endpoint_url: Optional[str],
        access_key_id: Optional[str],
        secret_access_key: Optional[str],
    ) -> None:
        try:
            import boto3
            from botocore.exceptions import BotoCoreError, ClientError
        except ImportError as exc:  # pragma: no cover - safety net
            raise RuntimeError("boto3 is required for S3 media storage") from exc

        self._bucket = bucket
        self._region = region
        self._base_url = base_url.rstrip("/") if base_url else None
        self._boto_errors = (BotoCoreError, ClientError)

        self._client = boto3.client(
            "s3",
            region_name=region,
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )

    async def save(self, *, folder: str, filename: str, content: bytes, content_type: str) -> StoredMedia:
        key = f"{folder.strip('/')}/{filename}"
        try:
            await asyncio.to_thread(
                self._client.put_object,
                Bucket=self._bucket,
                Key=key,
                Body=content,
                ContentType=content_type,
            )
        except self._boto_errors as exc:  # pragma: no cover - depends on AWS connectivity
            raise MediaStorageError(str(exc)) from exc

        if self._base_url:
            url = f"{self._base_url}/{key}"
        else:
            if self._region:
                url = f"https://{self._bucket}.s3.{self._region}.amazonaws.com/{key}"
            else:
                url = f"https://{self._bucket}.s3.amazonaws.com/{key}"

        return StoredMedia(
            key=key,
            url=url,
            content_type=content_type,
            size=len(content),
            path=None,
        )


class MediaStorage:
    def __init__(self, backend: StorageBackend) -> None:
        self._backend = backend

    @classmethod
    def from_settings(cls, config: Settings) -> "MediaStorage":
        backend_name = (config.media_storage_backend or "local").strip().lower()
        if backend_name == "local":
            root = config.media_root
            backend = LocalMediaStorage(
                root=root,
                url_prefix=config.media_url_prefix,
                cdn_base_url=config.media_cdn_base_url,
                public_origin=config.api_origin,
            )
            return cls(backend)
        if backend_name == "s3":
            if not config.media_s3_bucket:
                raise RuntimeError("MEDIA_S3_BUCKET must be set when MEDIA_STORAGE_BACKEND=s3")
            backend = S3MediaStorage(
                bucket=config.media_s3_bucket,
                region=config.media_s3_region,
                base_url=config.media_cdn_base_url,
                endpoint_url=config.media_s3_endpoint,
                access_key_id=config.media_s3_access_key_id,
                secret_access_key=config.media_s3_secret_access_key,
            )
            return cls(backend)
        raise RuntimeError(f"Unsupported media storage backend: {backend_name}")

    async def save_photo(self, *, folder: str, filename: str, content: bytes, content_type: str) -> StoredMedia:
        try:
            return await self._backend.save(folder=folder, filename=filename, content=content, content_type=content_type)
        except MediaStorageError:
            raise
        except Exception as exc:  # pragma: no cover - defensive
            raise MediaStorageError(str(exc)) from exc


_storage: Optional[MediaStorage] = None


def get_media_storage() -> MediaStorage:
    global _storage
    if _storage is None:
        _storage = MediaStorage.from_settings(settings)
    return _storage
