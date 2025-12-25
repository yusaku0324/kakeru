#!/usr/bin/env python3
"""
Health check script for Osakamenesu services.
Sends alerts via webhook when services are down.
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional

import httpx
from rich.console import Console
from rich.table import Table

console = Console()


class HealthChecker:
    """Check health of various services and send alerts."""

    def __init__(self, webhook_url: Optional[str] = None):
        """Initialize health checker with optional webhook URL."""
        self.webhook_url = webhook_url or os.getenv("MONITORING_WEBHOOK_URL")
        self.services = [
            {
                "name": "API Production",
                "url": "https://osakamenesu-api.fly.dev/healthz",
                "expected_status": 200,
                "expected_response": {"ok": True},
            },
            {
                "name": "API Staging",
                "url": "https://osakamenesu-api-stg.fly.dev/healthz",
                "expected_status": 200,
                "expected_response": {"ok": True},
            },
            {
                "name": "Web Application",
                "url": "https://osakamenesu.com",
                "expected_status": 200,
                "expected_response": None,
            },
            {
                "name": "API Docs",
                "url": "https://osakamenesu-api.fly.dev/docs",
                "expected_status": 200,
                "expected_response": None,
            },
        ]

    async def check_service(self, service: Dict) -> Dict:
        """Check a single service health."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                start_time = datetime.now()
                response = await client.get(service["url"])
                response_time = (datetime.now() - start_time).total_seconds() * 1000

                # Check status code
                status_ok = response.status_code == service["expected_status"]

                # Check response body if expected
                body_ok = True
                if service["expected_response"]:
                    try:
                        body = response.json()
                        body_ok = body == service["expected_response"]
                    except:
                        body_ok = False

                is_healthy = status_ok and body_ok

                return {
                    "name": service["name"],
                    "url": service["url"],
                    "status": "UP" if is_healthy else "DOWN",
                    "status_code": response.status_code,
                    "response_time": round(response_time, 2),
                    "error": None if is_healthy else "Status or response mismatch",
                }

            except Exception as e:
                return {
                    "name": service["name"],
                    "url": service["url"],
                    "status": "DOWN",
                    "status_code": None,
                    "response_time": None,
                    "error": str(e),
                }

    async def check_all_services(self) -> List[Dict]:
        """Check all services concurrently."""
        tasks = [self.check_service(service) for service in self.services]
        results = await asyncio.gather(*tasks)
        return results

    async def send_alert(self, results: List[Dict]):
        """Send alert via webhook if any service is down."""
        if not self.webhook_url:
            return

        down_services = [r for r in results if r["status"] == "DOWN"]
        if not down_services:
            return

        # Create alert message
        message = {
            "text": f"🚨 Alert: {len(down_services)} service(s) down!",
            "attachments": [
                {
                    "color": "danger",
                    "fields": [
                        {
                            "title": service["name"],
                            "value": f"Error: {service['error']}",
                            "short": False,
                        }
                        for service in down_services
                    ],
                    "footer": "Osakamenesu Health Check",
                    "ts": int(datetime.now().timestamp()),
                }
            ],
        }

        # Send to webhook (Slack/Discord compatible)
        async with httpx.AsyncClient() as client:
            try:
                await client.post(self.webhook_url, json=message)
            except Exception as e:
                console.print(f"[red]Failed to send alert: {e}[/red]")

    def display_results(self, results: List[Dict]):
        """Display results in a nice table."""
        table = Table(title="Service Health Status")
        table.add_column("Service", style="cyan", no_wrap=True)
        table.add_column("Status", style="bold")
        table.add_column("Response Time", justify="right")
        table.add_column("Error", style="red")

        for result in results:
            status_style = "green" if result["status"] == "UP" else "red"
            status = f"[{status_style}]{result['status']}[/{status_style}]"

            response_time = (
                f"{result['response_time']}ms" if result["response_time"] else "-"
            )

            error = result["error"] or "-"

            table.add_row(result["name"], status, response_time, error)

        console.print(table)

    async def run(self, continuous: bool = False, interval: int = 300):
        """Run health checks once or continuously."""
        while True:
            console.print(f"\n[bold cyan]Running health checks...[/bold cyan]")
            results = await self.check_all_services()

            self.display_results(results)

            # Send alerts for down services
            await self.send_alert(results)

            # Summary
            up_count = sum(1 for r in results if r["status"] == "UP")
            total_count = len(results)
            console.print(
                f"\n[bold]Summary:[/bold] {up_count}/{total_count} services operational"
            )

            if not continuous:
                break

            console.print(f"\n[dim]Next check in {interval} seconds...[/dim]")
            await asyncio.sleep(interval)


async def main():
    """Main function."""
    import argparse

    parser = argparse.ArgumentParser(description="Health check for Osakamenesu services")
    parser.add_argument(
        "--continuous",
        "-c",
        action="store_true",
        help="Run continuously",
    )
    parser.add_argument(
        "--interval",
        "-i",
        type=int,
        default=300,
        help="Check interval in seconds (default: 300)",
    )
    parser.add_argument(
        "--webhook",
        "-w",
        help="Webhook URL for alerts (or set MONITORING_WEBHOOK_URL env var)",
    )

    args = parser.parse_args()

    # Use webhook from args or env
    webhook_url = args.webhook or os.getenv("MONITORING_WEBHOOK_URL")

    checker = HealthChecker(webhook_url=webhook_url)
    try:
        await checker.run(continuous=args.continuous, interval=args.interval)
    except KeyboardInterrupt:
        console.print("\n[yellow]Health check stopped by user[/yellow]")
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
