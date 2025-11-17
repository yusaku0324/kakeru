# 垂直スライス設計ガイド

このプロジェクトでは、ドメインごとに Router → Service → Infra を閉じ込める垂直スライスを採用します。以下のルールを新機能でも徹底してください。

1. **Router と Service を分離する**
   - Router (`domains/<slice>/router.py`) は FastAPI 型・HTTPException など HTTP 層に限定。
   - Service (`domains/<slice>/services/*.py`) はドメインロジックのみ。HTTP 型や FastAPI import を禁止（`service-layer-no-fastapi` ルールで監視）。

2. **Slice 跨ぎを避ける**
   - `domains/dashboard/**` から `domains/site/**` へ直接 import しない。どうしても必要な共通処理は `app/utils/` など共通モジュールへ移動。
   - 既知の例外は `tools/architecture_check.toml` の `[[import_rules.allow]]` に理由付きで登録し、解消したら削除。

3. **サブサービスを細分化**
   - 1 ファイル 600 行を超える前に責務単位で `SearchService` / `ProfileService` などへ分割。
   - 共通処理（監査・メディア変換など）は専用 helper を作り再利用。

4. **新規 slice のテンプレ**
   - `domains/<slice>/__init__.py` … Router の公開のみ
   - `domains/<slice>/router.py` … HTTP 入出力 + `_run_service` アダプタ
   - `domains/<slice>/services/<feature>_service.py` … ドメインロジック
   - `domains/<slice>/schemas.py` … slice 固有の Pydantic モデル（必要に応じて）

5. **テストと監視**
   - slice 追加時には最小限の unit test を `domains/<slice>/tests/` に配置。
   - `just check-all` を習慣化し、巨大化や依存違反をすぐ検知。

これらを守ることで、各 slice が独立して開発・デプロイできる構造を保てます。
