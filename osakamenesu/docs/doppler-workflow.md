# Doppler ワークフロー

このリポジトリは **Doppler で注入された環境変数** を前提に設計されています。`python` や `pytest`、`uvicorn` などを直接実行した場合は認証情報が不足し、実行結果が本番と乖離します。常に `doppler run --project osakamenesu --config <config> -- ...` を経由してください。

## 推奨コマンド

- API 単体: `doppler run --project osakamenesu --config dev_web -- pnpm dev:api`
- Web 単体: `doppler run --project osakamenesu --config dev_web -- pnpm dev:web`
- 依存サービス (DB/Meili/Redis): `just ops-dev-up` (内部で Doppler を呼び出します)
- Python テスト: `doppler run --project osakamenesu --config dev_web -- pytest`

## Doppler ガード

- `tools/require_doppler_env.py` は現在のシェルが Doppler から実行されているかを確認します。`DOPPLER_PROJECT` や `DOPPLER_CONFIG` が欠落している場合は非 0 で終了するため、`just require-doppler` のようにガードとして利用できます。
- Doppler 経由で実行していない状態で `just` 等から直接 API を起動すると環境差異が生じるため、PR テンプレートやチーム内ルールで「Doppler run 以外の実行は禁止」と明示してください。

## 環境別 Config

| Config     | 用途                           |
|------------|--------------------------------|
| `dev_web`  | ローカル開発 (FastAPI + Next)  |
| `dev_docker` | Docker Compose 経由の Ops API |
| `stg_web`  | ステージング環境              |

CLI からは以下のように指定します。

```bash
doppler run --project osakamenesu --config dev_web -- <command>
```

## Doppler CLI のチェック

`just require-doppler` で `tools/require_doppler_env.py` を実行し、現在のシェルが Doppler 経由かを確認できます。fail した場合は `doppler run` を付けてコマンドを再実行してください。
