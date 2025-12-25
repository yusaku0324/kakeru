# キャッシュ戦略ガイド

## 概要

Osakamenesu APIのパフォーマンス最適化のため、多層キャッシュ戦略を実装しています。

## キャッシュレイヤー

### 1. HTTPキャッシュヘッダー
- ブラウザとCDNレベルでのキャッシュ
- 静的コンテンツと準動的コンテンツに適用
- `Cache-Control`、`ETag`、`Vary`ヘッダーを使用

### 2. メモリキャッシュ
- アプリケーションレベルの高速キャッシュ
- TTL（Time To Live）ベースの自動期限切れ
- LRU（Least Recently Used）による自動削除

### 3. Redisキャッシュ（分散キャッシュ）
- 複数のAPIインスタンス間で共有
- メモリキャッシュのフォールバック
- 永続性とスケーラビリティを提供

## 実装詳細

### HTTPキャッシュヘッダー

```python
# middleware/cache_headers.py
CACHE_CONFIGS = {
    # 公開エンドポイント（長めのキャッシュ）
    "/api/v1/shops": {"max_age": 300, "public": True},  # 5分
    "/api/shops": {"max_age": 300, "public": True},

    # 準動的コンテンツ（短めのキャッシュ）
    "/api/v1/therapists": {"max_age": 180, "public": True},  # 3分

    # ユーザー固有コンテンツ（プライベートキャッシュ）
    "/api/dashboard": {"max_age": 60, "private": True},  # 1分
    "/api/favorites": {"max_age": 60, "private": True},

    # キャッシュしない
    "/api/auth": {"no_cache": True},
    "/api/admin": {"no_cache": True},
    "/api/reservations": {"no_cache": True},
}
```

### メモリキャッシュ

```python
# utils/cache.py
# グローバルキャッシュインスタンス
shop_cache = TTLCache(ttl_seconds=300, max_size=500)  # 5分
therapist_cache = TTLCache(ttl_seconds=180, max_size=1000)  # 3分
availability_cache = TTLCache(ttl_seconds=60, max_size=500)  # 1分

# デコレータ使用例
@ttl_cache(ttl_seconds=300)
async def get_shop_detail(shop_id: str) -> dict:
    # 重い処理
    return result
```

### Redisキャッシュ

```python
# utils/redis_cache.py
# デコレータ使用例
@redis_cache(ttl_seconds=300)
async def get_popular_shops() -> list:
    # 重い処理
    return result

# 直接使用
redis = await get_redis_cache()
if redis:
    await redis.set("key", value, ttl=300)
    hit, value = await redis.get("key")
```

## キャッシュ無効化パターン

### 1. TTLベースの自動無効化
- 設定された時間後に自動的に期限切れ
- 最もシンプルで一般的なパターン

### 2. イベントベースの無効化
```python
# 予約作成時
await availability_cache.invalidate(f"availability_slots:{therapist_id}:{date}")

# シフト更新時
await availability_cache.invalidate_prefix(f"availability_slots:{therapist_id}")
```

### 3. 手動無効化
```bash
# 全キャッシュクリア
curl -X POST https://api.osakamenesu.com/api/ops/cache/clear \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{"cache_type": "all"}'

# 特定キャッシュクリア
curl -X POST https://api.osakamenesu.com/api/ops/cache/clear \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{"cache_type": "shop_cache"}'
```

## パフォーマンスモニタリング

### キャッシュメトリクス確認
```bash
curl https://api.osakamenesu.com/api/ops/cache/metrics \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

レスポンス例：
```json
{
  "memory_caches": [
    {
      "name": "shop_cache",
      "size": 150,
      "max_size": 500,
      "ttl_seconds": 300,
      "hit_rate": null
    }
  ],
  "redis_connected": true,
  "redis_url": "redis://localhost:6379"
}
```

## キャッシュウォーミング

```bash
# ショップデータの事前読み込み
curl -X POST https://api.osakamenesu.com/api/ops/cache/warm \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{"cache_type": "shops"}'
```

## ベストプラクティス

### 1. 適切なTTL設定
- 静的データ: 5-15分
- 準動的データ: 1-5分
- 高頻度更新データ: 30-60秒

### 2. キャッシュキーの設計
```python
# 良い例：名前空間を使用
cache_key = f"shop_detail:{shop_id}"
cache_key = f"therapist_availability:{therapist_id}:{date}"

# 悪い例：グローバルキー
cache_key = f"{shop_id}"  # 衝突の可能性
```

### 3. キャッシュの階層化
1. まずメモリキャッシュをチェック
2. 次にRedisキャッシュをチェック
3. 最後にDBから取得

### 4. 部分的な無効化
```python
# 特定の日付のみ無効化
await cache.invalidate(f"availability:{therapist_id}:{date}")

# セラピスト全体を無効化
await cache.invalidate_prefix(f"availability:{therapist_id}")
```

## トラブルシューティング

### キャッシュが効いていない場合
1. キャッシュメトリクスを確認
2. HTTPレスポンスヘッダーを確認
3. Redisの接続状態を確認

### 古いデータが返される場合
1. TTL設定を確認
2. 無効化ロジックを確認
3. 手動でキャッシュをクリア

### パフォーマンスが改善しない場合
1. キャッシュヒット率を確認
2. キャッシュキーの粒度を調整
3. キャッシュサイズを調整

## 環境変数

```bash
# Redis接続
REDIS_URL=redis://localhost:6379

# 既存のrate limit用Redisを流用する場合
# REDIS_URLが未設定の場合は自動的にこちらを使用
RATE_LIMIT_REDIS_URL=redis://localhost:6379
```

## 今後の改善案

1. **キャッシュヒット率の追跡**
   - Prometheusメトリクスの追加
   - Grafanaダッシュボードの作成

2. **スマートキャッシュ無効化**
   - 依存関係グラフベースの無効化
   - タグベースの無効化

3. **キャッシュの事前生成**
   - 人気コンテンツの自動検出
   - バックグラウンドでの更新

4. **エッジキャッシュ統合**
   - CloudflareやFastlyとの統合
   - 地理的に分散したキャッシュ
