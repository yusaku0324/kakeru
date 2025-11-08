# API プロキシ運用メモ

## 目的

- Next.js 側の `/api/line/*` `/api/async/*` を FastAPI にフォワードし、LINE Webhook や非同期ジョブ用のエンドポイントを一元管理する。
- Next.js 16 で導入した `src/proxy.ts`（旧 Edge Middleware 相当）で HMAC 署名・簡易レート制限・CSRF チェックを実施し、Cloud Run 側の負荷と攻撃面を緩和する。

## 挙動概要

- すべてのリクエストは `src/proxy.ts` で判定される（Next.js 16 の「Proxy」機構。旧 `src/middleware.ts` は廃止済み）。
  - `/admin/**` `/api/admin/**` は既存の Basic 認証でガード。
  - `/dashboard/**` は未ログイン時に `/login?from=...` へリダイレクト。
  - `/api/line/*` `/api/async/*` は FastAPI (`OSAKAMENESU_API_INTERNAL_BASE`) へ `NextResponse.rewrite`。
  - それ以外の `/api/*` は Next.js 側の Route Handler / fallback rewrite に委譲。
- 送信ヘッダー：
  - `x-osakamenesu-signature`：`HMAC-SHA256(timestamp:METHOD:pathname+search)`。
  - `x-osakamenesu-signature-ts`：UNIX 秒。
  - `x-forwarded-host` / `x-forwarded-proto`：Cloud Run 側のアクセスログ用。
- レート制限：1IP あたり 60 秒間に 30 リクエストまで（超過で 429）。
- CSRF：`/api/line/*` などでも Cookie ベースの CSRF トークンを検証（`shouldBypassCsrf` で除外可）。

## 必要な環境変数

`apps/web/.env.local.example` に追加済み。

```
API_PROXY_HMAC_SECRET=dev-proxy-secret
```

FastAPI 側では同一値を `API_PROXY_HMAC_SECRET`（または `PROXY_SHARED_SECRET`）として読み取り、ヘッダーの検証を行う。`/api/line/*` / `/api/async/*` を扱う際、`x-osakamenesu-signature` と `x-osakamenesu-signature-ts` を `300` 秒の時刻猶予で検証します。誤った値の場合は 401（または設定未完了時は 503）を返します。

## 署名検証のサンプル（FastAPI 側）

```python
import hmac
import time
from hashlib import sha256

def verify_signature(secret: str, ts: str, method: str, path: str, signature: str) -> bool:
    # 時刻スキューは ±300 秒程度で許容
    now = int(time.time())
    if abs(now - int(ts)) > 300:
        return False

    payload = f"{ts}:{method}:{path}"
    expected = hmac.new(secret.encode(), payload.encode(), sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

## 動作確認

1. `.env.local` に `API_PROXY_HMAC_SECRET` を設定して `npm run dev --turbo`。
2. `curl http://localhost:3000/api/line/ping` や `curl http://localhost:3000/api/async/ping` を実行。
3. Cloud Run 側ログで `x-osakamenesu-signature` が付いていることを確認。
4. 署名 mismatch / timestamp ずれ / レート超過時は 403 / 429 応答が返る。

### `/api/async/jobs` で予約通知を enqueue する例

```bash
curl -X POST http://localhost:3000/api/async/jobs \\
  -H 'Content-Type: application/json' \\
  -d '{
    "type": "reservation_notification",
    "schedule_at": "2025-11-07T12:00:00+09:00",
    "notification": {
      "reservation_id": "00000000-0000-0000-0000-000000000001",
      "shop_id": "00000000-0000-0000-0000-000000000010",
      "shop_name": "テスト店",
      "customer_name": "山田太郎",
      "customer_phone": "090",
      "desired_start": "2025-11-08T12:00:00+09:00",
      "desired_end": "2025-11-08T13:00:00+09:00",
      "status": "pending"
    }
  }'
```

- `type: reservation_notification` … 通常のショップ向け通知
- `type: reservation_reminder` … `notification.reminder_at` を必須とし、`event=reminder` `audience=customer` でリマインド送信
- `type: reservation_cancellation` … ステータスを `cancelled` に強制

`schedule_at` を指定すると UTC へ変換したうえで遅延実行として登録します。リマインド実行など他のジョブ種別も同じエンドポイントで受け付けます。
