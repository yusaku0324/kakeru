"""Dashboard-facing domain modules."""

from .notifications import router as notifications_router
from .reservations import router as reservations_router
from .reviews import router as reviews_router
from .shifts import router as shifts_router
from .shops import router as shops_router
from .therapists import router as therapists_router

__all__ = [
    "notifications_router",
    "reservations_router",
    "reviews_router",
    "shifts_router",
    "shops_router",
    "therapists_router",
]
