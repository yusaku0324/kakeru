"""Guest matching API package.

Provides guest-facing therapist matching and similar therapist recommendation endpoints.
"""

from fastapi import HTTPException

from ....db import get_session
from .router import router
from .schemas import (
    GuestMatchingRequest,
    MatchingBreakdown,
    MatchingCandidate,
    MatchingResponse,
    SimilarResponse,
    SimilarTherapistItem,
)
from .similar import (
    get_base_staff as _get_base_staff,
    fetch_similar_candidates as _fetch_similar_candidates,
)
from ..therapist_availability import is_available
from ..services.shop.search_service import ShopSearchService

__all__ = [
    "router",
    "HTTPException",
    "get_session",
    "GuestMatchingRequest",
    "MatchingBreakdown",
    "MatchingCandidate",
    "MatchingResponse",
    "SimilarResponse",
    "SimilarTherapistItem",
    "_get_base_staff",
    "_fetch_similar_candidates",
    "is_available",
    "ShopSearchService",
]
