# Diff Spec: Log matching step index on guest match logs (#146)

## Current behavior (as of main)

- `GuestMatchLog` table と `_log_matching` ヘルパーは、検索ペイロードと ranked candidates（top + other）、
  および後続の selection 情報を非同期に保存している。
- `specs/matching/diffs/141-guest-matching-log.md` に従い、
  - ゲスト入力（area/date/budget など）
  - 候補（therapist ids, scores, breakdown など）
  - selection 情報
  が保存される。
- `specs/matching/diffs/145-matching-phase-log.md` により、`phase`（explore/narrow/book）がログに追加される。
- 一方で、「この検索がコンシェルジュ会話の何ターン目に行われたか」は保存されておらず、
  コンシェルジュのステップ数と成約率・離脱率を関連づけて分析することができない。

## Change in this issue (diff)

### 1. GuestMatchLog に `step_index` フィールドを追加

- `GuestMatchLog` に、matching/search のステップ番号を保存するフィールドを追加する。

  - フィールド名: `step_index`
  - 型（概念レベル）: `integer | null`
  - 最小値: 1（1始まりのステップ番号）
  - 意味:
    - 同一ゲストのコンシェルジュフローにおける「n 回目の候補提案」や「n 回目の検索」を表す。
    - `1` が最初の検索/提案、`2` が2回目…というイメージ。
  - 既存ログとの互換性のため nullable（null は「未知/非対応」を意味する）。

### 2. MatchingSearchQuery に `step_index` を追加

- `specs/matching/search.yaml` の `MatchingSearchQuery` に以下のフィールドを追加する。

  ```yaml
  contexts:
    MatchingSearchQuery:
      fields:
        # ...既存フィールド...
        step_index:
          type: integer
          required: false
          minimum: 1
          description: >
            コンシェルジュ/マッチングフローにおけるこの検索のステップ番号。
            1 が最初の候補提示/検索、2 が2回目…という形でクライアント側（concierge）がインクリメントして送信する。
            通常検索フォームなど、ステップ概念がない場合は省略可。
  ```

step_index は主にコンシェルジュフローから送られることを想定しており、
通常の検索フォームからは指定されない（ログ上は null のまま）ことが多い。

### 3. ログ書き込み時に step_index を保存

- `/api/guest/matching/search` から `_log_matching` を呼び出す際に、
  `MatchingSearchQuery.step_index` を取得し、その値を `GuestMatchLog.step_index` に保存する。

- ルール:

  - リクエストに `step_index` が含まれている場合:
    - `step_index >= 1` であれば、そのまま保存する。
    - 0 以下や整数でない値が来た場合はログ上は `null` とし、バリデーションエラーにはしない（v1では静かにスキップ）。
  - `step_index` が指定されていない場合:
    - `GuestMatchLog.step_index` は `null` のままとする。

- phase と同様に、selection ログ更新時に `step_index` は変更しない（検索時点のステップ番号を保持する）。

### 4. 推奨運用（クライアント側）

- コンシェルジュフローでは、同一ゲスト・同一会話セッション内で、
  `step_index` を 1, 2, 3, ... とクライアント側でインクリメントして `/matching/search` に付与する。
- 通常の検索フォームや単発の検索は `step_index` を省略してよい。

## Non-goals

- 会話セッションIDや conversation_id の導入は本 diff の対象外。
  - あくまで「ステップ番号」だけを保存する。
- `step_index` に基づくスコアリングや UI の出し分けは本 diff では行わない。
  - 分析と将来のチューニングのためのメタデータとして保存するのみ。
- 既存ログに対する backfill は行わない（すべて `step_index=null` のままとする）。
- `step_index` 以外の新しいフィールド（例: entry_source 等）はこの diff では追加しない。

## Links

- Core spec: `specs/matching/search.yaml` (MatchingSearchQuery)
- Related diff: `specs/matching/diffs/141-guest-matching-log.md`
- Related diff: `specs/matching/diffs/145-matching-phase-log.md`
- Issue: (TBD; e.g. https://github.com/osakamenesu/kakeru/issues/146)
