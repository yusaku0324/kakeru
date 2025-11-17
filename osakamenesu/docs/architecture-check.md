# アーキテクチャ健全性チェック

`tools/architecture_check.py` は、肥大化したモジュールやホットスポットを即座に洗い出すための薄いスクリプトです。CI でもローカルでも追加の依存なく動作し、毎週のアーキテクチャ振り返りで「どこから崩れかけているか」を定量的に把握できます。

## 使い方

```bash
# もっとも手軽なのは just タスク
just architecture-check

# JSON レポートが欲しい場合
python tools/architecture_check.py --json > /tmp/arch-report.json

# しきい値や対象ディレクトリを一時的に変える
python tools/architecture_check.py --max-lines 450 --include services/api,apps/web/src/app
```

実行すると、指定拡張子（初期設定では Python / TS / TSX）のファイルをスキャンし、行数が `max_lines` を超えたものを降順で表示します。続いて、パスの深さ（`hotspot_depth`）ごとに合計行数を算出して「どのモジュールが特に肥大化しているか」を可視化します。

## 設定

- `tools/architecture_check.toml` でデフォルト値を管理しています。
- TOML の `include` / `exclude` によって対象ディレクトリや除外パターンを制御できます。
- 一時的に異なる設定で走らせる場合は CLI 引数が TOML より優先されます。
- `[[allowlist]]` セクションで既知の大規模ファイルを許可できます。`path` はリポジトリルートからのパス（POSIX 形式）、`max_lines` で暫定許容ライン数、`reason` で経緯を明記してください。リファクタが終わったら該当エントリを削除します。
- `[[import_rules]]` で依存方向ガードを定義できます。`include` に glob を指定し、`disallow` に禁止モジュール（例: `fastapi`）を列挙します。既知の例外は `[[import_rules.allow]]` に `path` / `reason` を記載してください。

例: 行数しきい値を 500 行に下げて apps/web のみを調査する場合は以下の通りです。

```bash
python tools/architecture_check.py --max-lines 500 --include apps/web/src
```

## 定例での活用方法

1. 毎スプリントの Architecture Triage で `just architecture-check` を実行し、リスト上位のファイルを議論します。
2. 気になるファイルをコピーして GitHub Issue（Tech Debt backlog）に追加し、担当者と優先度を決めます。
3. `--json` 出力を Slack に貼る or GitHub Actions のアーティファクトに保存すると、経時変化も追いかけやすくなります。

`--fail-on-issues` フラグを付ければ、閾値を超えた時点で終了コード 1 を返すため、CI のゲートとしても利用できます（既知の大型ファイルを潰しきった段階で有効化する想定）。

## CI での自動ガード

`.github/workflows/architecture-check.yml` がプッシュ／PR 時に `python tools/architecture_check.py --fail-on-issues` を実行し、新たに閾値を超えたファイルがあれば CI を落とします。既知の巨大ファイルは `tools/architecture_check.toml` の `[[allowlist]]` に登録した行数以内で OK とし、エントリを減らすことがチームのベロシティ目標になります。

依存方向ガードも同じワークフローで評価されます。禁止された import（例: サービス層での `fastapi` import）が追加されると CI で失敗し、`[[import_rules.allow]]` に登録済みの既知の負債だけが「Allowlisted」として表示されます。

また `.github/workflows/artifact-guard.yml` では `python tools/check_artifacts.py` を実行し、`.next` や `apps/web/test-results/**` などのビルド・E2E アーティファクトが誤ってコミットされていないかを常にチェックしています。不要ファイルを見つけた場合はリストに表示されるため、コミット前に削除してください。

`.github/workflows/import-cycles.yml` は `python tools/check_cycles.py` を実行し、`services/api/app` 配下での import 循環を検知します。循環が見つかると具体的なサイクルを出力し CI が失敗するため、大規模なリファクタ前でも構造崩れにすぐ気付けます。

ローカルで CI と同じ条件を試す場合は次を実行してください。

```bash
python tools/architecture_check.py --fail-on-issues
```

## 追加したいルール

今後、重複している環境変数解決ロジックや Circular import など、別のヒューリスティックを追加したい場合は `architecture_check.py` 内で新しい検出関数を実装し、`print_summary` / `to_jsonable` に表示ロジックを加えてください。標準ライブラリのみで完結させる方針のため、可能な限り既存の仕組みを活用して拡張する想定です。
