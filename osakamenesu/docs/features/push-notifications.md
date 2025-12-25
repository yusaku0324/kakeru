# プッシュ通知機能

## 概要

PWA（Progressive Web App）のプッシュ通知機能を実装し、以下の通知を送信できます：

- 予約確認通知
- 予約リマインダー
- レビューへの返信通知
- その他の重要なお知らせ

## 技術スタック

- **Web Push API**: ブラウザのプッシュ通知機能
- **VAPID (Voluntary Application Server Identification)**: サーバー認証
- **Service Worker**: バックグラウンドでの通知処理
- **pywebpush**: Pythonでのプッシュ通知送信ライブラリ

## セットアップ

### 1. VAPIDキーの生成

```bash
cd services/api
python scripts/generate-vapid-keys.py
```

生成されたキーを環境変数に設定：

**API側 (.env)**:
```env
VAPID_PRIVATE_KEY=<生成されたプライベートキー>
VAPID_PUBLIC_KEY=<生成されたパブリックキー>
```

**Web側 (.env.local)**:
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<生成されたパブリックキー>
```

### 2. データベースマイグレーション

```bash
cd services/api
alembic upgrade head
```

## 使用方法

### ユーザー側の設定

1. ユーザーがアカウント設定ページにアクセス
2. 「プッシュ通知」セクションでトグルをONにする
3. ブラウザの通知許可ダイアログで「許可」を選択
4. テスト通知ボタンで動作確認

### 開発者向けAPI

#### 通知を送信する

```python
from app.services.push_notification import push_notification_service

# 単一ユーザーへの通知
await push_notification_service.send_notification(
    user_id=user.id,
    title="予約が確定しました",
    body="明日15:00からの予約が確定しました",
    db=db,
    url="/reservations/123",
    tag="reservation-confirmation",
)

# 複数ユーザーへの通知
await push_notification_service.send_bulk_notification(
    title="メンテナンスのお知らせ",
    body="明日2:00-4:00にメンテナンスを実施します",
    db=db,
    user_ids=[user1.id, user2.id],
)
```

#### 特定の通知タイプ

```python
# 予約確認通知
await push_notification_service.notify_reservation_confirmation(
    user_id=user.id,
    reservation_id=reservation.id,
    shop_name="Shop Name",
    therapist_name="Therapist Name",
    date="2024-01-01",
    time="15:00",
    db=db,
)

# レビュー返信通知
await push_notification_service.notify_new_review_reply(
    user_id=user.id,
    shop_name="Shop Name",
    db=db,
)
```

## フロントエンド実装

### React Hook

```typescript
import { usePushNotifications } from '@/hooks/use-push-notifications'

function NotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
    testNotification,
  } = usePushNotifications()

  // UIの実装
}
```

### Service Worker

Service Workerは以下の処理を行います：

1. プッシュイベントの受信
2. 通知の表示
3. 通知クリック時のナビゲーション
4. アクションボタンの処理

## セキュリティ

- VAPIDキーによるサーバー認証
- HTTPSでのみ動作
- ユーザー認証が必要
- 通知の購読情報は暗号化されて保存

## トラブルシューティング

### 通知が届かない場合

1. ブラウザの通知設定を確認
2. Service Workerが登録されているか確認
3. VAPIDキーが正しく設定されているか確認
4. HTTPSで接続しているか確認

### 開発環境での注意点

- localhostではHTTPSなしでも動作
- ブラウザによって挙動が異なる場合がある
- シークレットモードでは動作しない場合がある

## 今後の拡張予定

- [ ] 通知のカテゴリー別ON/OFF設定
- [ ] 通知の履歴表示
- [ ] リッチ通知（画像付き通知）
- [ ] 通知のスケジューリング機能