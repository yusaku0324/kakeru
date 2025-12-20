"""Therapist detail API package.

Provides therapist detail and similar therapists endpoints.
"""

from .router import router
from .schemas import (
    TherapistTags,
    TherapistInfo,
    ShopInfo,
    AvailabilitySlotInfo,
    AvailabilityWindow,
    AvailabilityInfo,
    BreakdownInfo,
    TherapistDetailResponse,
    SimilarTherapistTags,
    SimilarTherapistItem,
    SimilarTherapistsResponse,
)
from .sample_data import (
    SAMPLE_THERAPISTS,
    get_sample_therapist_response,
    get_sample_similar_therapists,
)
from .scoring import (
    compute_price_rank,
    compute_recommended_score,
)
from .similar import (
    normalize,
    match_score,
    list_overlap,
    extract_tags,
    score_similarity,
    get_base_therapist,
    fetch_similar_pool,
    check_today_availability,
)
from .service import (
    fetch_therapist_with_profile,
    fetch_therapist_by_shop_slug,
    build_availability_slots,
)

# Backward compatibility aliases (with underscore prefix)
_compute_price_rank = compute_price_rank
_get_sample_therapist_response = get_sample_therapist_response
_compute_recommended_score = compute_recommended_score
_fetch_therapist_with_profile = fetch_therapist_with_profile
_fetch_therapist_by_shop_slug = fetch_therapist_by_shop_slug
_build_availability_slots = build_availability_slots
_normalize = normalize
_match_score = match_score
_list_overlap = list_overlap
_extract_tags = extract_tags
_score_similarity = score_similarity
_get_base_therapist = get_base_therapist
_fetch_similar_pool = fetch_similar_pool
_check_today_availability = check_today_availability

__all__ = [
    "router",
    # Schemas
    "TherapistTags",
    "TherapistInfo",
    "ShopInfo",
    "AvailabilitySlotInfo",
    "AvailabilityWindow",
    "AvailabilityInfo",
    "BreakdownInfo",
    "TherapistDetailResponse",
    "SimilarTherapistTags",
    "SimilarTherapistItem",
    "SimilarTherapistsResponse",
    # Sample data
    "SAMPLE_THERAPISTS",
    "get_sample_therapist_response",
    "get_sample_similar_therapists",
    # Scoring
    "compute_price_rank",
    "compute_recommended_score",
    # Similar
    "normalize",
    "match_score",
    "list_overlap",
    "extract_tags",
    "score_similarity",
    "get_base_therapist",
    "fetch_similar_pool",
    "check_today_availability",
    # Service
    "fetch_therapist_with_profile",
    "fetch_therapist_by_shop_slug",
    "build_availability_slots",
    # Backward compatibility aliases
    "_compute_price_rank",
    "_get_sample_therapist_response",
    "_compute_recommended_score",
    "_fetch_therapist_with_profile",
    "_fetch_therapist_by_shop_slug",
    "_build_availability_slots",
    "_normalize",
    "_match_score",
    "_list_overlap",
    "_extract_tags",
    "_score_similarity",
    "_get_base_therapist",
    "_fetch_similar_pool",
    "_check_today_availability",
]
