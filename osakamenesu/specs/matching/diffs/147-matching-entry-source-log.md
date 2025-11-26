# Diff Spec: Log matching entry source on guest match logs (#147)

## Current behavior (as of main)

- `GuestMatchLog` は検索ペイロードや候補、selection 情報を保存しているが、
  「この matching/search がサイト内のどこから発火したか（入口情報）」は持っていない。
- 実際には以下のような入口が存在する:
  - トップや一覧からの通常検索フォーム
  - コンシェルジュフロー（チャット/質問ベース）のサジェスト
  - セラピスト詳細ページからの「似ているセラピスト」導線
- 入口ごとの制約率や挙動を比較することができず、
  「どの入口にリソースを寄せるべきか」「どの導線がコンバージョンしやすいか」が見えづらい。

## Change in this issue (diff)

### 1. GuestMatchLog に `entry_source` フィールドを追加

- `GuestMatchLog` に、matching/search の入口を保存するフィールドを追加する。

  - フィールド名: `entry_source`
  - 型（概念レベル）: `string | null`
  - 想定される値（v1）:
    - `'search_form'`        : 通常の検索フォームからの検索
    - `'concierge'`          : コンシェルジュフローからの検索
    - `'therapist_detail'`   : セラピスト詳細ページからの検索（similar / この子に似た人）
    - `'other'`              : 上記に当てはまらないその他
  - 列挙は将来的に増やす可能性があるため、DB上は free-form string + null を許容する。

### 2. MatchingSearchQuery に `entry_source` を追加

- `specs/matching/search.yaml` の `MatchingSearchQuery` に以下のフィールドを追加する。

  ```yaml
  contexts:
    MatchingSearchQuery:
      fields:
        # ...既存フィールド...
        entry_source:
          type: string
          required: false
          description: >
            この matching/search がどの入口から発火したかを表す識別子。
            例: "search_form", "concierge", "therapist_detail", "other" など。
            v1 ではバリデーションは緩くし、未知の文字列はそのまま保存する。
  ```

entry_source は主にクライアント側（フロントエンド）が設定する。

- 通常検索フォーム: "search_form"
- コンシェルジュフロー: "concierge"
- セラピスト詳細からの similar 検索: "therapist_detail"
- 特定できない / 実験的な導線: "other" または未指定（null）

### 3. ログ書き込み時に entry_source を保存

- `/api/guest/matching/search` から `_log_matching` を呼び出す際に、
  `MatchingSearchQuery.entry_source` を取得し、その値を `GuestMatchLog.entry_source` に保存する。

- ルール:

  - リクエストに `entry_source` が含まれている場合:
    - 文字列はそのまま保存する（v1 では enum バリデーションを行わない）。
    - これにより、新しい入口種別をクライアント側で試すことができる。
  - `entry_source` が指定されていない場合:
    - `GuestMatchLog.entry_source` は `null` のままとする。

- phase や step_index と組み合わせることで、
  「どの入口から、どのフェーズ・何ターン目で、どのくらい予約に繋がるか」の分析が可能になる。

## Non-goals

- entry_source に基づくスコアリング変更や、UI の出し分けは本 diff の対象外。
  - 本 diff はあくまでログ用のメタデータを保存するだけ。
- entry_source の値を厳密な enum として制約することも本 diff の範囲外。
  - 将来的な拡張や A/B テストを容易にするため、v1 では free-form string を許容する。
- 既存ログへの backfill は行わない（すべて entry_source=null のままとする）。

## Links

- Core spec: `specs/matching/search.yaml` (MatchingSearchQuery)
- Related diff: `specs/matching/diffs/141-guest-matching-log.md`
- Related diff: `specs/matching/diffs/145-matching-phase-log.md`
- Related diff: `specs/matching/diffs/146-matching-step-index-log.md`
- Issue: (TBD; e.g. https://github.com/osakamenesu/kakeru/issues/147)
