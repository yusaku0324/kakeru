# Ops MCP 読み取りエンドポイント

Day3–7 のタスクとして、MCP から読み取れる最小限の運用メトリクス API を追加しました。  
FastAPI のエンドポイント経由で取得できるため、Slack や管理画面からも利用できます。

## エンドポイント一覧

| Path | 説明 |
| --- | --- |
| `GET /api/ops/queue` | 通知配送キューの件数・最古の作成時刻などを返します |
| `GET /api/ops/outbox` | キュー内の通知をチャネル別に集計します |
| `GET /api/ops/slots` | 予約スロット（予約テーブル）から未処理件数や24時間以内の確定数を集計します |

### 認証

`.env` もしくは環境変数で `OPS_API_TOKEN` を設定すると、各エンドポイントは  
`Authorization: Bearer <token>` ヘッダーを要求します（`Bearer` なしの生値でも可）。  
トークンを未設定の場合は認証不要で呼び出せます。Slack 連携や MCP から呼ぶ際は以下のように指定してください。

```bash
curl -H "Authorization: Bearer $OPS_API_TOKEN" https://api.example.com/api/ops/queue
```

### `/api/ops/queue`

```json
{
  "pending": 4,
  "lag_seconds": 128.4,
  "oldest_created_at": "2025-11-07T02:15:00+00:00",
  "next_attempt_at": "2025-11-07T02:16:00+00:00"
}
```

- `lag_seconds` は最古の `pending` レコードからの経過秒数（負値は 0 ）  
- `next_attempt_at` が `null` の場合は再送予定が未設定

### `/api/ops/outbox`

```json
{
  "channels": [
    { "channel": "email", "pending": 2 },
    { "channel": "line", "pending": 1 }
  ]
}
```

### `/api/ops/slots`

```json
{
  "pending_total": 5,
  "pending_stale": 1,
  "confirmed_next_24h": 7,
  "window_start": "2025-11-07T02:20:00+00:00",
  "window_end": "2025-11-08T02:20:00+00:00"
}
```

- `pending_stale` は `desired_start < 現在` の未処理予約  
- `confirmed_next_24h` は今後24時間以内の確定予約件数

## Slack / ChatOps サンプル

Slack の Slash コマンドから叩く場合は以下のような `fetch` を用意します。

```javascript
// Slack Bolt の例
app.command('/ops-queue', async ({ ack, respond }) => {
  await ack();
  const res = await fetch('https://<API_HOST>/api/ops/queue', {
    headers: { Authorization: `Bearer ${process.env.OPS_API_TOKEN}` },
  });
  const data = await res.json();
  await respond(`Pending: ${data.pending}\nLag: ${data.lag_seconds?.toFixed(1)}s`);
});
```

同様に `outbox` や `slots` も呼び出せます。  
MCP 側では `fetchJSON("https://.../api/ops/queue")` のように読み取るユーティリティを追加するだけで済みます。
