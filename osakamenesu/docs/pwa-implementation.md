# PWA実装ガイド

## 概要

OsakamenesuのProgressive Web App (PWA) 実装により、ネイティブアプリのような体験を提供します。

## 実装済み機能

### 1. 基本的なPWA設定
- **Web App Manifest** (`/public/manifest.json`)
  - アプリ名、アイコン、テーマカラー
  - スタンドアロンモード対応
  - ショートカット設定

- **Service Worker** (`/public/sw.js`)
  - オフライン対応
  - キャッシュ戦略
  - バックグラウンド同期

### 2. オフライン機能
- **IndexedDB によるデータ永続化**
  - 店舗・セラピスト情報のキャッシュ
  - 予約データのオフライン保存

- **オフラインページ** (`/public/offline.html`)
  - ネットワーク接続なしでも基本的なUIを表示

- **自動同期**
  - オンライン復帰時に自動的にデータ同期

### 3. インストールプロンプト
- **インストール促進UI**
  - 適切なタイミングでインストールを提案
  - iOS向けの手動インストールガイド

### 4. パフォーマンス最適化
- **キャッシュ戦略**
  - 静的アセット: Cache First
  - API: Network First with Cache Fallback
  - 画像: Cache First with Background Update

## セットアップ

### 1. 依存関係のインストール

```bash
cd services/web
pnpm add next-pwa dexie
pnpm add -D @types/serviceworker
```

### 2. アプリケーションへの統合

```tsx
// app/layout.tsx
import { PWAProvider } from '@/providers/PWAProvider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FF6B6B" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body>
        <PWAProvider>{children}</PWAProvider>
      </body>
    </html>
  )
}
```

### 3. メタタグの追加

```tsx
// app/metadata.ts
export const metadata = {
  // ... existing metadata
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Osakamenesu',
  },
}
```

## 使用方法

### オフライン対応データフェッチング

```tsx
import { useOfflineShops } from '@/hooks/useOfflineData'

export function ShopList() {
  const { shops, isLoading, isOffline } = useOfflineShops()

  if (isOffline) {
    return (
      <div className="bg-amber-100 p-4 rounded">
        <p>オフラインモードで表示しています</p>
      </div>
    )
  }

  // ... render shops
}
```

### オフライン予約の保存

```tsx
import { saveReservationOffline } from '@/lib/offline/sync'
import { useOnlineStatus } from '@/lib/pwa'

export function ReservationForm() {
  const isOnline = useOnlineStatus()

  const handleSubmit = async (data: ReservationData) => {
    if (!isOnline) {
      // オフラインで保存
      const id = await saveReservationOffline({
        shopId: data.shopId,
        therapistId: data.therapistId,
        userId: data.userId,
        date: data.date,
        time: data.time,
        duration: data.duration,
      })

      alert('予約をオフラインで保存しました。オンライン時に自動送信されます。')
      return
    }

    // オンラインで送信
    await submitReservation(data)
  }
}
```

## プッシュ通知

### 1. VAPID鍵の生成

```bash
npx web-push generate-vapid-keys
```

### 2. 環境変数の設定

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
```

### 3. 通知の許可とサブスクリプション

```tsx
import { usePushNotifications } from '@/lib/pwa'

export function NotificationSettings() {
  const { permission, subscribe } = usePushNotifications(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
  )

  const handleEnable = async () => {
    await subscribe()
  }

  return (
    <button onClick={handleEnable} disabled={permission === 'denied'}>
      通知を有効にする
    </button>
  )
}
```

## アイコンの生成

必要なアイコンサイズ：
- 72x72
- 96x96
- 128x128
- 144x144
- 152x152
- 192x192
- 384x384
- 512x512

```bash
# ImageMagickを使用した一括生成
convert original-icon.png -resize 72x72 public/icons/icon-72x72.png
convert original-icon.png -resize 96x96 public/icons/icon-96x96.png
# ... 他のサイズも同様
```

## テスト

### 1. Lighthouse PWA監査

```bash
# Chrome DevToolsのLighthouseタブで実行
# または
npx lighthouse https://localhost:3000 --view
```

### 2. オフライン動作テスト

1. Chrome DevTools → Network → Offline にチェック
2. アプリケーションの動作確認
3. データの永続化確認

### 3. インストールテスト

1. HTTPSでアクセス（localhost は例外）
2. アドレスバーのインストールアイコンを確認
3. インストール後の動作確認

## デプロイ時の注意点

### 1. HTTPS必須
PWAはHTTPS環境でのみ動作します（localhostは例外）。

### 2. Service Workerの更新

```javascript
// 新しいバージョンのService Workerを強制的に有効化
self.addEventListener('activate', event => {
  event.waitUntil(
    clients.claim() // 即座に新しいSWをアクティブに
  )
})
```

### 3. キャッシュのバージョニング

```javascript
const CACHE_NAME = 'osakamenesu-v2' // バージョンを更新
```

## トラブルシューティング

### Service Workerが更新されない

1. Chrome DevTools → Application → Service Workers
2. "Update on reload" をチェック
3. または手動で Unregister

### オフラインで動作しない

1. キャッシュストラテジーを確認
2. ネットワークリクエストのフォールバック処理を確認
3. IndexedDBのデータ保存を確認

### インストールプロンプトが表示されない

1. PWA要件を満たしているか確認
   - HTTPS
   - 有効なmanifest.json
   - Service Worker登録
   - start_urlへのアクセス可能

## パフォーマンス指標

- **First Contentful Paint**: < 1.8s
- **Time to Interactive**: < 3.9s
- **Speed Index**: < 3.4s
- **Largest Contentful Paint**: < 2.5s

## 今後の改善

1. **Workbox への移行**
   - より高度なキャッシュ戦略
   - プリキャッシング

2. **Background Fetch API**
   - 大きなファイルのダウンロード
   - 進捗表示

3. **Web Share API**
   - ネイティブ共有機能

4. **Periodic Background Sync**
   - 定期的なデータ更新