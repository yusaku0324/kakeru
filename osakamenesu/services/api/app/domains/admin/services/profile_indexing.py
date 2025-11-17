from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models
from ....meili import index_profile
from ....utils.datetime import now_jst
from ....utils.profiles import build_profile_doc

logger = logging.getLogger("app.admin.profile_indexing")


async def reindex_profile_contact(*, db: AsyncSession, profile: models.Profile) -> None:
    doc = await build_profile_document(db=db, profile=profile)
    try:
        index_profile(doc)
    except Exception:  # pragma: no cover
        logger.exception("Failed to reindex profile %s", profile.id)


async def build_profile_document(
    *, db: AsyncSession, profile: models.Profile
) -> dict[str, Any]:
    today = now_jst().date()
    res_today = await db.execute(
        select(func.count())
        .select_from(models.Availability)
        .where(
            models.Availability.profile_id == profile.id,
            models.Availability.date == today,
        )
    )
    count_today = res_today.scalar_one()
    has_today = (count_today or 0) > 0
    res_out = await db.execute(
        select(models.Outlink).where(models.Outlink.profile_id == profile.id)
    )
    outlinks = list(res_out.scalars().all())
    return build_profile_doc(
        profile,
        today=has_today,
        tag_score=0.0,
        ctr7d=0.0,
        outlinks=outlinks,
    )


__all__ = ["reindex_profile_contact", "build_profile_document"]
