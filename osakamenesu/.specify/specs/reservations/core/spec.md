# 予約ドメイン: ゲスト予約エンジン v1 – 受付ルールとカレンダー仕様

## 1. ユースケース
- ゲスト（一般利用者）が Web から「エリア・日付・時間帯・コース・指名/フリー」を指定し、予約を確定する。
- 店舗（プロファイル）やセラピスト詳細、マッチング結果、カレンダー一覧から予約導線に入る。
- 直前予約（当日〜数時間前）や事前予約（数日先）でも、空き枠と受付締切を踏まえて可否判定できる。
- 無断キャンセルやオーバーブッキングを防ぎ、店舗・セラピスト・ゲストの不利益を最小化する。

## 2. 入力と出力の定義
### 入力（予約リクエスト）
- area: string, 任意（店舗検索用。空なら店舗ID必須）
- date: string(YYYY-MM-DD), 必須
- start_at: string(ISO-8601), 必須（予約開始日時）
- end_at: string(ISO-8601), 必須（予約終了日時）
- duration_minutes: int, 必須（コース時間。start/end と一致することが望ましい）
- shop_id: string, 必須（店舗/プロファイルID）
- therapist_id: string | null, 任意（指名時に指定。null はフリー/おまかせ）
- course_id: string | null, 任意（コース/メニューID）
- price: number | null, 任意（参考価格。確定価格は店舗側で計算/表示）
- payment_method: string | null, 任意（例: cash/card。v1 は緩め）
- contact_info: object | null, 任意（email/phone/line_id 等。保存は最小限）
- guest_token: string | null, 任意（未ログインゲスト識別用）
- notes: string | null, 任意（要望/連絡事項。公序良俗・規約違反は拒否）
- base_staff_id: string | null, 任意（「この子に近いタイプ」を検索して予約する場合の参照）

### 出力（予約オブジェクト）
- id: string
- status: string（draft/pending/confirmed/cancelled/no-show など。v1 は confirmed/cancelled 主）
- shop_id: string
- therapist_id: string | null（フリー/おまかせの場合は null または割当結果）
- start_at / end_at: string(ISO-8601)
- duration_minutes: int
- course_id: string | null
- price: number | null
- payment_method: string | null
- contact_info: object | null
- guest_token: string | null
- created_at / updated_at: string(ISO-8601)
- audit: { created_by, cancelled_by, cancelled_reason } | null（将来拡張）
- debug (任意): { rejected_reasons: string[] }（実装が返せる場合に限り）

## 3. ビジネスルール・ロジック
### ステータス遷移（v1）
- draft → pending → confirmed → cancelled  
  - v1 は即時 confirmed でも可。pending は将来の店舗承認フロー用に予約。
- no-show/fulfilled は将来拡張（v1 では扱わない）。

### 予約可否判定
- 指名: therapist_id が公開中で、シフト内かつ既存予約と重複しない場合のみ可。
- フリー/おまかせ: 店舗内で条件を満たすセラピストを割当可能な場合のみ可（割当失敗は予約確定しないが 5xx は出さない）。
- ダブルブッキング禁止: 同一セラピストの重複枠（start/end が重なる）を許可しない。
- シフト整合: 予約時間帯はセラピストのシフトを内包し、移動時間が必要なら加味して衝突を禁止。

### 締切・キャンセル・変更
- 受付締切: 予約開始の ○ 分前（例: 60 分前まで）。店舗設定で変動可能。締切超過は予約不可（fail-soft で空応答可）。
- 最短予約時間: duration_minutes はコースに準拠。設定外の長さは拒否/空応答。
- キャンセル: ゲスト都合/店舗都合を区別。ペナルティは v1 では「なし」と明記。
- 時間変更: v1 では「キャンセルして取り直し」。直接変更は未対応と明記。

## 4. 具体例
- 平日昼の通常予約  
  - 入力: date=2025-01-10, start=14:00, end=15:30, shop_id=S1, therapist_id=T1  
  - 出力: status=confirmed, id=R1, is_available=true（被りなし/シフト内）
- 直前予約（締切超過）  
  - 入力: date=今日, start=30分後, shop_id=S1, therapist_id=T1  
  - 判定: 締切 60分前ルール → 予約不可（空リスト or UI で締切表示。API は fail-soft で空/neutral）
- キャンセル  
  - 入力: reservation_id=R1, actor=guest  
  - 出力: status=cancelled, ok=true（ペナルティなし）。二重キャンセルも idempotent に cancelled。

## 5. 不変条件（invariants）
- レスポンスは必ず {items?, total?} か単一予約オブジェクトで、id/status/start_at/end_at を欠かさない。
- スコア/在庫判定は 0.0〜1.0 にクリップし、欠損は 0.5 中立（matching 憲法を踏襲）。
- ダブルブッキング禁止: 同一セラピストの重複枠を許可しない。
- シフト外予約禁止: シフト/営業時間外の枠は確定させない。
- エラー時は fail-soft: 入力不足・内部エラーでも 5xx ではなく空/中立で返す（ログは残す）。
- 公序良俗遵守: notes/free_text が規約違反の場合は予約を拒否/無視（ログのみで十分）。

## 6. 勝手に置いた前提・推測
- area/date 欠損時は 422 ではなく空応答で UI を落とさないことを最優先（憲法の fail-soft 方針）。
- payment_method/price は v1 では緩めに扱い、将来の決済導入で厳格化する前提。
- フリー/おまかせ割当は「候補がいない場合は予約確定しない」方針（エラーではなく空/提案なし）。
- 移動時間の具体計算は未決定（シフト内かつ重複なしを最低限、移動時間は将来拡張）。
- no-show/ペナルティは v1 では導入せず、ステータス名だけ予約しておく。
