# モニタリングとアラート設定ガイド

## 概要

Osakamenesuプロジェクトの包括的なモニタリング、エラートラッキング、パフォーマンス監視の設定ガイドです。

## 実装済みコンポーネント

### 1. Sentry統合
- **エラートラッキング**: 自動的な例外キャプチャ
- **パフォーマンスモニタリング**: トランザクションとスパン
- **リリーストラッキング**: バージョン管理
- **ユーザーコンテキスト**: エラーとユーザーの関連付け

### 2. カスタムメトリクス
- **Prometheus形式**: 標準的なメトリクスエクスポート
- **Redis backend**: リアルタイムメトリクス保存
- **自動収集**: デコレーターベースの計測

### 3. ヘルスチェック
- **依存関係の監視**: Database、Redis、Meilisearch
- **システムヘルス**: 統合ステータス
- **レスポンスタイム**: パフォーマンス測定

## セットアップ

### 1. Sentry設定

#### APIサーバー

```python
# services/api/app/main.py
from app.monitoring import init_sentry

# Sentry初期化（既存のコードを拡張）
init_sentry(
    dsn=settings.sentry_dsn,
    environment=settings.sentry_environment,
    traces_sample_rate=0.1,  # 10%のトランザクションをサンプリング
    profiles_sample_rate=0.1,  # 10%のプロファイリング
)
```

#### Webアプリケーション

```typescript
// apps/web/sentry.client.config.ts（既存）
// 追加の設定
Sentry.init({
  // ... 既存の設定
  beforeSend(event, hint) {
    // カスタムフィルタリング
    if (event.exception) {
      const error = hint.originalException;
      // 無視するエラーのフィルタリング
      if (error?.message?.includes('ResizeObserver')) {
        return null;
      }
    }
    return event;
  },
  integrations: [
    // セッションリプレイの追加
    new Sentry.Replay({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
});
```

### 2. ミドルウェアの適用

```python
# services/api/app/main.py
from app.middleware.error_tracking import create_error_tracking_middleware
from app.middleware.performance import create_performance_monitoring_middleware
from app.monitoring.metrics import MetricsCollector

# メトリクスコレクターの初期化
metrics_collector = MetricsCollector()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 起動時
    await metrics_collector.initialize()
    yield
    # シャットダウン時
    await metrics_collector.close()

app = FastAPI(lifespan=lifespan)

# ミドルウェアの追加（順序重要）
app.add_middleware(
    create_performance_monitoring_middleware(
        metrics_collector=metrics_collector,
        slow_request_threshold=3.0,
    )
)

app.add_middleware(
    create_error_tracking_middleware(
        capture_request_body=True,
        capture_response_body=False,
    )
)
```

### 3. エンドポイントでの使用

```python
# services/api/app/domains/site/shops_router.py
from app.monitoring import monitor_api_endpoint, track_database_query
from app.monitoring.metrics import track_api_request

@router.get("/shops")
@monitor_api_endpoint()  # 自動的にエラーとパフォーマンスを追跡
@track_api_request()     # APIメトリクスを記録
async def get_shops(
    db: AsyncSession = Depends(get_db),
    request: Request,
):
    # 手動でのコンテキスト設定
    set_tag("shop.filter", "active")
    set_context("search", {"type": "shop_list"})

    # データベースクエリの追跡
    @track_database_query("select", "shops")
    async def fetch_shops():
        return await db.execute(...)

    shops = await fetch_shops()
    return shops
```

## メトリクスエンドポイント

### 1. Prometheusメトリクス

```python
# services/api/app/domains/ops/router.py
from app.monitoring.metrics import MetricsCollector
from prometheus_client import generate_latest

@router.get("/metrics")
async def get_metrics(
    _: str = Depends(verify_ops_token),
):
    """Prometheus形式でメトリクスをエクスポート"""
    return Response(
        content=generate_latest(),
        media_type="text/plain",
    )
```

### 2. ヘルスチェックエンドポイント

```python
# services/api/app/domains/ops/router.py
from app.monitoring.health import get_system_health

@router.get("/health/detailed")
async def health_check_detailed(
    db: AsyncSession = Depends(get_db),
):
    """詳細なヘルスチェック"""
    health = await get_system_health(db)

    return {
        "status": health.status,
        "version": health.version,
        "environment": health.environment,
        "checks": [check.to_dict() for check in health.checks],
        "timestamp": health.timestamp.isoformat(),
    }
```

## アラート設定

### 1. Sentry アラート

Sentryダッシュボードで以下のアラートルールを設定：

#### エラー率アラート
```
条件: エラー率が5%を超える
期間: 5分間
アクション: Slack通知 + Email
```

