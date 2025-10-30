"""Dashboard-facing domain modules."""

from .notifications import router as notifications_router
from .shops import router as shops_router
from .therapists import router as therapists_router

__all__ = [
    "notifications_router",
    "shops_router",
    "therapists_router",
]
