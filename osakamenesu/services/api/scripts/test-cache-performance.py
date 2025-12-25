#!/usr/bin/env python3
"""Test cache performance and effectiveness."""

import asyncio
import time
import httpx
import statistics
from typing import List

# Configuration
BASE_URL = "https://osakamenesu-api.fly.dev"
# BASE_URL = "http://localhost:8000"  # For local testing

ENDPOINTS = [
    "/api/v1/shops",
    "/api/v1/shops?area=大阪市",
    "/api/v1/therapists",
    "/healthz",
]


async def measure_endpoint(
    client: httpx.AsyncClient, url: str, iterations: int = 10
) -> dict:
    """Measure response times for an endpoint."""
    times = []
    cache_hits = 0

    for i in range(iterations):
        start = time.time()
        response = await client.get(url)
        elapsed = (time.time() - start) * 1000  # Convert to ms

        times.append(elapsed)

        # Check if it was a cache hit based on response time or headers
        if "X-Cache" in response.headers:
            if response.headers["X-Cache"] == "HIT":
                cache_hits += 1
        elif (
            i > 0 and elapsed < times[0] * 0.5
        ):  # Heuristic: 50% faster = likely cached
            cache_hits += 1

        # Small delay between requests
        await asyncio.sleep(0.1)

    return {
        "url": url,
        "iterations": iterations,
        "response_times_ms": times,
        "min_ms": min(times),
        "max_ms": max(times),
        "avg_ms": statistics.mean(times),
        "median_ms": statistics.median(times),
        "cache_hits": cache_hits,
        "cache_hit_rate": cache_hits / iterations * 100,
        "first_request_ms": times[0],
        "subsequent_avg_ms": statistics.mean(times[1:]) if len(times) > 1 else 0,
    }


async def main():
    """Run performance tests."""
    print("🚀 Cache Performance Test")
    print(f"Base URL: {BASE_URL}")
    print("-" * 60)

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Warm up
        print("Warming up...")
        await client.get("/healthz")

        results = []
        for endpoint in ENDPOINTS:
            print(f"\nTesting: {endpoint}")
            result = await measure_endpoint(client, endpoint)
            results.append(result)

            print(f"  First request: {result['first_request_ms']:.1f}ms")
            print(f"  Subsequent avg: {result['subsequent_avg_ms']:.1f}ms")
            print(f"  Cache hit rate: {result['cache_hit_rate']:.1f}%")
            print(
                f"  Min/Avg/Max: {result['min_ms']:.1f}/{result['avg_ms']:.1f}/{result['max_ms']:.1f}ms"
            )

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    # Calculate overall improvement
    total_first = sum(r["first_request_ms"] for r in results)
    total_cached = sum(r["subsequent_avg_ms"] for r in results)
    improvement = (
        ((total_first - total_cached) / total_first) * 100 if total_first > 0 else 0
    )

    print(f"\nTotal first request time: {total_first:.1f}ms")
    print(f"Total cached request time: {total_cached:.1f}ms")
    print(f"Overall improvement: {improvement:.1f}%")

    # Show which endpoints benefit most from caching
    print("\nCache effectiveness by endpoint:")
    for result in sorted(
        results,
        key=lambda x: x["first_request_ms"] - x["subsequent_avg_ms"],
        reverse=True,
    ):
        speedup = result["first_request_ms"] - result["subsequent_avg_ms"]
        speedup_pct = (
            (speedup / result["first_request_ms"]) * 100
            if result["first_request_ms"] > 0
            else 0
        )
        print(f"  {result['url']}: {speedup:.1f}ms saved ({speedup_pct:.1f}% faster)")


if __name__ == "__main__":
    asyncio.run(main())
