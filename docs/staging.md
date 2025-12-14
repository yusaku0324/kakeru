# Staging（Fly）運用 Runbook

目的: **prodを触らず**に検証できる安全弁（レート制限/データ不足/再現性の問題を回避する）。

## 方針（固定）

- prod（app/DB/secret/ips/volume）は一切操作しない
- STGは PII を入れない（検証用の架空データのみ）
- STGは「2店舗 + 2セラ + 未来シフト」のみで再現/検証する
- APIはアイドル時 0台（コスト最小化）

## Time zone invariants（JST基準）

- `today_available` と `availability_calendar.days[].is_today` は **JSTの「今日」**（`now_jst().date()`）で判定される
- UTC日付とJST日付がズレる時間帯でも、JST側の「今日」が正になる

再現（STG / GET 1回）:

```bash
curl -sS \
  https://osakamenesu-api-stg.fly.dev/api/v1/shops/ca40f333-cc6f-492a-8d0c-d137448fad67
```

証跡（UTC=2025-12-14 / JST=2025-12-15 の境界で、JST日付が `is_today=true` になる例）:

```json
{
  "shop_id": "ca40f333-cc6f-492a-8d0c-d137448fad67",
  "today_available": true,
  "next_available_at": "2025-12-15T03:00:00+09:00",
  "availability_calendar_first_day": {
    "date": "2025-12-15",
    "is_today": true,
    "first_slot_start_at": "2025-12-15T00:00:00+09:00"
  }
}
```

## 対象リソース

- Fly app: `osakamenesu-api-stg`
- Fly Postgres: `osakamenesu-db-stg`

## 現状確認（インベントリ）

```bash
flyctl status -a osakamenesu-api-stg
flyctl machine list -a osakamenesu-api-stg
flyctl logs -a osakamenesu-api-stg --max-lines 50

flyctl postgres status -a osakamenesu-db-stg
flyctl postgres list
```

## コスト最小化（アイドル時 0台）

- 設定ファイル: `osakamenesu/services/api/fly.stg.toml`
- ポイント:
  - `[http_service].min_machines_running = 0`
  - `auto_stop_machines='suspend'`
  - `auto_start_machines=true`

確認:

```bash
flyctl machine list -a osakamenesu-api-stg
# idle後に state=suspended になっていること（min=0なら0台でもOK）
```

## デプロイ（STG専用設定を使う）

```bash
cd osakamenesu/services/api
flyctl deploy -a osakamenesu-api-stg --remote-only -c fly.stg.toml
curl -sS https://osakamenesu-api-stg.fly.dev/healthz
```

## DB接続（重要: asyncpg）

このAPIは `create_async_engine()` を使うため、`DATABASE_URL` は `postgresql+asyncpg://...` である必要がある。
`flyctl postgres attach` で入る `postgresql://...` のままだと起動時に落ちる場合がある。

手順（値は貼らないこと）:

```bash
# 例: attachで出たURLのスキームを +asyncpg に差し替えて secret として設定する
flyctl secrets set -a osakamenesu-api-stg DATABASE_URL='postgresql+asyncpg://***'
```

## マイグレーション

release_command が無い/効かない場合は SSH で実行する。

```bash
flyctl ssh console -a osakamenesu-api-stg -C "sh -lc 'cd /app && alembic upgrade head'"
```

### STGスキーマの差分パッチ（必要な場合のみ）

現状のalembicがカバーしていないカラムがある場合、STGでのみ **明示的に追加**して動作を成立させる。
（この操作はSTGのみ。prodには絶対に適用しない）

```bash
flyctl ssh console -a osakamenesu-api-stg
# (remote)
python - <<'PY'
import asyncio
from sqlalchemy import text

from app.db import SessionLocal


async def main() -> None:
    async with SessionLocal() as db:
        await db.execute(
            text(
                "ALTER TABLE profiles "
                "ADD COLUMN IF NOT EXISTS buffer_minutes INTEGER NOT NULL DEFAULT 0"
            )
        )
        await db.execute(
            text(
                "ALTER TABLE therapists "
                "ADD COLUMN IF NOT EXISTS photo_embedding DOUBLE PRECISION[]"
            )
        )
        await db.execute(
            text(
                "ALTER TABLE therapists "
                "ADD COLUMN IF NOT EXISTS photo_embedding_computed_at TIMESTAMPTZ"
            )
        )
        await db.execute(
            text(
                "ALTER TABLE therapists "
                "ADD COLUMN IF NOT EXISTS main_photo_index INTEGER DEFAULT 0"
            )
        )
        await db.commit()


asyncio.run(main())
PY
```

## Seed（A成功 / B outside_business_hours の再現）

目的:

- A: booking_hours 未設定 → 予約成功（status=confirmed）
- B: booking_hours 設定済み（18:00-02:00）→ 03:00開始で `outside_business_hours`

### 1) Seed投入（PIIなし・2店舗/2セラのみ）

