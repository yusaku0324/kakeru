"""Site (customer-facing) domain routers."""

from .favorites import router as favorites_router
from .guest_matching import router as guest_matching_router
from .shops import router as shops_router
from .matching import router as matching_router
from .guest_reservations import router as guest_reservations_router
from .therapist_availability import router as therapist_availability_router
from .therapists import router as therapists_router

__all__ = [
    "favorites_router",
    "guest_matching_router",
    "shops_router",
    "matching_router",
    "guest_reservations_router",
    "therapist_availability_router",
    "therapists_router",
]
