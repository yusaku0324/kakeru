"""OpenAPI configuration and customization for the API documentation."""

from typing import Dict, Any

# API metadata
API_METADATA = {
    "title": "Osakamenesu API",
    "description": """
# Osakamenesu API Documentation

大阪メンズエステ検索・予約プラットフォームのAPIドキュメントです。

## 概要

Osakamenesu APIは、メンズエステ店舗の検索、セラピスト情報の取得、予約管理などの機能を提供するRESTful APIです。

## 主な機能

### 🏪 店舗管理
- 店舗検索（エリア、駅、カテゴリー、料金帯）
- 店舗詳細情報の取得
- セラピスト一覧の取得

### 👩‍💼 セラピスト管理
- セラピスト詳細情報
- 空き状況確認
- 類似セラピスト検索

### 📅 予約管理
- 予約作成・確認・キャンセル
- 予約可能時間の確認
- 予約履歴の取得

### 🔐 認証・認可
- マジックリンク認証
- JWT トークンベース認証
- 管理者API認証

## 認証方法

### 1. ゲストユーザー（認証不要）
- 店舗検索
- セラピスト情報閲覧
- 空き状況確認

### 2. 認証済みユーザー
- Authorization: Bearer {token}
- 予約作成・管理
- お気に入り管理

### 3. 管理者API
- X-Admin-Key: {admin_key}
- 店舗・セラピスト管理
- システム管理

## レート制限

- ゲスト: 60リクエスト/分
- 認証済み: 300リクエスト/分
- 管理者: 無制限

## エラーレスポンス

すべてのエラーレスポンスは以下の形式で返されます：

```json
{
  "detail": "エラーメッセージ",
  "code": "ERROR_CODE"
}
```

## 環境

- Production: https://osakamenesu-api.fly.dev
- Staging: https://osakamenesu-api-stg.fly.dev
""",
    "version": "1.0.0",
    "contact": {"name": "Osakamenesu Support", "email": "support@osakamenesu.com"},
    "license": {"name": "Proprietary", "url": "https://osakamenesu.com/terms"},
}

# OpenAPI tags for grouping endpoints
OPENAPI_TAGS = [
    {
        "name": "shops",
        "description": "店舗関連のエンドポイント",
        "externalDocs": {
            "description": "店舗検索の詳細仕様",
            "url": "https://docs.osakamenesu.com/api/shops",
        },
    },
    {"name": "therapists", "description": "セラピスト関連のエンドポイント"},
    {"name": "reservations", "description": "予約管理のエンドポイント"},
    {"name": "auth", "description": "認証関連のエンドポイント"},
    {"name": "dashboard", "description": "ダッシュボード（管理画面）のエンドポイント"},
    {"name": "admin", "description": "システム管理者向けエンドポイント"},
    {"name": "ops", "description": "運用・監視のエンドポイント"},
]


# Custom OpenAPI schema
def custom_openapi(app) -> Dict[str, Any]:
    """Generate custom OpenAPI schema with enhanced documentation."""
    if app.openapi_schema:
        return app.openapi_schema

    from fastapi.openapi.utils import get_openapi

    openapi_schema = get_openapi(
        title=API_METADATA["title"],
        version=API_METADATA["version"],
        description=API_METADATA["description"],
        routes=app.routes,
        tags=OPENAPI_TAGS,
        contact=API_METADATA.get("contact"),
        license_info=API_METADATA.get("license"),
    )

    # Add server information
    openapi_schema["servers"] = [
        {"url": "https://osakamenesu-api.fly.dev", "description": "Production server"},
        {"url": "https://osakamenesu-api-stg.fly.dev", "description": "Staging server"},
        {"url": "http://localhost:8000", "description": "Local development server"},
    ]

    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT認証トークン",
        },
        "adminApiKey": {
            "type": "apiKey",
            "in": "header",
            "name": "X-Admin-Key",
            "description": "管理者APIキー",
        },
    }

    # Add example responses
    openapi_schema["components"]["responses"] = {
        "UnauthorizedError": {
            "description": "認証エラー",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "detail": {"type": "string", "example": "Not authenticated"}
                        },
                    }
                }
            },
        },
        "NotFoundError": {
            "description": "リソースが見つかりません",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "detail": {
                                "type": "string",
                                "example": "Resource not found",
                            }
                        },
                    }
                }
            },
        },
        "ValidationError": {
            "description": "バリデーションエラー",
            "content": {
                "application/json": {
                    "schema": {"$ref": "#/components/schemas/HTTPValidationError"}
                }
            },
        },
    }

    # Cache the schema
    app.openapi_schema = openapi_schema
    return app.openapi_schema
