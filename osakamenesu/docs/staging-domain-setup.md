# ステージングドメイン設定ガイド

## 概要

ステージング環境用のカスタムドメイン設定手順です。以下のドメイン構成を推奨します：

- **Web App**: `stg.osakamenesu.com` または `staging.osakamenesu.com`
- **API**: `api-stg.osakamenesu.com` または `api.stg.osakamenesu.com`

## 前提条件

- ドメイン管理者権限（DNS設定変更権限）
- Vercelアカウント（Web App用）
- Fly.ioアカウント（API用）
- SSL証明書（自動発行される）

## 1. Vercel（Web App）のドメイン設定

### A. Vercelダッシュボードでの設定

1. [Vercel Dashboard](https://vercel.com/dashboard)にログイン
2. Osakamenesuプロジェクトを選択
3. **Settings** → **Domains**に移動
4. **Add Domain**をクリック
5. `stg.osakamenesu.com`を入力

### B. DNS設定（Cloudflareの例）

```
# CNAMEレコード
stg.osakamenesu.com    CNAME    cname.vercel-dns.com
```

### C. Vercel CLIでの設定

```bash
# プロジェクトディレクトリで実行
cd services/web

# ドメイン追加
vercel domains add stg.osakamenesu.com

# 環境別設定
vercel alias set staging-osakamenesu.vercel.app stg.osakamenesu.com
```

### D. 環境変数の更新

```bash
# Vercel環境変数にステージング用の値を設定
vercel env add NEXT_PUBLIC_SITE_URL stg.osakamenesu.com --environment preview
```

## 2. Fly.io（API）のドメイン設定

### A. カスタムドメインの追加

```bash
# ステージングAPIアプリにドメインを追加
flyctl certs add api-stg.osakamenesu.com --app osakamenesu-api-stg
```

### B. DNS設定

Fly.ioがCNAMEターゲットを提供：

```
# CNAMEレコード
api-stg.osakamenesu.com    CNAME    osakamenesu-api-stg.fly.dev
```

または、IPアドレスを使用：

```bash
# IPアドレスを取得
flyctl ips list --app osakamenesu-api-stg

# Aレコード
api-stg.osakamenesu.com    A    <IPv4アドレス>
api-stg.osakamenesu.com    AAAA <IPv6アドレス>
```

### C. SSL証明書の確認

```bash
# 証明書のステータス確認
flyctl certs show api-stg.osakamenesu.com --app osakamenesu-api-stg

# 証明書の詳細
flyctl certs check api-stg.osakamenesu.com --app osakamenesu-api-stg
```

## 3. DNS設定のまとめ（Cloudflare例）

### 推奨DNS設定

```dns
# ステージングWeb App
stg.osakamenesu.com         CNAME    cname.vercel-dns.com    (Proxy: ON)

# ステージングAPI
api-stg.osakamenesu.com     CNAME    osakamenesu-api-stg.fly.dev    (Proxy: OFF)

# または subdomain構成
staging.osakamenesu.com      CNAME    cname.vercel-dns.com    (Proxy: ON)
api.staging.osakamenesu.com  CNAME    osakamenesu-api-stg.fly.dev    (Proxy: OFF)
```

### CloudflareのSSL/TLS設定

1. **SSL/TLS** → **Overview**
2. **Full (strict)**を選択
3. **Edge Certificates** → **Always Use HTTPS**を有効化

## 4. 環境変数の更新

### Web App (Vercel)

```env
# .env.staging
NEXT_PUBLIC_API_URL=https://api-stg.osakamenesu.com
NEXT_PUBLIC_SITE_URL=https://stg.osakamenesu.com
```

### API (Fly.io)

```bash
# CORS設定を更新
flyctl secrets set \
  CORS_ORIGINS="https://stg.osakamenesu.com,https://staging-osakamenesu.vercel.app" \
  --app osakamenesu-api-stg
```

## 5. リダイレクト設定

### Vercelでのリダイレクト

`vercel.json`に追加：

```json
{
  "redirects": [
    {
      "source": "/api/:path*",
      "destination": "https://api-stg.osakamenesu.com/:path*"
    }
  ]
}
```

### Fly.ioでのCORS設定

```python
# services/api/app/main.py
from app.settings import settings

CORS_ORIGINS = {
    "production": ["https://osakamenesu.com"],
    "staging": ["https://stg.osakamenesu.com", "https://staging-osakamenesu.vercel.app"],
    "development": ["http://localhost:3000"]
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS.get(settings.environment, ["*"]),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 6. 動作確認

### A. DNS伝播の確認

```bash
# DNSレコードの確認
dig stg.osakamenesu.com
dig api-stg.osakamenesu.com

# または
nslookup stg.osakamenesu.com
nslookup api-stg.osakamenesu.com
```

### B. HTTPS証明書の確認

```bash
# SSL証明書の確認
openssl s_client -connect stg.osakamenesu.com:443 -servername stg.osakamenesu.com
openssl s_client -connect api-stg.osakamenesu.com:443 -servername api-stg.osakamenesu.com
```

### C. エンドポイントテスト

```bash
# Web App
curl -I https://stg.osakamenesu.com

# API Health Check
curl https://api-stg.osakamenesu.com/health

# API Docs
curl https://api-stg.osakamenesu.com/docs
```

## 7. トラブルシューティング

### DNS伝播が遅い

- 最大48時間かかることがある
- CloudflareのDNSキャッシュをパージ
- ローカルDNSキャッシュをクリア：
  ```bash
  # macOS
  sudo dscacheutil -flushcache

  # Linux
  sudo systemctl restart systemd-resolved

  # Windows
  ipconfig /flushdns
  ```

### SSL証明書エラー

**Vercel:**
- 自動的に証明書が発行される
- **Settings** → **Domains**で確認

**Fly.io:**
```bash
# 証明書の再発行
flyctl certs remove api-stg.osakamenesu.com --app osakamenesu-api-stg
flyctl certs add api-stg.osakamenesu.com --app osakamenesu-api-stg
```

### CORS エラー

```bash
# API側のCORS設定を確認
flyctl ssh console --app osakamenesu-api-stg
> echo $CORS_ORIGINS
```

## 8. セキュリティ設定

### Basic認証の追加（オプション）

**Vercel Edge Middleware:**

```typescript
// services/web/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // ステージング環境でのみBasic認証
  if (process.env.VERCEL_ENV === 'preview') {
    const basicAuth = request.headers.get('authorization')

    if (!basicAuth) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Secure Area"',
        },
      })
    }

    const authValue = basicAuth.split(' ')[1]
    const [user, pwd] = atob(authValue).split(':')

    if (user !== process.env.BASIC_AUTH_USER || pwd !== process.env.BASIC_AUTH_PASSWORD) {
      return new NextResponse('Authentication failed', { status: 401 })
    }
  }

  return NextResponse.next()
}
```

### IPアドレス制限

Cloudflare WAFルールを使用して特定のIPのみアクセスを許可。

## 9. 監視設定

### Uptimeチェック

```yaml
# .github/workflows/uptime-check.yml
- name: Check Staging Domains
  run: |
    curl -f https://stg.osakamenesu.com || exit 1
    curl -f https://api-stg.osakamenesu.com/health || exit 1
```

### SSL証明書の有効期限監視

Let's Encryptの証明書は90日で期限切れ。自動更新されるが、監視を推奨。

## まとめ

ステージングドメインの設定により：

1. ✅ 本番環境に近い環境でのテスト
2. ✅ カスタムドメインでのブランディング
3. ✅ SSL/HTTPS通信の確保
4. ✅ 環境の明確な分離

設定完了後は、CI/CDパイプラインでの自動デプロイが可能になります。