#### パフォーマンスアラート
```
条件: p95レスポンスタイムが3秒を超える
期間: 10分間
アクション: Slack通知
```

#### クラッシュアラート
```
条件: 新しいクラッシュが発生
アクション: 即座にSlack通知 + Email
```

### 2. カスタムアラート

```python
# services/api/app/monitoring/alerts.py
from app.monitoring import capture_message

async def check_reservation_queue_health():
    """予約キューの健全性チェック"""
    pending_count = await get_pending_reservations_count()

    if pending_count > 100:
        capture_message(
            "Reservation queue is backing up",
            level="warning",
            queue_size=pending_count,
        )

        # Slack通知
        await send_slack_alert(
            f"⚠️ 予約キューが混雑しています: {pending_count}件待機中"
        )
```

### 3. Prometheusアラートルール

```yaml
# prometheus/alerts.yml
groups:
  - name: osakamenesu
    rules:
      - alert: HighErrorRate
        expr: rate(osakamenesu_errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/sec"

      - alert: SlowAPIResponse
        expr: histogram_quantile(0.95, osakamenesu_api_request_duration_seconds) > 3
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "API response time is slow"
          description: "95th percentile response time is {{ $value }}s"

      - alert: DatabaseConnectionPoolExhausted
        expr: osakamenesu_database_connections_used / osakamenesu_database_connections_max > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "{{ $value }}% of connections are in use"
```

## ダッシュボード設定

### 1. Grafana ダッシュボード

```json
{
  "dashboard": {
    "title": "Osakamenesu Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{
          "expr": "rate(osakamenesu_api_requests_total[5m])"
        }]
      },
      {
        "title": "Error Rate",
        "targets": [{
          "expr": "rate(osakamenesu_errors_total[5m])"
        }]
      },
      {
        "title": "Response Time (p50, p95, p99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.5, osakamenesu_api_request_duration_seconds)",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, osakamenesu_api_request_duration_seconds)",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, osakamenesu_api_request_duration_seconds)",
            "legendFormat": "p99"
          }
        ]
      }
    ]
  }
}
```

### 2. Sentryダッシュボード

カスタムダッシュボードウィジェット：
- エラー頻度グラフ
- ユーザー影響度
- リリース別エラー率
- パフォーマンストレンド
- 最も遅いトランザクション

## ベストプラクティス

### 1. エラーコンテキスト

```python
try:
    result = await process_reservation(data)
except Exception as e:
    # 詳細なコンテキストを追加
    capture_exception(
        e,
        reservation_id=data.id,
        user_id=data.user_id,
        shop_id=data.shop_id,
        error_stage="processing",
    )
    raise
```

### 2. パフォーマンス計測

```python
from app.monitoring import start_transaction

async def complex_operation():
    with start_transaction(op="task", name="complex_operation") as transaction:
        # ステップ1
        with transaction.start_child(op="db", description="fetch_data"):
            data = await fetch_data()

        # ステップ2
        with transaction.start_child(op="compute", description="process_data"):
            result = process_data(data)

        # ステップ3
        with transaction.start_child(op="cache", description="store_result"):
            await store_result(result)

        return result
```

### 3. カスタムメトリクス

```python
from app.monitoring.metrics import MetricsCollector

async def track_business_metrics(collector: MetricsCollector):
    # 予約数の記録
    await collector.record_reservation(
        status="confirmed",
        source="web",
    )

    # アクティブユーザー数
    active_count = await get_active_users_count()
    await collector.record_active_users(
        user_type="customer",
        count=active_count,
    )
```

## トラブルシューティング

### Sentryにエラーが送信されない

1. 環境変数の確認
   ```bash
   echo $SENTRY_DSN
   echo $SENTRY_ENVIRONMENT
   ```

2. 初期化の確認
   ```python
   import sentry_sdk
   print(sentry_sdk.Hub.current.client.dsn)
   ```

3. ネットワーク接続の確認
   ```bash
   curl https://sentry.io/api/0/projects/
   ```

### メトリクスが収集されない

1. Redisの接続確認
   ```bash
   redis-cli ping
   ```

2. Prometheusエンドポイントの確認
   ```bash
   curl http://localhost:8000/metrics
   ```

### パフォーマンスデータが不正確

1. タイムゾーンの確認
2. サンプリングレートの調整
3. トランザクション名の正規化

## まとめ

このモニタリングシステムにより：

1. ✅ リアルタイムエラー検知と通知
2. ✅ パフォーマンスボトルネックの特定
3. ✅ ビジネスメトリクスの可視化
4. ✅ 予防的な問題検出
5. ✅ 詳細なデバッグ情報の収集

継続的な改善のため、定期的にメトリクスをレビューし、アラート閾値を調整してください。