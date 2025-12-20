"""Admin domain routers and helpers."""

from .router import router as admin_router
from .profiles import router as admin_profiles_router

__all__ = [
    "admin_router",
    "admin_profiles_router",
]
