from __future__ import annotations

from fastapi import APIRouter, Depends

from ...deps import audit_admin, require_admin
from .profiles_router import router as profiles_router
from .reservations_router import router as reservations_router
from .reviews_router import router as reviews_router

router = APIRouter(dependencies=[Depends(require_admin), Depends(audit_admin)])
router.include_router(profiles_router)
router.include_router(reservations_router)
router.include_router(reviews_router)

__all__ = ["router"]
