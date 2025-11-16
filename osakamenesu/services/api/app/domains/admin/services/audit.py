from __future__ import annotations

import hashlib
from typing import Any

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models


async def record_change(
    request: Request,
    db: AsyncSession,
    *,
    target_type: str,
    target_id: Any,
    action: str,
    before: Any,
    after: Any,
) -> None:
    """Persist admin change log without blocking primary flow."""

    try:
        ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")
        ip_hash = hashlib.sha256(ip.encode("utf-8")).hexdigest() if ip else None
        key = request.headers.get("x-admin-key")
        key_hash = hashlib.sha256(key.encode("utf-8")).hexdigest() if key else None
        log = models.AdminChangeLog(
            target_type=target_type,
            target_id=target_id,
            action=action,
            before_json=jsonable_encoder(before) if before is not None else None,
            after_json=jsonable_encoder(after) if after is not None else None,
            admin_key_hash=key_hash,
            ip_hash=ip_hash,
        )
        db.add(log)
        await db.commit()
    except Exception:
        # Never block on audit logging
        pass
