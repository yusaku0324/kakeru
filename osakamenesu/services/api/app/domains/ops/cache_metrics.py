"""Cache metrics and monitoring endpoints."""

from __future__ import annotations

import logging
from typing import Dict, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ...utils.cache import shop_cache, therapist_cache, availability_cache
from ...utils.redis_cache import get_redis_cache

logger = logging.getLogger(__name__)

router = APIRouter()


class CacheStats(BaseModel):
    """Cache statistics model."""

    name: str
    size: int
    max_size: int
    ttl_seconds: int
    hit_rate: float | None = None
    type: str = "memory"


class CacheMetrics(BaseModel):
    """Overall cache metrics."""

    memory_caches: list[CacheStats]
    redis_connected: bool
    redis_url: str | None = None


@router.get("/cache/metrics")
async def get_cache_metrics() -> CacheMetrics:
    """Get cache performance metrics."""
    # Memory cache stats
    memory_caches = [
        CacheStats(
            name="shop_cache",
            size=shop_cache.size,
            max_size=shop_cache._max_size,
            ttl_seconds=shop_cache._ttl,
        ),
        CacheStats(
            name="therapist_cache",
            size=therapist_cache.size,
            max_size=therapist_cache._max_size,
            ttl_seconds=therapist_cache._ttl,
        ),
        CacheStats(
            name="availability_cache",
            size=availability_cache.size,
            max_size=availability_cache._max_size,
            ttl_seconds=availability_cache._ttl,
        ),
    ]

    # Redis cache status
    redis = await get_redis_cache()
    redis_connected = redis is not None and redis._connected

    return CacheMetrics(
        memory_caches=memory_caches,
        redis_connected=redis_connected,
        redis_url=redis.redis_url if redis else None,
    )


@router.post("/cache/clear")
async def clear_caches(cache_type: str = "all") -> Dict[str, Any]:
    """Clear cache(s).

    Args:
        cache_type: Which caches to clear ("all", "memory", "redis", or specific cache name)
    """
    cleared = []

    if cache_type in ["all", "memory"]:
        await shop_cache.clear()
        await therapist_cache.clear()
        await availability_cache.clear()
        cleared.extend(["shop_cache", "therapist_cache", "availability_cache"])

    if cache_type in ["all", "redis"]:
        redis = await get_redis_cache()
        if redis:
            count = await redis.delete_pattern("*")
            cleared.append(f"redis ({count} keys)")

    if cache_type == "shop_cache":
        await shop_cache.clear()
        cleared.append("shop_cache")
    elif cache_type == "therapist_cache":
        await therapist_cache.clear()
        cleared.append("therapist_cache")
    elif cache_type == "availability_cache":
        await availability_cache.clear()
        cleared.append("availability_cache")

    if not cleared:
        raise HTTPException(status_code=400, detail=f"Invalid cache type: {cache_type}")

    return {"cleared": cleared}


@router.post("/cache/warm")
async def warm_cache(cache_type: str = "shops") -> Dict[str, Any]:
    """Warm up cache by pre-loading common data.

    Args:
        cache_type: Which cache to warm ("shops", "therapists", or "all")
    """
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select
    from ...db import get_session
    from ... import models

    warmed = []

    async for session in get_session():
        if cache_type in ["all", "shops"]:
            # Pre-load active shops
            shops_result = await session.execute(
                select(models.Shop).where(models.Shop.is_active == True)
            )
            shops = shops_result.scalars().all()

            for shop in shops:
                cache_key = f"shop_detail:{shop.id}"
                # Here you would call the actual service that populates the cache
                # For now just marking as warmed
                warmed.append(f"shop:{shop.id}")

        if cache_type in ["all", "therapists"]:
            # Pre-load active therapists
            therapists_result = await session.execute(
                select(models.Therapist).where(models.Therapist.is_active == True)
            )
            therapists = therapists_result.scalars().all()

            for therapist in therapists:
                warmed.append(f"therapist:{therapist.id}")

    return {"warmed": len(warmed), "items": warmed[:10]}  # Show first 10 items
