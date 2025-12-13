# 検索/空き状況の観測手順（運用チェックリスト）

## 1) shops検索 (/api/v1/shops)
- コマンド例:
  `curl -s "https://api.osakamenesu.com/api/v1/shops?q=momona"`
- 期待ログ (info):
  - `shop_search`
  - `status_code` / `latency_ms` / `q` / `today` / `available_date` / `result_count`
- 見たいポイント: result_count が 0 なのか、latency が悪化していないか。

## 2) availability_slots (/api/guest/therapists/{id}/availability_slots)
- コマンド例（JST今日を指定）:
  `curl -s "https://api.osakamenesu.com/api/guest/therapists/<therapist_id>/availability_slots?date=YYYY-MM-DD"`
- 期待ログ (info):
  - `availability_slots`
  - `status_code` / `latency_ms` / `therapist_id` / `date` / `result_count`
- 見たいポイント: result_count が 0 かどうか。0ならシフト/availability同期を確認。

## 3) Meiliタスク失敗
- 期待ログ (error):
  - メッセージ: `Meili task failed`
  - `taskUid` / `index` / `error` / `type`
- 対処: Meiliのヘルス確認・settings/documents再投入。致命的なら再デプロイ。

## 4) seed運用ポリシー（安全弁）
- `E2E_SEED_ENABLED` は本番ではデフォルトOFF。必要時のみ一時的に true にし、実行後すぐ戻す。
- seed実行ログ: `e2e_seed` (info) に remote_addr / therapist_id / shop_id / date が出る。
- seedレスポンスに検証URLがあるので、手動確認はそれを叩く。
  - 例: `/api/v1/shops?q=momona`, `/api/guest/therapists/<id>/availability_slots?date=<today>`
- ON/OFF手順（Fly例）:
  - ON: `fly secrets set E2E_SEED_ENABLED=true`
  - OFF: `fly secrets unset E2E_SEED_ENABLED`（原則こちらの状態）

## 5) 0件UX/PR表記（UI回帰）
- 0件検索: `/search?q=zzzzzzzz` で「該当なし」表示と 2 ボタン（条件クリア / 本日予約できるだけ見る）。
- PR文言: 「直近の空き枠から自動ピックアップ」「おすすめ（準備中）」で“編集部”表記なし。
- Playwright回帰テスト `search-no-results.spec.ts` で確認可能。不要時はCIでスキップせず実行推奨。

## 6) CI/E2E実行ポリシー
- GitHub Actions `.github/workflows/ci-e2e.yml` は push / pull_request のたびに必ず実行（スキップ不可）。
- シークレット `E2E_SEED_TOKEN` は常時セットが前提。未設定だとワークフローは即Failして気付ける。
- 実行対象: `shift-to-availability-sync.spec.ts`, `search-no-results.spec.ts`（本番URL/APIを参照）。
- アーティファクト（スクショ/ログ）はデフォルト保存。CIが落ちたらまずこれを確認。

## 7) 勤怠→slots 生成 / API 監視
- 勤怠保存ログ: shift保存時に shift_id / staff_id / date_range / tz を確認。
- slots生成ログ: `availability_generate` (info) で generated_count / reason_if_zero / latency_ms / shift_id / staff_id を確認。
- 検索APIログ: `shop_search summary` (info) で result_count / today_available_count / next_slot_null_count / q を確認。
- 「shiftがあるのにslots=0」のときは上記ログを確認し、勤怠入力・休憩・予約/buffer・日跨ぎで除外されていないかを追う。

---

- 2025-12-13 実機確認OK（担当: 坂野） `/search?q=zzzzzzzz`, `/search?q=momona`, PR文言、APIログ出力
- 2025-12-13 apex反映確認OK（担当: assistant） `/search?q=zzzzzzzz`, `/search?q=momona`, `/search?q=SSS`（“編集部”文言なし）
- 2025-12-13 APIログ確認OK（担当: assistant） `/api/v1/shops?q=momona`, `/api/guest/therapists/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/availability_slots?date=2025-12-13`
- 2025-12-13 E2E shift→slots→UI 確認OK（担当: assistant） `/internal/e2e/shifts` + `/internal/e2e/rebuild_slots` でスロット生成/0件を切り替え、`shift-to-public-ui-consistency.spec.ts` でカード表示を検証
