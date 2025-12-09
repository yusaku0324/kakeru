from __future__ import annotations

from fastapi import APIRouter, Depends

from ...deps import audit_admin, require_admin
from ... import meili
from .profiles_router import (
    router as profiles_router,
    reindex_all as profiles_reindex_all,
)
from .reservations_router import router as reservations_router
from .reviews_router import router as reviews_router
from .therapist_shifts_api import router as therapist_shifts_router
from .shop_dashboard_api import router as shop_dashboard_router
from .shops_api import router as shops_router
from .guest_reservations_api import router as guest_reservations_router
from .therapists_api import router as therapists_router

router = APIRouter(dependencies=[Depends(require_admin), Depends(audit_admin)])
router.include_router(profiles_router)
router.include_router(reservations_router)
router.include_router(reviews_router)
router.include_router(therapist_shifts_router)
router.include_router(shops_router)
router.include_router(guest_reservations_router)
router.include_router(therapists_router)
router.include_router(shop_dashboard_router)

reindex_all = profiles_reindex_all


def purge_all() -> None:
    """Purge all documents from Meilisearch index."""
    meili.purge_all()


def index_bulk(docs: list[dict]) -> None:
    """Bulk index documents to Meilisearch."""
    meili.index_bulk(docs)


__all__ = ["router", "purge_all", "index_bulk", "reindex_all"]
