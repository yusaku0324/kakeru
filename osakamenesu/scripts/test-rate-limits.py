#!/usr/bin/env python3
"""Test API rate limits to ensure they are working correctly."""

import asyncio
import argparse
import sys
from datetime import datetime
from typing import Dict, List, Tuple

import httpx
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

console = Console()


class RateLimitTester:
    """Test rate limits on various API endpoints."""

    def __init__(self, base_url: str):
        """Initialize the rate limit tester."""
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=30.0)

    async def __aenter__(self):
        """Enter async context."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Exit async context and cleanup."""
        await self.client.aclose()

    async def test_endpoint(
        self,
        path: str,
        method: str = "GET",
        expected_limit: int = 60,
        window: int = 60,
        data: Dict = None
    ) -> Tuple[int, int, List[int]]:
        """Test a specific endpoint's rate limit.

        Returns:
            Tuple of (successful_requests, rate_limited_requests, status_codes)
        """
        url = f"{self.base_url}{path}"
        successful = 0
        rate_limited = 0
        status_codes = []

        # Make requests up to 150% of the expected limit
        max_requests = int(expected_limit * 1.5)

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("{task.completed}/{task.total}"),
            console=console,
        ) as progress:
            task = progress.add_task(
                f"Testing {path}", total=max_requests
            )

            for i in range(max_requests):
                try:
                    if method == "GET":
                        response = await self.client.get(url)
                    elif method == "POST":
                        response = await self.client.post(url, json=data or {})
                    else:
                        response = await self.client.request(method, url, json=data)

                    status_codes.append(response.status_code)

                    if response.status_code == 429:
                        rate_limited += 1
                        # Check headers
                        retry_after = response.headers.get("Retry-After")
                        if retry_after:
                            console.print(
                                f"[yellow]Rate limited! Retry after: {retry_after}s[/yellow]"
                            )
                    elif response.status_code < 400:
                        successful += 1

                except Exception as e:
                    console.print(f"[red]Error: {e}[/red]")
                    status_codes.append(0)

                progress.update(task, advance=1)

                # Small delay to avoid overwhelming the server
                await asyncio.sleep(0.1)

        return successful, rate_limited, status_codes

    async def test_all_endpoints(self):
        """Test rate limits on all major endpoints."""
        console.print("\n[bold cyan]Testing API Rate Limits[/bold cyan]\n")

        # Define test cases
        test_cases = [
            {
                "name": "Auth Request Link",
                "path": "/api/auth/request-link",
                "method": "POST",
                "expected_limit": 5,
                "window": 600,  # 10 minutes
                "data": {"email": "test@example.com"}
            },
            {
                "name": "Shops Search",
                "path": "/api/v1/shops",
                "method": "GET",
                "expected_limit": 60,
                "window": 60,  # 1 minute
            },
            {
                "name": "Health Check (No Limit)",
                "path": "/healthz",
                "method": "GET",
                "expected_limit": 100,
                "window": 1,
            },
        ]

        # Results table
        table = Table(title="Rate Limit Test Results")
        table.add_column("Endpoint", style="cyan", no_wrap=True)
        table.add_column("Method", style="magenta")
        table.add_column("Expected Limit", justify="right", style="green")
        table.add_column("Successful", justify="right", style="green")
        table.add_column("Rate Limited", justify="right", style="yellow")
        table.add_column("Status", style="bold")

        for test_case in test_cases:
            console.print(f"\n[bold]Testing: {test_case['name']}[/bold]")

            successful, rate_limited, status_codes = await self.test_endpoint(
                path=test_case["path"],
                method=test_case["method"],
                expected_limit=test_case["expected_limit"],
                window=test_case["window"],
                data=test_case.get("data"),
            )

            # Determine test status
            if test_case["name"] == "Health Check (No Limit)":
                # Health check should not be rate limited
                status = "✅ PASS" if rate_limited == 0 else "❌ FAIL"
            else:
                # Other endpoints should enforce rate limits
                status = "✅ PASS" if rate_limited > 0 else "❌ FAIL"

            table.add_row(
                test_case["path"],
                test_case["method"],
                str(test_case["expected_limit"]),
                str(successful),
                str(rate_limited),
                status,
            )

            # Show status code distribution
            unique_status_codes = set(status_codes) - {0}
            if unique_status_codes:
                console.print(
                    f"Status codes: {', '.join(str(code) for code in sorted(unique_status_codes))}"
                )

        console.print("\n")
        console.print(table)

    async def test_concurrent_requests(self, path: str, concurrent: int = 10):
        """Test concurrent requests to check rate limiting under load."""
        console.print(
            f"\n[bold cyan]Testing Concurrent Requests ({concurrent} parallel)[/bold cyan]\n"
        )

        url = f"{self.base_url}{path}"

        async def make_request() -> int:
            """Make a single request and return status code."""
            try:
                response = await self.client.get(url)
                return response.status_code
            except Exception:
                return 0

        # Make concurrent requests
        tasks = [make_request() for _ in range(concurrent)]
        results = await asyncio.gather(*tasks)

        # Count results
        status_counts = {}
        for status in results:
            status_counts[status] = status_counts.get(status, 0) + 1

        console.print(f"Results for {path}:")
        for status, count in sorted(status_counts.items()):
            if status == 429:
                console.print(f"  [yellow]{status}: {count} requests (rate limited)[/yellow]")
            elif status >= 400:
                console.print(f"  [red]{status}: {count} requests (error)[/red]")
            elif status > 0:
                console.print(f"  [green]{status}: {count} requests (success)[/green]")
            else:
                console.print(f"  [red]Failed: {count} requests[/red]")


async def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Test API rate limits")
    parser.add_argument(
        "--url",
        default="https://osakamenesu-api-stg.fly.dev",
        help="Base URL of the API (default: staging)",
    )
    parser.add_argument(
        "--concurrent",
        type=int,
        default=10,
        help="Number of concurrent requests for burst test",
    )
    parser.add_argument(
        "--endpoint",
        help="Test specific endpoint only",
    )

    args = parser.parse_args()

    try:
        async with RateLimitTester(args.url) as tester:
            if args.endpoint:
                # Test specific endpoint
                successful, rate_limited, _ = await tester.test_endpoint(
                    args.endpoint, expected_limit=60
                )
                console.print(
                    f"\nResults: {successful} successful, {rate_limited} rate limited"
                )

                # Also test concurrent
                await tester.test_concurrent_requests(args.endpoint, args.concurrent)
            else:
                # Test all endpoints
                await tester.test_all_endpoints()

                # Test concurrent on shops endpoint
                await tester.test_concurrent_requests(
                    "/api/v1/shops", args.concurrent
                )

    except KeyboardInterrupt:
        console.print("\n[yellow]Test interrupted by user[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[red]Error: {e}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
