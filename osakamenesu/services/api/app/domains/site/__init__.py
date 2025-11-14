"""Site (customer-facing) domain routers."""

from .favorites import router as favorites_router
from .shops import router as shops_router

__all__ = [
    "favorites_router",
    "shops_router",
]
