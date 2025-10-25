# Playwright E2E ガイド

管理画面の E2E テストは実 API を叩く構成のため、事前にダミーデータを投入しておかないと 4xx / 5xx や空データで失敗します。このフォルダではテストを安定させるための前提条件とコマンドをまとめています。

## 必要な環境変数

| 変数 | 説明 |
| --- | --- |
| `ADMIN_BASIC_USER`, `ADMIN_BASIC_PASS` | 管理画面の Basic 認証。Playwright が UI にアクセスする際に使用します。 |
| `ADMIN_API_KEY` | `/api/admin/*` 系エンドポイントへアクセスするためのキー。シードスクリプトもこのキーで認証します。 |
| `OSAKAMENESU_API_INTERNAL_BASE` (優先) / `NEXT_PUBLIC_OSAKAMENESU_API_BASE` | API のベース URL。Cloud Run / Docker Compose など実行環境に合わせて設定してください。 |
| `CLOUD_RUN_ID_TOKEN` など | IAM 認証が必要な場合に Bearer トークンを渡します（不要な環境では未設定で問題ありません）。 |

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


