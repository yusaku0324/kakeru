#!/usr/bin/env python3
"""
Seed deterministic sample data for E2E tests.

This script creates fixed sample shops with known slugs and therapist IDs
that are referenced by Playwright E2E tests. It is idempotent - running
multiple times will not create duplicate entries.

Sample Data Created:
- 4 sample shops with fixed slugs (sample-namba-resort, sample-umeda-suite, etc.)
- Each shop has 3-4 therapists with fixed UUIDs
- Each shop has availability slots for today and next 3 days
- Reviews and diaries for each shop
- Reservations in various states (confirmed, cancelled, completed)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request
from urllib.parse import urljoin
from uuid import UUID

DEFAULT_TIMEOUT = 30

# Fixed UUIDs for sample therapists (used in E2E tests)
SAMPLE_THERAPIST_IDS = {
    "sample-namba-resort": [
        "11111111-1111-1111-8888-111111111111",
        "22222222-2222-2222-8888-222222222222",
        "22222222-2222-2222-8888-222222222223",
    ],
    "sample-umeda-suite": [
        "22222222-2222-2222-8888-222222222224",
        "22222222-2222-2222-8888-222222222225",
        "22222222-2222-2222-8888-222222222226",
    ],
    "sample-shinsaibashi-lounge": [
        "33333333-3333-3333-8888-333333333331",
        "33333333-3333-3333-8888-333333333332",
        "33333333-3333-3333-8888-333333333333",
    ],
    "sample-tennoji-garden": [
        "44444444-4444-4444-8888-444444444441",
        "44444444-4444-4444-8888-444444444442",
        "44444444-4444-4444-8888-444444444443",
        "44444444-4444-4444-8888-444444444444",
    ],
}

# Sample shop definitions
SAMPLE_SHOPS = [
    {
        "slug": "sample-namba-resort",
        "name": "アロマリゾート 難波本店",
        "area": "難波/日本橋",
        "price_min": 10000,
        "price_max": 18000,
        "bust_tag": "E",
        "service_type": "store",
        "nearest_station": "難波駅",
        "station_walk_minutes": 3,
        "address": "大阪市中央区難波1-1-1",
        "description": "難波駅徒歩3分。完全個室のリラクゼーションサロン。日本人セラピストが丁寧に施術いたします。",
        "catch_copy": "都会の喧騒を忘れる極上の癒やし",
        "staff": [
            {
                "name": "葵",
                "alias": "指名No.1",
                "avatar_url": "https://i.pravatar.cc/160?img=5",
                "headline": "常連支持率トップの人気セラピストです。",
                "specialties": ["オイル", "リンパ", "ドライヘッド"],
            },
            {
                "name": "凛",
                "alias": "新人",
                "avatar_url": "https://i.pravatar.cc/160?img=6",
                "headline": "繊細なハンドトリートメントが得意です。",
                "specialties": ["ドライヘッド", "ディープリンパ"],
            },
            {
                "name": "真央",
                "alias": "ムードメーカー",
                "avatar_url": "https://i.pravatar.cc/160?img=7",
                "headline": "笑顔が魅力のセラピスト。丁寧なカウンセリング付き。",
                "specialties": ["ホットストーン", "ストレッチ"],
            },
        ],
    },
    {
        "slug": "sample-umeda-suite",
        "name": "リラクゼーションSUITE 梅田",
        "area": "梅田",
        "price_min": 12000,
        "price_max": 22000,
        "bust_tag": "F",
        "service_type": "store",
        "nearest_station": "梅田駅",
        "station_walk_minutes": 5,
        "address": "大阪市北区梅田2-2-2",
        "description": "梅田駅から徒歩5分の好立地。VIPルーム完備で特別なひとときを。",
        "catch_copy": "上質な空間で極上のリラクゼーション",
        "staff": [
            {
                "name": "美月",
                "alias": "癒しの女神",
                "avatar_url": "https://i.pravatar.cc/160?img=10",
                "headline": "アロマセラピーの資格を持つ本格派。",
                "specialties": ["アロマ", "オイル", "リフレ"],
            },
            {
                "name": "結衣",
                "alias": "技術派",
                "avatar_url": "https://i.pravatar.cc/160?img=11",
                "headline": "整体の経験を活かした確かな技術。",
                "specialties": ["整体", "ストレッチ", "指圧"],
            },
            {
                "name": "楓",
                "alias": "人気上昇中",
                "avatar_url": "https://i.pravatar.cc/160?img=12",
                "headline": "丁寧な接客で急成長中の若手セラピスト。",
                "specialties": ["オイル", "ヘッドスパ"],
            },
        ],
    },
    {
        "slug": "sample-shinsaibashi-lounge",
        "name": "メンズアロマ Lounge 心斎橋",
        "area": "心斎橋",
        "price_min": 15000,
        "price_max": 25000,
        "bust_tag": "G",
        "service_type": "store",
        "nearest_station": "心斎橋駅",
        "station_walk_minutes": 2,
        "address": "大阪市中央区心斎橋3-3-3",
        "description": "心斎橋駅直結。ラグジュアリーな空間で贅沢なひとときを。",
        "catch_copy": "大人の隠れ家サロン",
        "staff": [
            {
                "name": "七海",
                "alias": "店長",
                "avatar_url": "https://i.pravatar.cc/160?img=15",
                "headline": "10年のキャリアを持つベテランセラピスト。",
                "specialties": ["全身オイル", "VIP対応"],
            },
            {
                "name": "彩",
                "alias": "話題の新星",
                "avatar_url": "https://i.pravatar.cc/160?img=16",
                "headline": "SNSで話題の人気急上昇セラピスト。",
                "specialties": ["デトックス", "リンパ"],
            },
            {
                "name": "琴音",
                "alias": "癒し系",
                "avatar_url": "https://i.pravatar.cc/160?img=17",
                "headline": "優しい雰囲気で心からリラックス。",
                "specialties": ["アロマ", "ヘッドマッサージ"],
            },
        ],
    },
    {
        "slug": "sample-tennoji-garden",
        "name": "ヒーリングガーデン 天王寺",
        "area": "天王寺",
        "price_min": 8000,
        "price_max": 15000,
        "bust_tag": "D",
        "service_type": "store",
        "nearest_station": "天王寺駅",
        "station_walk_minutes": 4,
        "address": "大阪市阿倍野区天王寺4-4-4",
        "description": "天王寺駅徒歩4分。アットホームな雰囲気で初めての方も安心。",
        "catch_copy": "気軽に通えるリラクゼーション",
        "staff": [
            {
                "name": "乃愛",
                "alias": "元気印",
                "avatar_url": "https://i.pravatar.cc/160?img=20",
                "headline": "明るい笑顔でお客様を元気にします。",
                "specialties": ["オイル", "足ツボ"],
            },
            {
                "name": "花音",
                "alias": "丁寧派",
                "avatar_url": "https://i.pravatar.cc/160?img=21",
                "headline": "一つ一つの動作を丁寧に行います。",
                "specialties": ["リンパ", "フェイシャル"],
            },
            {
                "name": "心愛",
                "alias": "新人",
                "avatar_url": "https://i.pravatar.cc/160?img=22",
                "headline": "研修を終えたばかりの新人セラピスト。",
                "specialties": ["オイル"],
            },
            {
                "name": "美咲",
                "alias": "ベテラン",
                "avatar_url": "https://i.pravatar.cc/160?img=23",
                "headline": "5年の経験で安定した技術を提供。",
                "specialties": ["全身", "ストレッチ", "指圧"],
            },
        ],
    },
]


def _log(message: str) -> None:
    print(f"[seed-e2e] {message}", file=sys.stderr)


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
        if candidate and candidate[0] in "\"'" and candidate[-1] == candidate[0]:
            candidate = candidate[1:-1].strip()
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


def _find_shop_by_slug(base: str, headers: Dict[str, str], slug: str) -> Optional[str]:
    """Find existing shop by slug, return shop_id or None."""
    try:
        data = _request_json(
            base,
            "GET",
            "/api/admin/shops",
            headers=headers,
            expected=(200,),
        )
        items = (data or {}).get("items") if isinstance(data, dict) else None
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict) and item.get("slug") == slug:
                    return str(item.get("id"))
    except Exception as exc:
        _log(f"failed to list shops: {exc}")
    return None


def _create_shop(
    base: str,
    headers: Dict[str, str],
    shop_def: Dict[str, Any],
    therapist_ids: List[str],
) -> str:
    """Create a shop with staff. Returns shop_id."""
    slug = shop_def["slug"]

    # Check if shop already exists
    existing_id = _find_shop_by_slug(base, headers, slug)
    if existing_id:
        _log(f"shop {slug} already exists (id={existing_id})")
        return existing_id

    # Build staff list with fixed IDs
    staff_entries = []
    for i, staff_def in enumerate(shop_def.get("staff", [])):
        staff_id = therapist_ids[i] if i < len(therapist_ids) else None
        entry = dict(staff_def)
        if staff_id:
            entry["id"] = staff_id
        staff_entries.append(entry)

    today = date.today().isoformat()

    # Build contact_json with rich data
    contact_json = {
        "store_name": shop_def["name"],
        "address": shop_def.get("address", ""),
        "phone": f"090-0000-{hash(slug) % 10000:04d}",
        "tel": f"090-0000-{hash(slug) % 10000:04d}",
        "line_id": f"{slug.replace('-', '_')}_line",
        "line": f"{slug.replace('-', '_')}_line",
        "website_url": f"https://example.com/{slug}",
        "web": f"https://example.com/{slug}",
        "service_tags": ["完全個室", "日本人セラピスト", "初回割引"],
        "menus": [
            {
                "name": "スタンダード90分",
                "price": shop_def["price_min"] + 2000,
                "duration_minutes": 90,
                "description": "全身を丁寧にケアする定番コースです。",
                "tags": ["オイル", "リンパ"],
            },
            {
                "name": "プレミアム120分",
                "price": shop_def["price_max"],
                "duration_minutes": 120,
                "description": "VIPルームでゆったり過ごす贅沢プラン。",
                "tags": ["個室", "VIP"],
            },
        ],
        "staff": staff_entries,
        "reviews": {
            "average_score": 4.5,
            "review_count": 50,
            "highlighted": [
                {
                    "title": "技術も接客も大満足",
                    "body": "丁寧な施術で疲れが一気に取れました。会話も心地よくてリピート決定です。",
                    "score": 5,
                    "visited_at": today,
                    "author_alias": "匿名会員A",
                },
                {
                    "title": "癒されました",
                    "body": "とてもリラックスできました。また来ます。",
                    "score": 4,
                    "visited_at": today,
                    "author_alias": "匿名会員B",
                },
            ],
        },
        "promotions": [
            {
                "label": "初回限定割引",
                "description": "初めてのお客様は2,000円OFF",
                "expires_at": (date.today() + timedelta(days=30)).isoformat(),
            },
        ],
    }

    create_payload = {
        "slug": slug,
        "name": shop_def["name"],
        "area": shop_def["area"],
        "price_min": shop_def["price_min"],
        "price_max": shop_def["price_max"],
        "bust_tag": shop_def.get("bust_tag", "D"),
        "service_type": shop_def.get("service_type", "store"),
        "nearest_station": shop_def.get("nearest_station"),
        "station_walk_minutes": shop_def.get("station_walk_minutes"),
        "body_tags": ["清楚", "スレンダー"],
        "photos": [
            f"https://picsum.photos/seed/{slug}-1/800/600",
            f"https://picsum.photos/seed/{slug}-2/800/600",
            f"https://picsum.photos/seed/{slug}-3/800/600",
        ],
        "contact_json": contact_json,
        "ranking_badges": [],
        "ranking_weight": 100,
        "status": "published",
    }

    try:
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
            raise RuntimeError(f"unexpected response: {created!r}")
        shop_id = str(created["id"])
        _log(f"created shop {slug} (id={shop_id})")
        return shop_id
    except RuntimeError as exc:
        if "already exists" in str(exc).lower() or "duplicate" in str(exc).lower():
            existing_id = _find_shop_by_slug(base, headers, slug)
            if existing_id:
                _log(f"shop {slug} already exists (id={existing_id})")
                return existing_id
        raise


def _add_availability(
    base: str,
    headers: Dict[str, str],
    shop_id: str,
) -> None:
    """Add availability slots for today and next 3 days."""
    for offset in range(4):
        slot_date = date.today() + timedelta(days=offset)
        try:
            _request_json(
                base,
                "POST",
                "/api/admin/availabilities",
                headers=headers,
                params={"profile_id": shop_id, "date": slot_date.isoformat()},
                expected=(200, 201, 202, 204, 409),  # 409 = already exists
            )
        except Exception as exc:
            _log(f"availability for {slot_date} failed (ignored): {exc}")


def _add_therapist_shifts(
    base: str,
    headers: Dict[str, str],
    shop_id: str,
    therapist_ids: List[str],
) -> None:
    """Add therapist shifts for today and next 3 days to enable availability display."""
    today = date.today()

    for therapist_id in therapist_ids:
        for offset in range(4):  # Today + 3 days
            shift_date = today + timedelta(days=offset)
            # Shift from 10:00 to 22:00
            start_at = datetime.combine(shift_date, datetime.min.time()).replace(
                hour=10, tzinfo=timezone.utc
            )
            end_at = datetime.combine(shift_date, datetime.min.time()).replace(
                hour=22, tzinfo=timezone.utc
            )

            # Add a break slot for lunch (13:00-14:00)
            break_start = datetime.combine(shift_date, datetime.min.time()).replace(
                hour=13, tzinfo=timezone.utc
            )
            break_end = datetime.combine(shift_date, datetime.min.time()).replace(
                hour=14, tzinfo=timezone.utc
            )

            payload = {
                "therapist_id": therapist_id,
                "shop_id": shop_id,
                "date": shift_date.isoformat(),
                "start_at": start_at.isoformat(),
                "end_at": end_at.isoformat(),
                "break_slots": [
                    {
                        "start_at": break_start.isoformat(),
                        "end_at": break_end.isoformat(),
                    }
                ],
                "availability_status": "available",
                "notes": f"E2E sample shift for {shift_date}",
            }

            try:
                _request_json(
                    base,
                    "POST",
                    "/api/admin/therapist_shifts",
                    headers=headers,
                    payload=payload,
                    expected=(200, 201, 409),  # 409 = already exists (overlap)
                )
                _log(
                    f"created shift for therapist {therapist_id[:8]}... on {shift_date}"
                )
            except Exception as exc:
                _log(f"shift creation failed (ignored): {exc}")


def _add_reservations(
    base: str,
    headers: Dict[str, str],
    shop_id: str,
    therapist_ids: List[str],
) -> None:
    """Add sample reservations in various states."""
    now = datetime.now(timezone.utc)

    reservations = [
        {
            "status": "confirmed",
            "start_offset_hours": 2,
            "therapist_idx": 0,
            "customer_name": "田中太郎",
        },
        {
            "status": "pending",
            "start_offset_hours": 26,
            "therapist_idx": 1,
            "customer_name": "鈴木花子",
        },
        {
            "status": "completed",
            "start_offset_hours": -48,
            "therapist_idx": 0,
            "customer_name": "佐藤次郎",
        },
    ]

    for res_def in reservations:
        start_time = now + timedelta(hours=res_def["start_offset_hours"])
        end_time = start_time + timedelta(hours=2)
        therapist_id = (
            therapist_ids[res_def["therapist_idx"]]
            if res_def["therapist_idx"] < len(therapist_ids)
            else None
        )

        payload = {
            "shop_id": shop_id,
            "therapist_id": therapist_id,
            "channel": "web",
            "desired_start": start_time.isoformat(),
            "desired_end": end_time.isoformat(),
            "notes": f"E2E sample reservation ({res_def['status']})",
            "customer": {
                "name": res_def["customer_name"],
                "phone": "09000000000",
                "email": f"{res_def['customer_name'].lower().replace(' ', '')}@example.com",
            },
            "marketing_opt_in": False,
        }

        try:
            _request_json(
                base,
                "POST",
                "/api/v1/reservations",
                headers={},
                payload=payload,
                expected=(200, 201, 202, 204, 409, 422),  # Allow conflicts
            )
            _log(f"created {res_def['status']} reservation for shop {shop_id}")
        except Exception as exc:
            _log(f"reservation creation failed (ignored): {exc}")


def main(argv: Sequence[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Seed E2E sample data for Playwright tests"
    )
    parser.add_argument(
        "--api-base",
        help="Base URL for the API (e.g. https://api.example.com)",
    )
    parser.add_argument(
        "--admin-key",
        default=os.environ.get("OSAKAMENESU_ADMIN_API_KEY")
        or os.environ.get("ADMIN_API_KEY"),
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
        help="Optional bearer token",
    )
    parser.add_argument(
        "--skip-reservations",
        action="store_true",
        help="Skip creating sample reservations",
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

    created_shops = []

    try:
        for shop_def in SAMPLE_SHOPS:
            slug = shop_def["slug"]
            therapist_ids = SAMPLE_THERAPIST_IDS.get(slug, [])

            shop_id = _create_shop(base, headers, shop_def, therapist_ids)
            created_shops.append({"slug": slug, "id": shop_id})

            # Add availability
            _add_availability(base, headers, shop_id)

            # Add therapist shifts (for availability display)
            _add_therapist_shifts(base, headers, shop_id, therapist_ids)

            # Add reservations
            if not args.skip_reservations:
                _add_reservations(base, headers, shop_id, therapist_ids)

        # Trigger reindex
        try:
            _request_json(
                base,
                "POST",
                "/api/admin/reindex",
                headers=headers,
                params={},
                expected=(200, 201, 202, 204),
            )
            _log("reindex triggered")
        except Exception as exc:
            _log(f"reindex failed (ignored): {exc}")

    except Exception as exc:
        _log(f"seeding failed: {exc}")
        return 1

    _log(f"seeding completed: {len(created_shops)} shops")
    print(json.dumps({"shops": created_shops}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
