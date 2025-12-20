"""Guest matching API router."""

import logging
import sys
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ....db import get_session
from ....rate_limiters import rate_limit_search
from ..services.shop.search_service import ShopSearchService

from .schemas import (
    GuestMatchingRequest,
    MatchingBreakdown,
    MatchingCandidate,
    MatchingResponse,
    SimilarResponse,
    SimilarTherapistItem,
)
from .scoring import (
    score_candidate,
    score_candidate_v2,
    normalize_breakdown,
    aggregate_score,
    compute_recommended_score,
    is_available_candidate,
)
from .similar import (
    SIMILAR_DEFAULT_LIMIT,
    SIMILAR_MAX_LIMIT,
    SIMILAR_DEFAULT_MIN_SCORE,
    compute_similar_scores,
)
from .utils import (
    combine_datetime,
    resolve_phase,
    map_shop_to_candidate,
    log_matching,
)


def _get_parent_module():
    """Get parent module for monkeypatching support."""
    return sys.modules.get("app.domains.site.guest_matching")


router = APIRouter(prefix="/api/guest/matching", tags=["guest-matching"])
logger = logging.getLogger(__name__)


@router.get("/search", response_model=MatchingResponse)
@router.post("/search", response_model=MatchingResponse)
async def guest_matching_search(
    payload: GuestMatchingRequest = Depends(),
    db: AsyncSession = Depends(get_session),
    _: None = Depends(rate_limit_search),
) -> MatchingResponse:
    """
    v1: 既存ショップ検索をラップし、簡易スコアリングして返却。
    現状はタグ不足のため雰囲気系タグは空（0.5のニュートラル）で計算。
    """
    if not payload.area or not payload.date:
        return MatchingResponse(items=[], total=0)

    parsed_date: date | None = None
    if isinstance(payload.date, date):
        parsed_date = payload.date
    elif isinstance(payload.date, str):
        try:
            parsed_date = datetime.fromisoformat(payload.date).date()
        except ValueError:
            parsed_date = None

    phase = resolve_phase(payload, parsed_date)

    # 広域エリアの場合はエリアフィルタを無効化
    BROAD_AREA_KEYWORDS = ["大阪市内", "指定なし", "全エリア", "すべて", "osaka", "all"]
    search_area = payload.area
    if search_area and any(
        kw in search_area.lower() for kw in [k.lower() for k in BROAD_AREA_KEYWORDS]
    ):
        search_area = None

    parent = _get_parent_module()
    search_service = parent.ShopSearchService(db)
    try:
        search_res = await search_service.search(
            area=search_area,
            available_date=parsed_date,
            open_now=True,
            page=1,
            page_size=12,
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("matching_search_failed: %s", exc)
        return MatchingResponse(items=[], total=0)

    hits = search_res.get("results", []) if isinstance(search_res, dict) else []
    candidates_raw = [map_shop_to_candidate(shop) for shop in hits]

    scored: list[MatchingCandidate] = []
    for c in candidates_raw:
        score = score_candidate(payload, c)
        breakdown = normalize_breakdown(c.get("__breakdown", {}))
        summary = (
            f"{c.get('shop_name', '')} のスタッフ候補です。条件に近い順に並べています。"
        )
        scored.append(
            MatchingCandidate(
                id=c["therapist_id"],
                therapist_id=c["therapist_id"],
                therapist_name=c["therapist_name"],
                shop_id=c["shop_id"],
                shop_name=c["shop_name"],
                score=score,
                breakdown=MatchingBreakdown(**breakdown),
                summary=summary,
                slots=c.get("slots", []),
                mood_tag=c.get("mood_tag"),
                style_tag=c.get("style_tag"),
                look_type=c.get("look_type"),
                talk_level=c.get("talk_level"),
                contact_style=c.get("contact_style"),
                hobby_tags=c.get("hobby_tags"),
            )
        )

    # v2 scoring (photo-heavy)
    base_ctx: dict[str, Any] | None = None
    if payload.base_staff_id:
        try:
            parent = _get_parent_module()
            base_ctx = await parent._get_base_staff(db, payload.base_staff_id)
        except HTTPException as exc:
            raise exc
        except Exception:
            base_ctx = None

    v2_items: list[MatchingCandidate] = []
    for c in candidates_raw:
        bd = score_candidate_v2(payload, c, base_ctx)
        score = bd.get("score", 0.0)
        photo_similarity = bd.get("photo_similarity", 0.5)
        breakdown = bd
        summary = (
            f"{c.get('shop_name', '')} のスタッフ候補です。条件に近い順に並べています。"
        )
        v2_items.append(
            MatchingCandidate(
                id=c["therapist_id"],
                therapist_id=c["therapist_id"],
                therapist_name=c["therapist_name"],
                shop_id=c["shop_id"],
                shop_name=c["shop_name"],
                score=score,
                breakdown=MatchingBreakdown(**breakdown),
                summary=summary,
                slots=c.get("slots", []),
                mood_tag=c.get("mood_tag"),
                style_tag=c.get("style_tag"),
                look_type=c.get("look_type"),
                talk_level=c.get("talk_level"),
                contact_style=c.get("contact_style"),
                hobby_tags=c.get("hobby_tags") or [],
                price_rank=c.get("price_rank"),
                age=c.get("age"),
                photo_url=c.get("photo_url"),
                photo_similarity=photo_similarity,
                is_available=None,
                availability=None,
            )
        )

    sort_value = (payload.sort or "recommended").lower()

    # availability annotation / filtering by phase
    has_time_window = bool(parsed_date and payload.time_from and payload.time_to)
    should_check_availability = (
        phase in {"narrow", "book"}
        and has_time_window
        and payload.time_from
        and payload.time_to
    )
    avail_start = (
        combine_datetime(parsed_date, payload.time_from)
        if should_check_availability
        else None
    )
    avail_end = (
        combine_datetime(parsed_date, payload.time_to)
        if should_check_availability
        else None
    )
    if (
        should_check_availability
        and avail_start
        and avail_end
        and avail_start < avail_end
    ):
        to_check = v2_items
        for cand in to_check:
            try:
                parent = _get_parent_module()
                ok, debug = await parent.is_available(
                    db, cand.therapist_id, avail_start, avail_end
                )
                reasons = debug.get("rejected_reasons") or []
            except Exception:
                ok = False
                reasons = ["internal_error"]
            cand.availability = {"is_available": ok, "rejected_reasons": reasons}
            if not ok and "internal_error" in reasons:
                cand.is_available = None
            else:
                cand.is_available = ok
            avail_boost = 1.0 if ok else 0.0
            bd = cand.breakdown.model_dump()
            bd["availability_boost"] = avail_boost
            cand.breakdown = MatchingBreakdown(**bd)
            cand.score = aggregate_score(bd)

        if phase == "book":
            v2_items = [cand for cand in v2_items if cand.is_available is True]
    else:
        for cand in v2_items:
            cand.availability = {"is_available": None, "rejected_reasons": []}
            cand.is_available = None
            bd = cand.breakdown.model_dump()
            bd["availability_boost"] = 0.0
            cand.breakdown = MatchingBreakdown(**bd)
            cand.score = aggregate_score(bd)

    if sort_value == "recommended":
        for cand in v2_items:
            raw_cand = next(
                (
                    c
                    for c in candidates_raw
                    if c.get("therapist_id") == cand.therapist_id
                ),
                None,
            )
            if raw_cand:
                rec_score, rec_breakdown = compute_recommended_score(payload, raw_cand)
                cand._recommended_score = rec_score
                cand._recommended_breakdown = rec_breakdown
            else:
                cand._recommended_score = cand.score or 0.0
                cand._recommended_breakdown = {}

        v2_items = sorted(
            v2_items,
            key=lambda x: (
                -(getattr(x, "_recommended_score", x.score or 0.0)),
                0 if (x.is_available is True) else 1 if x.is_available is False else 2,
                x.therapist_id,
            ),
        )

        for cand in v2_items:
            if hasattr(cand, "_recommended_score"):
                cand.score = cand._recommended_score

    offset = payload.offset or 0
    limit = payload.limit or 30
    sliced = v2_items[offset : offset + limit]

    log_phase = (
        payload.phase if payload.phase in {"explore", "narrow", "book"} else None
    )
    log_step = (
        payload.step_index if payload.step_index and payload.step_index >= 1 else None
    )
    log_entry_source = payload.entry_source or None

    try:
        await log_matching(
            db,
            payload,
            sliced,
            [],
            guest_token=payload.guest_token,
            phase=log_phase,
            step_index=log_step,
            entry_source=log_entry_source,
        )
    except Exception:
        logger.debug("guest_matching_log_skip")
    return MatchingResponse(items=sliced, total=len(v2_items))


@router.get("/similar", response_model=SimilarResponse)
async def guest_matching_similar(
    staff_id: str = Query(
        default=None, description="Base staff/therapist id (alias: therapist_id)"
    ),
    therapist_id: str | None = Query(
        default=None, description="Deprecated alias for staff_id"
    ),
    limit: int = Query(
        SIMILAR_DEFAULT_LIMIT,
        ge=1,
        le=SIMILAR_MAX_LIMIT,
        description="Maximum similar candidates to return",
    ),
    shop_id: str | None = Query(
        default=None, description="If set, restricts search to this shop/profile"
    ),
    exclude_unavailable: bool = Query(
        default=True,
        description="Exclude therapists with no availability",
    ),
    min_score: float = Query(
        SIMILAR_DEFAULT_MIN_SCORE,
        ge=0.0,
        le=1.0,
        description="Drop candidates below this score",
    ),
    db: AsyncSession = Depends(get_session),
    _: None = Depends(rate_limit_search),
) -> SimilarResponse:
    base_id = staff_id or therapist_id
    if not base_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="staff_id_required"
        )
    staff_id = base_id

    parent = _get_parent_module()
    base = await parent._get_base_staff(db, staff_id)
    pool = await parent._fetch_similar_candidates(
        db,
        base=base,
        shop_id=shop_id,
        exclude_unavailable=exclude_unavailable,
        limit=limit,
    )

    scored: list[dict[str, Any]] = []
    for cand in pool:
        if cand.get("id") == base.get("id"):
            continue
        available = is_available_candidate(cand)
        if exclude_unavailable and not available:
            continue
        scores = compute_similar_scores(base, cand)
        if scores["score"] < min_score:
            continue
        scored.append(
            {
                **cand,
                "score": scores["score"],
                "tag_similarity": scores["tag_similarity"],
                "photo_similarity": scores["photo_similarity"],
                "is_available_now": available,
            }
        )

    base_shop_id = base.get("shop_id")
    scored_sorted = sorted(
        scored,
        key=lambda c: (
            -c["score"],
            0 if c.get("shop_id") == base_shop_id else 1,
            c.get("id"),
        ),
    )
    limited = scored_sorted[:limit]
    items: list[SimilarTherapistItem] = []
    for c in limited:
        items.append(
            SimilarTherapistItem(
                id=c.get("id"),
                name=c.get("name"),
                age=c.get("age"),
                price_rank=c.get("price_rank"),
                mood_tag=c.get("mood_tag"),
                style_tag=c.get("style_tag"),
                look_type=c.get("look_type"),
                contact_style=c.get("contact_style"),
                hobby_tags=c.get("hobby_tags") or [],
                photo_url=c.get("photo_url"),
                is_available_now=c.get("is_available_now", True),
                score=c.get("score", 0.0),
                photo_similarity=c.get("photo_similarity", 0.0),
                tag_similarity=c.get("tag_similarity", 0.0),
            )
        )

    return SimilarResponse(base_staff_id=base.get("id", staff_id), items=items)
