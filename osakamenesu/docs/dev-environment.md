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

インストールされるもの: `direnv`, `mise`, `pre-commit`, `bat`, `fd`, `ripgrep`, `exa` など。

## 3. pre-commit

1. `pip install pre-commit`（または `pipx install pre-commit`）。
2. プロジェクト直下でフックをインストールします。
   ```bash
   pre-commit install
   ```

コミット時に `ruff`、`npm run lint`、`npm run typecheck` などが自動で実行されます。

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
```

## 6. その他

- `scripts/deploy_api.sh --rotate` で Cloud SQL パスワードと Meilisearch キーを再発行しつつデプロイできます。
- `scripts/dev_magic_link.sh` でマジックリンクの URL を取得できます。

これらのツールを導入したら、`docs/local-helper-scripts.md` も参照してください。

## 7. Docker での API/DB ワークフロー

- `docker compose` でバックエンドを起動するときは、API コンテナが **必ず** `postgresql+asyncpg://app:app@osakamenesu-db:5432/osaka_menesu` に接続するようにしてください。ホスト側の `DATABASE_URL` などが上書きしないよう `docker-compose.yml` の値をそのまま使います。
- Alembic が存在しないリビジョンで止まった場合（例: `Can't locate revision identified by 'xxxx'`）は、ローカル DB をリセットします。**注意: これによりローカルのデータはすべて失われます。**
  ```bash
  docker compose down
  docker volume rm osakamenesu_osakamenesu-db-data
  docker compose up osakamenesu-db osakamenesu-redis osakamenesu-meili osakamenesu-api
  ```
  新しい空の DB に対して、コンテナ起動時に `alembic upgrade head` が再実行されます。
