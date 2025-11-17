# アーキテクチャトリアージ手順

構造崩れを放置しないために、週次で以下のトリアージを実施します。

1. `just require-doppler` で Doppler 実行を確認 → `just check-all` を実行。
2. `architecture_check.py` の結果から巨大ファイル/依存違反を抜き出し、Backlog（issue など）に「ファイル名」「行数」「担当候補」「次のアクション（分割案など）」を記録。
3. Allowlist に残っているファイルは「現行行数 + 20 行」を上限としているため、鳴った時点で即座に担当を決める。分割後、Allowlist から当該エントリを削除。
4. `check_artifacts.py` や `check_cycles.py` が失敗した場合は必ず当日中に対応。生成物は削除し、循環依存は slice の境界を見直してから再実行。

トリアージの結果はドキュメント（Notion/Wiki など）や GitHub Project にまとめ、進行中のリファクタが見える状態を保ちます。リファクタが完了したファイルは Allowlist を縮小または削除し、次のターゲットへ移動してください。
