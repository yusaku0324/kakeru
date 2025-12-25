# API セキュリティ強化ガイド

## 🔒 セキュリティ概要

本ドキュメントでは、Osakamenesu API のセキュリティ強化に関する実装とベストプラクティスについて説明します。

## 📊 レート制限の実装

### 現在の設定

| エンドポイント | 制限 | ウィンドウ | 用途 |
|------------|------|----------|------|
| `/api/auth/*` | 5回 | 10分 | 認証・ログイン |
| `/api/v1/shops/*` | 60回 | 1分 | 検索・閲覧 |
| `/api/v1/reservations/*` | 10回 | 1時間 | 予約作成 |
| `/api/out/{token}` | 5回 | 10秒 | アウトリンク |

### レート制限の仕組み

1. **IPベース制限**
   - X-Forwarded-For ヘッダーから実IPを取得
   - プロキシ経由でも正確なIP追跡

2. **Redis バックエンド**
   - 分散環境でも一貫したレート制限
   - 高速な応答時間

3. **グレースフルデグレード**
   - Redis障害時は制限を無効化（サービス継続優先）

### レスポンスヘッダー

```http
X-RateLimit-Limit: 60
X-RateLimit-Window: 60
Retry-After: 45
```

## 🛡️ セキュリティヘッダー

### 推奨設定

```python
# security_headers.py
from fastapi import Request
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # セキュリティヘッダーを追加
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        return response
```

### 実装方法

```python
# main.py に追加
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["osakamenesu-api.fly.dev", "*.osakamenesu.com"]
)
```

## 🔐 認証・認可の強化

### JWT トークン設定

```python
# 環境変数で設定
JWT_SECRET_KEY=<強力なランダム文字列>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440  # 24時間
```

### セッション管理

- HTTPOnly Cookie による保護
- Secure フラグ（HTTPS必須）
- SameSite=Lax でCSRF防御

## 🚨 入力検証

### Pydantic モデルによる検証

```python
from pydantic import BaseModel, EmailStr, validator
from typing import Optional

class AuthRequestLink(BaseModel):
    email: EmailStr

    @validator('email')
    def validate_email(cls, v):
        # 追加のメールアドレス検証
        if len(v) > 255:
            raise ValueError('Email too long')
        return v.lower()
```

### SQLインジェクション対策

- SQLAlchemy ORM の使用
- パラメータ化クエリ
- 生SQLの禁止

## 🔍 ログとモニタリング

### セキュリティイベントのログ

```python
import logging

security_logger = logging.getLogger("security")

# 認証失敗
security_logger.warning(
    "Auth failed",
    extra={
        "ip": client_ip,
        "email": email,
        "reason": "invalid_token"
    }
)

# レート制限違反
security_logger.warning(
    "Rate limit exceeded",
    extra={
        "ip": client_ip,
        "endpoint": request.url.path,
        "limit": rate_limiter.max_events
    }
)
```

### Sentry 統合

```python
import sentry_sdk

# タグ付けでセキュリティイベントを追跡
sentry_sdk.set_tag("security.event", "rate_limit")
sentry_sdk.set_context("security", {
    "ip": client_ip,
    "user_agent": request.headers.get("user-agent")
})
```

## 🌐 CORS 設定

### 現在の設定

```python
_cors_origins = {
    settings.api_origin,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
    ],
)
```

## 🔧 環境変数によるセキュリティ設定

### 必須環境変数

```bash
# Rate Limiting
RATE_LIMIT_REDIS_URL=redis://localhost:6379
RATE_LIMIT_NAMESPACE=osakamenesu:prod
RATE_LIMIT_REDIS_ERROR_COOLDOWN=60

# Security
JWT_SECRET_KEY=<32文字以上のランダム文字列>
AUTH_SESSION_TTL_DAYS=7
AUTH_MAGIC_LINK_EXPIRE_MINUTES=30

# HTTPS
FORCE_HTTPS=true
SECURE_COOKIES=true
```

## 📋 セキュリティチェックリスト

### デプロイ前

- [ ] すべての環境変数が本番用に設定されている
- [ ] デバッグモードが無効
- [ ] レート制限が有効
- [ ] HTTPSが強制されている

### 定期チェック

- [ ] 依存関係の脆弱性スキャン（月次）
- [ ] ログの異常パターン確認（週次）
- [ ] レート制限の効果測定（月次）
- [ ] セキュリティヘッダーの確認（四半期）

## 🚀 パフォーマンスとセキュリティのバランス

### キャッシュ戦略

```python
from fastapi_cache import FastAPICache
from fastapi_cache.decorator import cache

@router.get("/api/v1/shops")
@cache(expire=60)  # 1分間キャッシュ
async def list_shops():
    # レート制限の負荷を軽減
    pass
```

### 非同期処理

- 重い処理はバックグラウンドタスクへ
- Celery/Redis Queue の活用
- タイムアウト設定（30秒）

## 🔍 ペネトレーションテスト

### 推奨ツール

1. **OWASP ZAP**
   ```bash
   docker run -t owasp/zap2docker-stable zap-baseline.py \
     -t https://osakamenesu-api-stg.fly.dev
   ```

2. **Nikto**
   ```bash
   nikto -h https://osakamenesu-api-stg.fly.dev
   ```

3. **SQLMap**（SQLインジェクションテスト）
   ```bash
   sqlmap -u "https://osakamenesu-api-stg.fly.dev/api/v1/shops?id=1" \
     --batch --random-agent
   ```

### 手動テスト項目

- [ ] 認証バイパス試行
- [ ] レート制限回避試行
- [ ] XSS ペイロード注入
- [ ] SQLインジェクション
- [ ] パストラバーサル攻撃

## 📚 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security Best Practices](https://fastapi.tiangolo.com/tutorial/security/)
- [Redis Security](https://redis.io/topics/security)
