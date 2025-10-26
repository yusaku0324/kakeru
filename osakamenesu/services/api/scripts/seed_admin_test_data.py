#!/usr/bin/env python3
"""
Seed deterministic admin data required for Playwright E2E tests.

This script is idempotent and guarantees the presence of:
  - A canonical shop (slug: `playwright-seed-shop`) with contact information,
    menus, and staff entries so dashboard tests have editable content.
  - At least one reservation associated with the seeded shop.

It talks to ADMIN_API_KEY-protected `/api/admin/*` endpoints. When neither the
API base URL nor the admin key is configured the script exits successfully
without making any changes, making it safe to invoke unconditionally from CI.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Sequence
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request
from urllib.parse import urljoin

PLAYWRIGHT_SHOP_SLUG = "playwright-seed-shop"
DEFAULT_TIMEOUT = 30


def _log(message: str) -> None:
    print(f"[seed-admin] {message}", file=sys.stderr)


def _resolve_api_base(explicit: Optional[str]) -> Optional[str]:
    candidates: Sequence[Optional[str]] = (
        explicit,
        os.environ.get("E2E_SEED_API_BASE"),
        os.environ.get("OSAKAMENESU_API_INTERNAL_BASE"),
        os.environ.get("API_INTERNAL_BASE"),
        os.environ.get("NEXT_PUBLIC_OSAKAMENESU_API_BASE"),
        os.environ.get("NEXT_PUBLIC_API_BASE"),
    )
    for candidate in candidates:
        if not candidate:
            continue
        candidate = candidate.strip()
        if candidate.startswith(("http://", "https://")):
            return candidate.rstrip("/")
    return None


def _request_json(
    base: str,
    method: str,
    path: str,
    *,
    headers: Dict[str, str],
    params: Optional[Dict[str, Any]] = None,
    payload: Optional[Dict[str, Any]] = None,
    expected: Sequence[int] = (200, 201, 202, 204),
) -> Any:
    url = urljoin(f"{base}/", path.lstrip("/"))
    if params:
        url = f"{url}?{urllib_parse.urlencode(params)}"

    data: Optional[bytes] = None
    req_headers = dict(headers)
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")

    req = urllib_request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib_request.urlopen(req, timeout=DEFAULT_TIMEOUT) as resp:
            status = resp.getcode()
            body = resp.read()
    except urllib_error.HTTPError as exc:
        status = exc.code
        body = exc.read()
    except urllib_error.URLError as exc:
        raise RuntimeError(f"{method} {url} failed: {exc}") from exc

    text = body.decode("utf-8", errors="ignore") if body else ""
    if status not in expected:
        try:
            parsed = json.loads(text) if text else None
        except ValueError:
            parsed = text
        raise RuntimeError(f"{method} {url} -> {status}: {parsed!r}")

    if not text:
        return None
    try:
        return json.loads(text)
    except ValueError:
        return text


def _ensure_shop(
    base: str,
    headers: Dict[str, str],
    *,
    contact_phone: str,
) -> str:
    data = _request_json(base, "GET", "/api/admin/shops", headers=headers)
    items = (data or {}).get("items") if isinstance(data, dict) else None
    shop_id: Optional[str] = None
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict) and item.get("slug") == PLAYWRIGHT_SHOP_SLUG:
                shop_id = str(item.get("id"))
                break

    if not shop_id:
        _log("creating seed shop (playwright-seed-shop)")
        create_payload = {
            "slug": PLAYWRIGHT_SHOP_SLUG,
            "name": "Playwright Seed Spa 梅田店",
            "area": "梅田",
            "price_min": 12000,
            "price_max": 21000,
            "bust_tag": "E",
            "service_type": "store",
            "body_tags": ["清楚", "スレンダー"],
            "photos": [
                "https://picsum.photos/seed/playwright-seed-shop-1/960/640",
                "https://picsum.photos/seed/playwright-seed-shop-2/960/640",
            ],
            "contact_json": {
                "store_name": "Playwright Seed Spa",
                "address": "大阪市北区梅田1-1-1",
                "service_tags": ["完全個室", "日本人セラピスト", "初回割引"],
                "phone": contact_phone,
                "tel": contact_phone,
                "line_id": "playwright_seed_line",
                "line": "playwright_seed_line",
                "website_url": "https://example.com/playwright-seed",
                "web": "https://example.com/playwright-seed",
                "reservation_form_url": "https://example.com/playwright-seed/reservations",
                "menus": [
                    {
                        "name": "スタンダード90分",
                        "price": 15000,
                        "duration_minutes": 90,
                        "description": "全身を丁寧にケアする定番コースです。",
                        "tags": ["リンパ", "オイル"],
                    },
                    {
                        "name": "プレミアム120分",
                        "price": 21000,
                        "duration_minutes": 120,
                        "description": "個室でゆったり過ごす贅沢プラン。",
                        "tags": ["個室", "VIP"],
                    },
                ],
                "staff": [
                    {
                        "name": "葵",
                        "alias": "指名No.1",
                        "headline": "丁寧な接客で人気のトップセラピストです。",
                        "specialties": ["ホットストーン", "ディープリンパ"],
                    },
                    {
                        "name": "凛",
                        "alias": "新人",
                        "headline": "ストレッチと指圧の組み合わせが得意です。",
                        "specialties": ["ストレッチ", "ストーン"],
                    },
                ],
            },
            "status": "published",
        }
        created = _request_json(
            base,
            "POST",
            "/api/admin/profiles",
            headers=headers,
            params={"skip_index": 1},
            payload=create_payload,
            expected=(200, 201),
        )
        if not isinstance(created, dict) or "id" not in created:
            raise RuntimeError(f"unexpected response creating seed shop: {created!r}")
        shop_id = str(created["id"])

    update_payload = {
        "name": "Playwright Seed Spa 梅田店",
        "slug": PLAYWRIGHT_SHOP_SLUG,
        "area": "梅田",
        "price_min": 12000,
        "price_max": 21000,
        "service_type": "store",
        "service_tags": ["完全個室", "日本人セラピスト", "初回割引"],
        "contact": {
            "phone": contact_phone,
            "line_id": "playwright_seed_line",
            "website_url": "https://example.com/playwright-seed",
            "reservation_form_url": "https://example.com/playwright-seed/reservations",
            "sns": [],
        },
        "menus": [
            {
                "name": "スタンダード90分",
                "price": 15000,
                "duration_minutes": 90,
                "description": "全身を丁寧にケアする定番コースです。",
                "tags": ["リンパ", "オイル"],
                "is_reservable_online": True,
            },
            {
                "name": "プレミアム120分",
                "price": 21000,
                "duration_minutes": 120,
                "description": "個室でゆったり過ごす贅沢プラン。",
                "tags": ["個室", "VIP"],
                "is_reservable_online": True,
            },
        ],
        "staff": [
            {
                "name": "葵",
                "alias": "指名No.1",
                "headline": "丁寧な接客で人気のトップセラピストです。",
                "specialties": ["ホットストーン", "ディープリンパ"],
            },
            {
                "name": "凛",
                "alias": "新人",
                "headline": "ストレッチと指圧の組み合わせが得意です。",
                "specialties": ["ストレッチ", "ストーン"],
            },
        ],
        "address": "大阪市北区梅田1-1-1",
        "description": "梅田駅徒歩3分。完全個室のプレイライト向けメンエス体験。",
        "catch_copy": "都会の喧騒を忘れる上質な癒やしを。",
        "photos": [
            "https://picsum.photos/seed/playwright-seed-shop-1/960/640",
            "https://picsum.photos/seed/playwright-seed-shop-2/960/640",
        ],
    }

    try:
        _request_json(
            base,
            "PATCH",
            f"/api/admin/shops/{shop_id}/content",
            headers=headers,
            payload=update_payload,
            expected=(200,),
        )
    except RuntimeError as exc:
        _log(f"update content failed (ignored): {exc}")

    _log(f"seed shop ensured (id={shop_id})")
    return shop_id


def _ensure_reservation(base: str, headers: Dict[str, str], shop_id: str) -> None:
    data = _request_json(
        base,
        "GET",
        "/api/admin/reservations",
        headers=headers,
        params={"limit": 1},
    )
    items = (data or {}).get("items") if isinstance(data, dict) else None
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict) and str(item.get("shop_id")) == str(shop_id):
                _log("reservation already present; skipping creation")
                return

    now = datetime.now(timezone.utc)
    desired_start = (now + timedelta(hours=1)).isoformat()
    desired_end = (now + timedelta(hours=2)).isoformat()

    payload = {
        "shop_id": shop_id,
        "channel": "web",
        "desired_start": desired_start,
        "desired_end": desired_end,
        "notes": "Playwright seed reservation",
        "customer": {
            "name": "Playwright User",
            "phone": "09000000000",
            "email": "playwright@example.com",
        },
        "marketing_opt_in": False,
    }
    _request_json(
        base,
        "POST",
        "/api/v1/reservations",
        headers={},
        payload=payload,
        expected=(200, 201, 202, 204),
    )
    _log("seed reservation created")


def main(argv: Sequence[str]) -> int:
    parser = argparse.ArgumentParser(description="Seed admin data for Playwright E2E tests")
    parser.add_argument("--api-base", help="Base URL for the API (e.g. https://api.example.com)")
    parser.add_argument(
        "--admin-key",
        default=os.environ.get("OSAKAMENESU_ADMIN_API_KEY") or os.environ.get("ADMIN_API_KEY"),
        help="X-Admin-Key header value",
    )
    parser.add_argument(
        "--authorization",
        default=os.environ.get("AUTHORIZATION"),
        help="Optional Authorization header value",
    )
    parser.add_argument(
        "--id-token",
        default=os.environ.get("CLOUD_RUN_ID_TOKEN"),
        help="Optional bearer token (used when Authorization header absent)",
    )
    parser.add_argument(
        "--contact-phone",
        default=os.environ.get("E2E_SEED_CONTACT_PHONE", "08000001111"),
        help="Phone number stored in the seed shop",
    )
    args = parser.parse_args(list(argv))

    base = _resolve_api_base(args.api_base)
    if not base:
        _log("no API base configured; skipping seed")
        return 0

    admin_key = (args.admin_key or "").strip()
    if not admin_key:
        _log("ADMIN_API_KEY is not set; skipping seed")
        return 0

    headers: Dict[str, str] = {"X-Admin-Key": admin_key}
    authorization = (args.authorization or "").strip()
    if not authorization and args.id_token:
        authorization = f"Bearer {args.id_token.strip()}"
    if authorization:
        headers["Authorization"] = authorization

    try:
        shop_id = _ensure_shop(base, headers, contact_phone=args.contact_phone)
        _ensure_reservation(base, headers, shop_id)
    except Exception as exc:  # pragma: no cover - script-style execution
        _log(f"seeding failed: {exc}")
        return 1

    _log("seeding completed successfully")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main(sys.argv[1:]))
