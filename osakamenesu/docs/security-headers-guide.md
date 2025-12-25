# セキュリティヘッダー設定ガイド

## 概要

Osakamenesuプロジェクトで実装されているセキュリティヘッダーの詳細と設定方法です。

## 実装済みセキュリティヘッダー

### 1. X-Content-Type-Options: nosniff
- **目的**: MIMEタイプスニッフィングの防止
- **効果**: ブラウザがContent-Typeを推測することを防ぎ、XSS攻撃を軽減

### 2. X-Frame-Options: DENY
- **目的**: クリックジャッキング攻撃の防止
- **効果**: ページがiframeに埋め込まれることを完全に禁止

### 3. X-XSS-Protection: 1; mode=block
- **目的**: ブラウザのXSS保護機能を有効化（レガシー）
- **効果**: XSS攻撃を検出した場合、ページの読み込みをブロック

### 4. Referrer-Policy: strict-origin-when-cross-origin
- **目的**: リファラー情報の制御
- **効果**: 同一オリジンには完全なURL、クロスオリジンにはオリジンのみ送信

### 5. Permissions-Policy
- **目的**: ブラウザ機能の制限
- **無効化される機能**:
  - カメラ、マイク、位置情報
  - 加速度センサー、ジャイロスコープ
  - 支払いAPI、USB API
  - FLoC（プライバシー保護）

### 6. Strict-Transport-Security (HSTS)
- **設定**: max-age=31536000; includeSubDomains; preload
- **効果**: 1年間HTTPS接続を強制、サブドメインも対象

### 7. Content-Security-Policy (CSP)
- **目的**: XSSやインジェクション攻撃の防止
- **現在**: Report-Onlyモード（監視のみ）

## CSPディレクティブ詳細

```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net
style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net
img-src 'self' data: https: blob:
connect-src 'self' https://api.osakamenesu.com wss://api.osakamenesu.com
```

## 設定方法

### 1. ミドルウェアの有効化

```python
# main.py
from .middleware.security_headers import create_security_headers_middleware

app.add_middleware(
    create_security_headers_middleware(
        enable_hsts=True,
        enable_csp=True,
        report_uri="https://api.osakamenesu.com/api/csp-report"
    )
)
```

### 2. 環境別設定

開発環境:
```python
enable_hsts=False,  # HTTPでの開発を許可
enable_csp=False,   # CSPを無効化
```

本番環境:
```python
enable_hsts=True,
enable_csp=True,
report_uri=settings.csp_report_uri
```

## CSPの段階的導入

### Phase 1: Report-Only（現在）
- 違反を記録するが、ブロックしない
- ログを分析して設定を調整

### Phase 2: 部分的適用
- 重要なディレクティブのみ有効化
- `script-src`と`style-src`から開始

### Phase 3: 完全適用
- すべてのディレクティブを有効化
- `unsafe-inline`と`unsafe-eval`を削除

## CSP違反レポートの処理

```python
@router.post("/api/csp-report")
async def csp_report(request: Request):
    """CSP違反レポートを受信"""
    report = await request.json()
    logger.warning(f"CSP violation: {report}")
    # データベースに保存して分析
    return {"status": "ok"}
```

## トラブルシューティング

### インラインスクリプトがブロックされる

**解決策1**: nonceを使用
```html
<script nonce="{{csp_nonce}}">
  // インラインスクリプト
</script>
```

**解決策2**: 外部ファイルに移動
```html
<script src="/static/js/app.js"></script>
```

### 外部リソースがブロックされる

CSPディレクティブに追加:
```python
"script-src 'self' https://trusted-cdn.com",
"img-src 'self' https://images.example.com",
```

### HSTSでHTTP開発が困難

開発環境では無効化:
```python
enable_hsts=False if settings.debug else True
```

## セキュリティテスト

### 1. ヘッダーの確認

```bash
curl -I https://api.osakamenesu.com/api/v1/shops | grep -E "X-|Strict-|Content-Security"
```

### 2. セキュリティスコア確認

- [SecurityHeaders.com](https://securityheaders.com)
- [Mozilla Observatory](https://observatory.mozilla.org)

### 3. CSP評価ツール

```bash
# CSP Evaluator
npx csp-evaluator "your-csp-policy"
```

## パフォーマンスへの影響

- ヘッダー追加のオーバーヘッド: 最小限（< 1ms）
- CSPの評価: ブラウザ側で実行
- Report-Onlyモード: パフォーマンス影響なし

## ベストプラクティス

1. **段階的導入**
   - 開発環境でテスト
   - Report-Onlyで本番監視
   - 問題解決後に有効化

2. **定期的レビュー**
   - CSP違反レポートの分析
   - 新しい外部リソースの追加
   - セキュリティスコアの確認

3. **例外処理**
   - 管理画面は別ポリシー
   - APIエンドポイントは厳格に
   - 静的ファイルは緩和

## 今後の改善

1. **CSP nonce/hash**
   - インラインスクリプトの安全な許可
   - 動的nonce生成

2. **Subresource Integrity (SRI)**
   - CDNリソースの完全性検証
   - 改ざん防止

3. **セキュリティレポート統合**
   - CSP違反の自動分析
   - Sentryとの統合
   - アラート設定
