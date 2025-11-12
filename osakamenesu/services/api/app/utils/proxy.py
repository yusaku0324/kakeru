from __future__ import annotations

import hmac
import time
from hashlib import sha256

from fastapi import Depends, HTTPException, Request, status

from ..settings import settings

SIGNATURE_HEADER = "x-osakamenesu-signature"
TIMESTAMP_HEADER = "x-osakamenesu-signature-ts"
MAX_SKEW_SECONDS = 300


def _build_payload(request: Request, timestamp: str) -> str:
    path = request.url.path
    query = request.url.query
    method = request.method.upper()
    return f"{timestamp}:{method}:{path}{f'?{query}' if query else ''}"


def verify_proxy_signature(request: Request) -> None:
    secret = settings.proxy_shared_secret
    if not secret:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="proxy_signature_not_configured",
        )

    signature = request.headers.get(SIGNATURE_HEADER)
    timestamp = request.headers.get(TIMESTAMP_HEADER)

    if not signature or not timestamp:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="proxy_signature_missing",
        )

    try:
        timestamp_value = int(timestamp)
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="proxy_signature_invalid_timestamp",
        ) from exc

    now = int(time.time())
    if abs(now - timestamp_value) > MAX_SKEW_SECONDS:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="proxy_signature_expired",
        )

    payload = _build_payload(request, timestamp)
    expected = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), sha256).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="proxy_signature_invalid",
        )


async def require_proxy_signature(request: Request) -> None:
    verify_proxy_signature(request)


ProxySignatureDependency = Depends(require_proxy_signature)

