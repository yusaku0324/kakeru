## Reservation Notification Payload Updates

最新版の予約ワークフローでは、LINE/メール向け通知に以下の拡張フィールドが追加されています。連携側サービスの JSON 受け入れが必要になります。

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `actions` | `[{ label, url, action }]` | LINE 通知で「承認する」「辞退する」などのボタンを表示するための定義。`url` は FastAPI 側の `POST /api/v1/reservations/{id}/decision` にリダイレクトします。 |
| `reminder_at` | ISO8601 文字列 | 自動リマインド通知の対象日時。予約開始の 3 時間前を基準に設定されています。 |

### LINE Messaging API への送信例

```json
{
  "message": "（本文省略）",
  "reservation_id": "…",
  "shop_id": "…",
  "token": "line-token",
  "webhook_url": "https://hooks.example.com/line",
  "actions": [
    { "label": "承認する", "url": "https://api.example.com/api/v1/reservations/.../decision?token=...&decision=approved", "action": "approve" },
    { "label": "辞退する", "url": "https://api.example.com/api/v1/reservations/.../decision?token=...&decision=declined", "action": "decline" }
  ],
  "reminder_at": "2025-05-01T07:00:00+09:00"
}
```

`webhook_url` はダッシュボードで設定したエンドポイントを示し、保存時に LINE Messaging API へ自動同期されます。LINE 側でボタン表示が不要な場合は、ペイロードから `actions` を無視するか、通知エンドポイントで削除してから送信してください。 `reminder_at` はリマインド判定・文面表示に使用できる補助フィールドです。
