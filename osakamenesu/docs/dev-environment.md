# 開発環境セットアップガイド

このプロジェクトでは以下のツールを利用すると開発効率が上がります。

## 1. direnv + mise

1. Homebrew でインストールします。
   ```bash
   brew install direnv mise
   ```
2. シェルにフックを追加します（例: `~/.zshrc`）。
   ```bash
   eval "$(direnv hook zsh)"
   eval "$(mise activate zsh)"
   ```
3. リポジトリ直下の `.envrc` を有効化します。
   ```bash
   direnv allow
   ```
   これで `.mise.toml` に記載した Node.js/Python バージョンが自動的に切り替わり、`.env` の内容も読み込まれます。

## 2. 推奨 CLI ツール

`tools/install-dev-tools.sh` を実行すると macOS でよく使う CLI をまとめてインストールできます。

```bash
./tools/install-dev-tools.sh
```

インストールされるもの: `direnv`, `mise`, `lefthook`, `bat`, `fd`, `ripgrep`, `exa` など。

## 3. Lefthook

1. `brew install lefthook` でバイナリを入れます（上記の `tools/install-dev-tools.sh` でもインストールされます）。
2. プロジェクト直下で Git フックを有効化します。
   ```bash
   lefthook install
   ```

コミット時に `ruff`、`ruff format`、`npm run lint`、`npm run typecheck`、`pytest services/api` などが自動で実行されます。`lefthook run pre-commit` でフック全体を手動実行することも可能です。

## 4. gcloud 周りの補助スクリプト

| スクリプト | 用途 |
| --- | --- |
| `tools/fix-quarantine.sh <path>` | macOS の quarantine/provenance 属性を削除 |
| `tools/use-temp-gcloud-config.sh` | 一時的な `CLOUDSDK_CONFIG` を設定（`source` して使用） |
| `tools/gcloud-login-no-browser.sh` | ブラウザを開けない環境で `gcloud auth login` |
| `tools/backup-project.sh <dest>` | `rsync` によるバックアップ |

## 5. mise タスク

`.mise.toml` によって以下のタスクが利用できます。

```bash
mise run dev          # docker compose dev stack
mise run deploy       # credential rotation + deploy_api.sh --rotate
mise run magic_link   # magic link の発行
mise run fix_quarantine -- path/to/dir
# よく使う Doppler 包装コマンド
mise run dev_full     # doppler dev_web -- pnpm dev
mise run dev_api      # doppler dev_web -- pnpm dev:api
mise run dev_web      # doppler dev_web -- pnpm dev:web
mise run web_lint     # doppler dev_web -- pnpm --dir apps/web lint
mise run web_typecheck
mise run web_test_unit
```

## 6. その他

- `scripts/deploy_api.sh --rotate` で Cloud SQL パスワードと Meilisearch キーを再発行しつつデプロイできます。
- `scripts/dev_magic_link.sh` でマジックリンクの URL を取得できます。

これらのツールを導入したら、`docs/local-helper-scripts.md` も参照してください。

## 7. Docker での API/DB ワークフロー

- `docker compose` でバックエンドを起動するときは、API コンテナが **必ず** `postgresql+asyncpg://app:app@osakamenesu-db:5432/osaka_menesu` に接続するようにしてください。ホスト側の `DATABASE_URL` などが上書きしないよう `docker-compose.yml` の値をそのまま使います。
- 予約通知を有効にしたい場合は `docker compose up osakamenesu-notifications` も実行し、専用ワーカーを API とは別プロセスで起動します（コンテナ内で `python -m app.scripts.notifications_worker` を実行）。
- Alembic が存在しないリビジョンで止まった場合（例: `Can't locate revision identified by 'xxxx'`）は、ローカル DB をリセットします。**注意: これによりローカルのデータはすべて失われます。**
  ```bash
  docker compose down
  docker volume rm osakamenesu_osakamenesu-db-data
  docker compose up osakamenesu-db osakamenesu-redis osakamenesu-meili osakamenesu-api
  ```
  新しい空の DB に対して、コンテナ起動時に `alembic upgrade head` が再実行されます。

## 8. フロントエンドのコード整形

- JavaScript/TypeScript/MDX は Prettier 3 系で整形します。設定はリポジトリ直下の `.prettierrc.json` にまとめています。
- ルートで `pnpm format` を実行すると `apps/web` 配下のコードが `prettier --write .` で整形され、CI 用に `pnpm format:check` も用意しています（`apps/web` 直下でも同名スクリプトが利用可能）。

## 9. GitHub Actions ログの時短取得

- `gh` CLI が入っていれば、`scripts/ci-debug.sh` で最新の失敗 Run（現在のブランチ）を自動取得し、`tmp/ci-logs/` 以下にログを保存します。
- 任意の Run ID を指定したい場合は `scripts/ci-debug.sh <run-id>`。特定 Job のみ見たいときは `--job "<job-name>"` を付けます。
- ログ取得後に `rg` で `ERROR|FAIL|Traceback` などを自動抽出して表示するので、ブラウザを開かなくてもエラー行にすぐ辿り着けます。必要に応じて `RG_PATTERN='foo|bar' scripts/ci-debug.sh` でパターンを上書きしてください。
- **運用ルール:** CI が失敗したらまず `scripts/ci-debug.sh --job <JOB>` を実行してエラー箇所を特定し、その結果をもとに調査を進めてください。ログは `tmp/ci-logs/` に保存されるため、チーム間で共有する際にも利用できます。

## 10. DB 接続情報のワンステップ表示

- Doppler などで `DATABASE_URL` が入った状態で `scripts/print-db-url.sh` を実行すると、ドライバ/ホスト/ユーザー/psql コマンド例を整形して表示します。
- 例: `doppler run --project osakamenesu --config dev_api -- scripts/print-db-url.sh` → DBeaver や `psql` にコピペできる情報が得られます。
- `DATABASE_URL` が未定義の場合はエラーになるため、必ず `doppler run -- ...` 経由で実行してください。
