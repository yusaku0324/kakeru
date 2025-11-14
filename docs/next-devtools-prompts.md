# Next.js DevTools MCP プロンプト集

Next.js DevTools MCP（`next-devtools-mcp`）を使う際の代表的な呼びかけ例をまとめました。開発セッションを始める際は、最初に `init` ツールを呼び出してコンテキストを初期化してください。

```text
Use the init tool to set up Next.js DevTools context
```

## ランタイム診断

- **遅い Route の診断**
  ```text
  Next Devtools, diagnose slow routes in the application.
  ```
  → 直近のリクエストや build output からレスポンスが遅いページ／API を特定。

- **型エラーの一覧**
  ```text
  Next Devtools, list all TypeScript errors from the latest build.
  ```
  → Turbopack/TypeScript のエラーログをまとめて取得。

- **ランタイムエラーの確認**
  ```text
  Next Devtools, show me the current runtime errors and stack traces.
  ```
  → dev サーバーの `_next/mcp` から最新の例外情報を取得。

## キャッシュ / データ更新

- **Cache タグ漏れのチェック**
  ```text
  Next Devtools, check for missing cache tags or invalidation warnings.
  ```
  → `cacheTag` や `revalidateTag` の使い忘れを検出。

- **キャッシュコンポーネントの状況確認**
  ```text
  Next Devtools, inspect cache components usage in the app.
  ```
  → Cache Components のオン/オフや設定ミスを確認。

## ビルド・構成情報

- **ルート構成の出力**
  ```text
  Next Devtools, show me the structure of my routes.
  ```

- **Server Actions の調査**
  ```text
  Next Devtools, list server actions and their usage.
  ```

## Playwright MCP と併用する場合

主要フローの自動テストに Playwright MCP を利用する際は、以下のような呼びかけで各シナリオを実行します。

- **新規予約フローの確認**
  ```text
  Playwright, run the e2e test to create a new reservation.
  ```
- **予約日の変更**
  ```text
  Playwright, execute the e2e flow that reschedules an existing reservation.
  ```
- **予約キャンセル**
  ```text
  Playwright, run the cancellation flow and report any failures.
  ```

## 参考

- `nextjs_docs` ツールで公式ドキュメントを検索する場合:
  ```text
  Next Devtools, search nextjs_docs for generateMetadata.
  ```
- `browser_eval` ツール（Playwright MCP）で画面操作を行う場合:
  ```text
  Playwright, navigate to /dashboard and capture console messages.
  ```

プロジェクト固有の調査やチェックを追加したい場合は、このドキュメントに追記して共有してください。***
