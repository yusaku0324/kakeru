# Playwright E2E ガイド

管理画面の E2E テストは実 API を叩く構成のため、事前にダミーデータを投入しておかないと 4xx / 5xx や空データで失敗します。このフォルダではテストを安定させるための前提条件とコマンドをまとめています。

## 必要な環境変数

| 変数 | 説明 |
| --- | --- |
| `ADMIN_BASIC_USER`, `ADMIN_BASIC_PASS` | 管理画面の Basic 認証。Playwright が UI にアクセスする際に使用します。 |
| `ADMIN_API_KEY` | `/api/admin/*` 系エンドポイントへアクセスするためのキー。シードスクリプトもこのキーで認証します。 |
| `OSAKAMENESU_API_INTERNAL_BASE` (優先) / `NEXT_PUBLIC_OSAKAMENESU_API_BASE` | API のベース URL。Cloud Run / Docker Compose など実行環境に合わせて設定してください。 |
| `CLOUD_RUN_ID_TOKEN` など | IAM 認証が必要な場合に Bearer トークンを渡します（不要な環境では未設定で問題ありません）。 |
| `E2E_SITE_COOKIE` | サイト利用者としてログイン済みのセッション Cookie。お気に入り実 API テストで使用します。|
| `E2E_TEST_AUTH_SECRET` | (`services/api`) の `/api/auth/test-login` を利用して Cookie を生成する際の共有シークレット。 |

※ 上記のいずれも設定されていない場合、シードスクリプトは何も行わず終了します。

## シードスクリプト

`services/api/scripts/seed_admin_test_data.py` が Playwright 用の固定データを投入します。実行すると以下を保証します。

- スラッグ `playwright-seed-shop` の店舗が作成され、住所 / 連絡先 / メニュー / スタッフ情報を保持する
- 予約一覧に 1 件以上のダミー予約が存在する

手動で実行する場合は `apps/web` ディレクトリで次のコマンドを使用してください:

```bash
npm run e2e:setup
```

Python 実行環境が `python3` でない場合は `E2E_PYTHON` にパスを指定できます。

## Playwright の実行

`npm run test:e2e` は Playwright を起動する前にシードスクリプトを自動で実行します（グローバルセットアップで呼び出しています）。事前条件さえ揃っていれば CI / ローカルどちらでも安定して緑になる想定です。

```bash
# 管理画面以外のテスト
npm run test:e2e -- --grep-invert "Admin"

# 管理画面テストのみ
npm run test:e2e -- --grep "Admin"
```

シードをスキップしたい場合は `SKIP_E2E_SETUP=1` を指定して実行してください。

### お気に入り E2E テストについて

`favorites.spec.ts` では実際の API を叩いて「お気に入り」操作を確認します。ログイン済みセッションが必要なため、ブラウザの開発者ツールなどで `Cookie` ヘッダーを取得し `E2E_SITE_COOKIE` に設定してください。

```bash
E2E_SITE_COOKIE='session_token=...; another_cookie=...' npm run test:e2e -- favorites.spec.ts
```

Cookie が指定されていない場合、このテストは自動的に `skip` されます。

開発・CI 環境では、API サーバー側で `TEST_AUTH_ENABLED=1` と `TEST_AUTH_SECRET=ランダム文字列` を設定すると `/api/auth/test-login` エンドポイントが有効になります。次のように呼び出すと JSON レスポンスと共にセッション Cookie が返ってくるため、その値を `E2E_SITE_COOKIE` として利用できます。

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Test-Auth-Secret: $TEST_AUTH_SECRET" \
  -d '{"email": "tester@example.com", "scope": "site"}' \
  -i https://your-api-host/api/auth/test-login
```

レスポンスヘッダーの `set-cookie` をコピーし、Playwright 実行前に `E2E_SITE_COOKIE` としてエクスポートしてください。