```bash
flyctl ssh console -a osakamenesu-api-stg
# (remote)
python - <<'PY'
import asyncio
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import delete, select

from app import models
from app.db import SessionLocal
from app.services.availability_sync import sync_availability_for_date

JST = timezone(timedelta(hours=9))

SHOP_A_NAME = "STG Shop A (no booking_hours)"
SHOP_B_NAME = "STG Shop B (booking_hours)"


def booking_hours_everyday_18_02() -> dict:
    return {
        "tz": "Asia/Tokyo",
        "weekly": [
            {"weekday": wd, "segments": [{"open": "18:00", "close": "02:00"}]}
            for wd in range(0, 7)
        ],
        "overrides": [],
    }


async def main() -> None:
    target_date = (datetime.now(JST).date() + timedelta(days=1))

    async with SessionLocal() as db:
        # cleanup (idempotent): delete existing STG shops by name
        res = await db.execute(
            select(models.Profile.id).where(
                models.Profile.name.in_([SHOP_A_NAME, SHOP_B_NAME])
            )
        )
        shop_ids = [r[0] for r in res.fetchall()]
        if shop_ids:
            await db.execute(
                delete(models.GuestReservation).where(
                    models.GuestReservation.shop_id.in_(shop_ids)
                )
            )
            await db.execute(
                delete(models.TherapistShift).where(
                    models.TherapistShift.shop_id.in_(shop_ids)
                )
            )
            await db.execute(
                delete(models.Availability).where(
                    models.Availability.profile_id.in_(shop_ids)
                )
            )
            await db.execute(
                delete(models.Therapist).where(
                    models.Therapist.profile_id.in_(shop_ids)
                )
            )
            await db.execute(delete(models.Profile).where(models.Profile.id.in_(shop_ids)))
            await db.commit()

        shop_a = models.Profile(
            name=SHOP_A_NAME,
            area="stg",
            price_min=10000,
            price_max=20000,
            bust_tag="C",
            status="published",
            contact_json={},
            buffer_minutes=0,
        )
        shop_b = models.Profile(
            name=SHOP_B_NAME,
            area="stg",
            price_min=10000,
            price_max=20000,
            bust_tag="C",
            status="published",
            contact_json={
                "booking_rules": {
                    "base_buffer_minutes": 0,
                    "max_extension_minutes": 0,
                    "extension_step_minutes": 15,
                },
                "booking_hours": booking_hours_everyday_18_02(),
            },
            buffer_minutes=0,
        )

        db.add_all([shop_a, shop_b])
        await db.flush()

        therapist_a = models.Therapist(
            profile_id=shop_a.id,
            name="STG Therapist A",
            status="published",
            is_booking_enabled=True,
            main_photo_index=0,
        )
        therapist_b = models.Therapist(
            profile_id=shop_b.id,
            name="STG Therapist B",
            status="published",
            is_booking_enabled=True,
            main_photo_index=0,
        )

        db.add_all([therapist_a, therapist_b])
        await db.flush()

        shift_a = models.TherapistShift(
            therapist_id=therapist_a.id,
            shop_id=shop_a.id,
            date=target_date,
            start_at=datetime.combine(target_date, time(10, 0)).replace(tzinfo=JST),
            end_at=datetime.combine(target_date, time(12, 0)).replace(tzinfo=JST),
            availability_status="available",
        )
        # outside_business_hours を優先で取るため、03:00を含むシフトを作る
        shift_b = models.TherapistShift(
            therapist_id=therapist_b.id,
            shop_id=shop_b.id,
            date=target_date,
            start_at=datetime.combine(target_date, time(0, 0)).replace(tzinfo=JST),
            end_at=datetime.combine(target_date, time(6, 0)).replace(tzinfo=JST),
            availability_status="available",
        )

        db.add_all([shift_a, shift_b])
        await db.flush()

        # optional cache
        await sync_availability_for_date(db, shop_a.id, target_date)
        await sync_availability_for_date(db, shop_b.id, target_date)

        await db.commit()

        print("SEED_OK")
        print(f"date={target_date.isoformat()}")
        print(f"shopA_id={shop_a.id}")
        print(f"therapistA_id={therapist_a.id}")
        print(f"shopB_id={shop_b.id}")
        print(f"therapistB_id={therapist_b.id}")


asyncio.run(main())
PY
```

### 2) 再現（POSTは合計2回だけの型）

```bash
BASE='https://osakamenesu-api-stg.fly.dev'
DATE='YYYY-MM-DD'  # seed出力のdate
SHOP_A='***'
THER_A='***'
SHOP_B='***'
THER_B='***'

# A: 予約成功（booking_hours未設定）
curl -i -sS -X POST \"$BASE/api/guest/reservations\" \\
  -H 'Content-Type: application/json' \\
  -d '{\"shop_id\":\"'\"$SHOP_A\"'\",\"therapist_id\":\"'\"$THER_A\"'\",\"start_at\":\"'\"$DATE\"'T10:00:00+09:00\",\"duration_minutes\":120,\"planned_extension_minutes\":0}'

# B: outside_business_hours（18:00-02:00の店で 03:00開始）
curl -i -sS -X POST \"$BASE/api/guest/reservations\" \\
  -H 'Content-Type: application/json' \\
  -d '{\"shop_id\":\"'\"$SHOP_B\"'\",\"therapist_id\":\"'\"$THER_B\"'\",\"start_at\":\"'\"$DATE\"'T03:00:00+09:00\",\"duration_minutes\":30,\"planned_extension_minutes\":0}'
```

## 破棄手順（記載のみ・今は実行しない）

```bash
flyctl apps destroy osakamenesu-api-stg --yes
flyctl postgres destroy osakamenesu-db-stg --yes
```
