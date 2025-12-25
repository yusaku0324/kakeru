# APIドキュメント自動生成ガイド

## 概要

Osakamenesu APIは、FastAPIのOpenAPI（Swagger）機能を使用して自動的にAPIドキュメントを生成します。

## アクセス方法

### 開発環境

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json

### 本番環境

- **Swagger UI**: https://osakamenesu-api.fly.dev/docs
- **ReDoc**: https://osakamenesu-api.fly.dev/redoc
- **OpenAPI Schema**: https://osakamenesu-api.fly.dev/openapi.json

### ステージング環境

- **Swagger UI**: https://osakamenesu-api-stg.fly.dev/docs
- **ReDoc**: https://osakamenesu-api-stg.fly.dev/redoc
- **OpenAPI Schema**: https://osakamenesu-api-stg.fly.dev/openapi.json

## 機能

### 1. インタラクティブドキュメント（Swagger UI）

- APIエンドポイントの一覧表示
- リクエスト/レスポンスの詳細仕様
- **Try it out** 機能でAPIを直接実行
- 認証トークンの保存機能

### 2. 読みやすいドキュメント（ReDoc）

- 見やすいレイアウトでの仕様表示
- サイドナビゲーション
- 検索機能
- 印刷やPDFエクスポートに最適

### 3. OpenAPIスキーマ

- JSON形式でのAPI仕様
- 他のツールとの連携に使用
- クライアントコード自動生成の基盤

## 静的ドキュメントの生成

### 生成方法

```bash
cd services/api
python scripts/generate-api-docs.py
```

### 生成されるファイル

```
api-docs/
├── index.html          # Swagger UI + ReDoc統合版
├── openapi.json        # OpenAPIスキーマ
├── redoc.html          # ReDoc単体版
└── api-reference.md    # Markdownドキュメント
```

### デプロイ

生成された`api-docs`ディレクトリを静的ホスティングサービスにデプロイできます。

```bash
# Netlifyの例
netlify deploy --dir=api-docs --prod

# GitHub Pagesの例
cp -r api-docs/* ../docs/api/
git add ../docs/api/
git commit -m "Update API documentation"
git push
```

## カスタマイズ

### 1. API情報の更新

`app/openapi_config.py`の`API_METADATA`を編集：

```python
API_METADATA = {
    "title": "Osakamenesu API",
    "version": "1.0.0",
    "description": "詳細な説明...",
}
```

### 2. タグの追加

エンドポイントをグループ化するタグを追加：

```python
OPENAPI_TAGS = [
    {
        "name": "new-feature",
        "description": "新機能の説明"
    }
]
```

### 3. エンドポイントのドキュメント強化

FastAPIのデコレータでドキュメントを追加：

```python
@router.get(
    "/shops/{shop_id}",
    summary="店舗詳細取得",
    description="指定された店舗の詳細情報を取得します",
    response_description="店舗詳細情報",
    responses={
        200: {
            "description": "成功",
            "content": {
                "application/json": {
                    "example": SHOP_EXAMPLE
                }
            }
        },
        404: {
            "description": "店舗が見つかりません",
            "content": {
                "application/json": {
                    "example": ERROR_EXAMPLES["404"]
                }
            }
        }
    }
)
async def get_shop(shop_id: str):
    """店舗詳細を取得"""
    pass
```

### 4. リクエスト/レスポンスの例

Pydanticモデルに例を追加：

```python
class ShopSearchRequest(BaseModel):
    area: Optional[str] = Field(None, description="エリア名", example="梅田")
    price_min: Optional[int] = Field(None, description="最低価格", example=10000)

    class Config:
        json_schema_extra = {
            "example": SHOP_SEARCH_REQUEST_EXAMPLE
        }
```

## クライアントコード生成

OpenAPIスキーマからクライアントコードを自動生成できます。

### TypeScript/JavaScript

```bash
npx @openapitools/openapi-generator-cli generate \
  -i https://osakamenesu-api.fly.dev/openapi.json \
  -g typescript-fetch \
  -o ./generated/api-client
```

### Python

```bash
pip install openapi-python-client
openapi-python-client generate \
  --url https://osakamenesu-api.fly.dev/openapi.json
```

### Go

```bash
go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest
oapi-codegen -package api \
  https://osakamenesu-api.fly.dev/openapi.json > api_client.go
```

## ベストプラクティス

### 1. 詳細な説明を書く

- エンドポイントの目的を明確に
- パラメータの制約や形式を説明
- エラーケースを網羅的に記載

### 2. 実例を提供

- リクエスト/レスポンスの実例を追加
- 一般的な使用例を示す
- エラーレスポンスの例も含める

### 3. バージョニング

- APIバージョンを明確に管理
- 破壊的変更は新バージョンで
- 廃止予定の機能は明示

### 4. セキュリティ情報

- 認証方法を明確に説明
- 必要な権限を記載
- レート制限を明示

## CI/CD統合

### GitHub Actionsでの自動生成

`.github/workflows/generate-api-docs.yml`:

```yaml
name: Generate API Documentation

on:
  push:
    branches: [main]
    paths:
      - 'services/api/**'

jobs:
  generate-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd services/api
          pip install -r requirements.txt

      - name: Generate documentation
        run: |
          cd services/api
          python scripts/generate-api-docs.py

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./services/api/api-docs
```

## トラブルシューティング

### スキーマが更新されない

- サーバーを再起動
- ブラウザのキャッシュをクリア
- `app.openapi_schema = None`でキャッシュクリア

### カスタム設定が反映されない

- `openapi_config.py`の変更を確認
- インポート順序を確認
- FastAPIアプリの初期化順序を確認

### 認証が機能しない

- セキュリティスキームの設定を確認
- CORS設定を確認
- トークン形式を確認
