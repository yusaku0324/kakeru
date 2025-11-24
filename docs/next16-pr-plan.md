# Next.js 16 対応のPR分割案

## 1. ツール/環境アップデート
- `package.json`, `pnpm-lock.yaml`, `.github/workflows/*.yml`, `README.md`, `AGENTS.md`
- 目的: pnpm への移行、Next.js 16 / React 19 のビルド設定、CI コマンドの差し替え。
- 動作確認: `doppler run --project osakamenesu --config dev_web -- pnpm lint`, `pnpm test:unit`。

## 2. Web アプリ (Next.js)
- `apps/web/src/app/**`, `src/components/**`, `src/lib/**`, `src/proxy.ts`, `playwright.config.ts`, `apps/web/e2e/**/*.spec.ts`
- 目的: ダッシュボード予約・通知 UI、検索ページ、予約フォームなどの本体改修と Playwright のシナリオ調整。
- 動作確認: `doppler run --project osakamenesu --config dev_web -- pnpm dev --turbo` で UI を確認し、`pnpm test:e2e -- <spec>` を個別に実施。
- メモ: Playwright 実行前は `lsof -ti :3000 | xargs kill` で手動の dev server を停止し、テストが独自に立ち上げる Next.js に `NEXT_PUBLIC_FAVORITES_API_MODE=mock` が渡るようにする。

## 3. API / バックエンド / ドキュメント
- `services/api/**`, `services/api/app/tests/**`, `services/api/alembic/**`, `docs/*.md`, `scripts/*.sh`
- 目的: 管理予約 API・通知ワーカー・LINE 連携などの FastAPI 側強化と手順書の更新。
- 動作確認: `doppler run --project osakamenesu --config dev_docker -- pytest`, `doppler run --project osakamenesu --config dev_docker -- python services/api/scripts/seed_admin_test_data.py`。

各グループごとに Conventional Commit（例: `chore(web): migrate to pnpm`）を作り、PR 説明には dry-run / テストコマンドと手元ログを添付する。
