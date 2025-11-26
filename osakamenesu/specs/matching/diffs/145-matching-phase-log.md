# Diff Spec: Log matching phase on guest match logs (#145)

## Current behavior (as of main)

- `GuestMatchLog` tableと `_log_matching` ヘルパーは、検索ペイロードと ranked candidates（top + other）、
  および後続の selection 情報を非同期に保存している。
- 保存される主な情報:
  - ゲスト入力: area/date/budget, mood/talk/style/look preferences, free_text など
  - 候補: therapist ids, scores, breakdown など（top + other を含む）
  - selection: 選ばれた therapist/slot 情報（後続の選択イベント時に追記）
- ログは `guest_token` などで紐づけられるが、
  **「この検索がコンシェルジュフローのどのフェーズだったか（phase）」という情報は保存されていない。**
- logging はレスポンスをブロックしない best-effort であり、部分的な失敗はユーザーフローに影響しない。

## Change in this issue (diff)

### 1. GuestMatchLog に `phase` フィールドを追加

- `GuestMatchLog` に、matching/search のフェーズを保存するための新フィールドを追加する。

  - フィールド名: `phase`
  - 型（概念レベル）: `string | null`
  - 取りうる値: `'explore' | 'narrow' | 'book'`
  - 既存ログとの互換性のため nullable（null は「不明 / 非対応」を意味する）

- 参考: `specs/matching/search.yaml` の `MatchingSearchQuery.phase` と同じ enum を採用する。
  - explore: 好み探索フェーズ。availability を使わないモード。
  - narrow: 好みが見えてきて、ざっくりの時期も決まりつつあるフェーズ。availability をブーストとして使う。
  - book: 具体的な日時で予約したいフェーズ。availability でフィルタする。

### 2. ログ書き込み時に phase を保存

- `/api/guest/matching/search` から `_log_matching` を呼び出す際に、
  `MatchingSearchQuery.phase` を取得し、その値を `GuestMatchLog.phase` に保存する。
- 具体的なルール:

  - リクエストに `phase` が含まれている場合:
    - `phase` が `'explore' | 'narrow' | 'book'` のいずれかであれば、そのまま保存。
    - 不正な文字列が来た場合はログ上は `null` とし、バリデーションエラーにはしない（v1では静かにスキップ）。
  - `phase` が指定されていない場合:
    - concierge 以外からの通常検索を想定し、`GuestMatchLog.phase` は `null` のままとする。
    - 将来的に通常検索を `book` として明示したくなった場合は別 diff で扱う。

- selection ログ（ゲストが最終的な therapist/slot を選んだとき）で `GuestMatchLog` を更新する際には、
  既存の `phase` は変更しない（検索時点のフェーズを保つ）。

### 3. 内部 API / 型定義の調整

- `_log_matching` およびそれを呼び出すドメイン層の関数に `phase: str | None` を追加し、
  呼び出し元（matching/search ハンドラ）から渡せるようにする。
- 既存の呼び出しサイトは、phase を使わない場合は `None` を渡す形に更新する。

## Non-goals

- 新しい analytics ダッシュボードや集計処理の追加は本 diff の対象外。
  - `phase` はあくまで将来の分析・チューニング用のメタデータとして保存するのみ。
- score 計算や候補の並び順など、matching の挙動そのものは本 diff では変更しない。
  - availability の扱い（explore/narrow/book ごとの挙動）は
    `specs/matching/search.yaml` の変更に従って別途実装される前提とする。
- 既存のログレコードに対する backfill は行わない（すべて `phase=null` のままとする）。
- `phase` 以外の新しいフィールド（例: step_index, availability_mode など）はこの diff では追加しない。

## Links

- Related core spec: `specs/matching/search.yaml` (MatchingSearchQuery.phase)
- Existing logging diff: `specs/matching/diffs/141-guest-matching-log.md`
- Issue: https://github.com/osakamenesu/kakeru/issues/145
