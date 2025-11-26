from __future__ import annotations

from fastapi import APIRouter, Depends

from ...deps import audit_admin, require_admin
from .profiles_router import (
    router as profiles_router,
    reindex_all as profiles_reindex_all,
)
from .reservations_router import router as reservations_router
from .reviews_router import router as reviews_router
from .therapist_shifts_api import router as therapist_shifts_router

router = APIRouter(dependencies=[Depends(require_admin), Depends(audit_admin)])
router.include_router(profiles_router)
router.include_router(reservations_router)
router.include_router(reviews_router)
router.include_router(therapist_shifts_router)

reindex_all = profiles_reindex_all


async def purge_all() -> None:
    """Placeholder purge hook that can be monkeypatched in tests."""
    raise NotImplementedError("purge_all is not configured")


def index_bulk(_docs: list[dict]) -> None:
    """Placeholder bulk index hook used in tests."""
    raise NotImplementedError("index_bulk is not configured")


__all__ = ["router", "purge_all", "index_bulk", "reindex_all"]
