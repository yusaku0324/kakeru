# CI ローカル実行ガイド

`pnpm ci:local` は GitHub Actions の admin-e2e ジョブを手元で再現するためのコマンドです。Doppler の `stg_ci_local` 設定を読み込み、CI と同じ `docker-compose.admin-e2e.yml` にローカル専用の `docker-compose.admin-e2e.override.yml` を重ねてスタック（db / meili / redis / api / web）を起動し、その後 CI と同一オプションの `docker compose up --no-deps --abort-on-container-exit --exit-code-from e2e --no-build e2e` を走らせます。

```bash
pnpm ci:local
```

## 使いどころ

- GitHub Actions の admin-e2e (Playwright) が落ちたときに、同じ Compose 構成で再現できます。
- `docker-compose.admin-e2e.override.yml` でポート公開や `host.docker.internal` の extra_hosts など、ローカル専用の上書きを提供しています。
- CI と同じイメージ／環境変数を使用するため、CI でのみ発生するネットワークや依存関係の問題切り分けに役立ちます。

> ℹ️ Doppler の `stg_ci_local` コンフィグにアクセスできることが前提です。権限がない場合は担当者に依頼してください。
