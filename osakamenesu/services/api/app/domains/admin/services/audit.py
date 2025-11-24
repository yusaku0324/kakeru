from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models


@dataclass(frozen=True)
class AdminAuditContext:
    ip_hash: str | None = None
    admin_key_hash: str | None = None


def build_admin_audit_context(
    *, ip: str | None, admin_key: str | None
) -> AdminAuditContext:
    ip_hash = hashlib.sha256(ip.encode("utf-8")).hexdigest() if ip else None
    key_hash = (
        hashlib.sha256(admin_key.encode("utf-8")).hexdigest() if admin_key else None
    )
    return AdminAuditContext(ip_hash=ip_hash, admin_key_hash=key_hash)


async def record_change(
    db: AsyncSession,
    *,
    context: AdminAuditContext | None,
    target_type: str,
    target_id: Any,
    action: str,
    before: Any,
    after: Any,
) -> None:
    """Persist admin change log without blocking primary flow."""

    try:
        log = models.AdminChangeLog(
            target_type=target_type,
            target_id=target_id,
            action=action,
            before_json=jsonable_encoder(before) if before is not None else None,
            after_json=jsonable_encoder(after) if after is not None else None,
            admin_key_hash=context.admin_key_hash if context else None,
            ip_hash=context.ip_hash if context else None,
        )
        db.add(log)
        await db.commit()
    except Exception:
        # Never block on audit logging
        pass


__all__ = ["AdminAuditContext", "build_admin_audit_context", "record_change"]
