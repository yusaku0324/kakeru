# セラピストシフト & 空き枠コア (Therapist Shift & Availability core) v1

## 1. ユースケース
- セラピスト/店舗スタッフが、自分の出勤シフトと受付可能時間を登録・更新し、ゲスト予約やマッチングで「この時間帯は予約可否」を判定するために使う。
- ゲスト向け予約エンジン（/api/guest/reservations）やマッチング検索（/api/guest/matching/search）が、このシフト情報を参照して空き枠を判断する。
- 予約カレンダー表示（◎/△/✕）や直前予約の締切制御に直結する。
- 突発休み・受付停止などを即時反映でき、UI が落ちず fail-soft で振る舞うことを優先する。

## 2. 入力と出力の定義

### 入力（シフト登録リクエスト）
- therapist_id: string(UUID), 必須
- shop_id: string(UUID), 必須
- date: string(YYYY-MM-DD), 必須
- start_at: string(ISO-8601, timezone付き), 必須
- end_at: string(ISO-8601, timezone付き), 必須
- break_slots: array<{start_at, end_at}>, 任意（休憩。シフト内に完全に収まる前提）
- availability_status: string, 任意（"available" | "busy" | "off" など。デフォルト "available"）
- notes: string, 任意（出勤メモ）

### 出力（シフトオブジェクト）
- id: string(UUID)
- therapist_id, shop_id, date, start_at, end_at
- break_slots: array<{start_at, end_at}>
- availability_status: string
- notes: string | null
- created_at, updated_at

### 出力（ゲスト向け空き枠リスト）
- date: YYYY-MM-DD
- slots: [{ start_at, end_at, status: "free" | "few" | "full" | "closed" }]
  - v1 では "free" と "closed" の2値でも可。 "few"/"full" は TODO。

## 3. ビジネスルール・ロジック
- 空き枠計算: シフト時間帯 － 休憩 － 確定済み予約(GuestReservation) の差分を計算。
- 判定API/関数:
  - `is_available(therapist_id, start_at, end_at)`  
    - 完全に内包する "available" シフトがあること
    - 休憩と重ならないこと
    - 同一セラの confirmed/pending 予約と重複しないこと
    - fail-soft: 異常があっても例外にせず (False, reasons) を返す
  - `list_daily_slots(therapist_id, date)` (簡易版で可)  
    - v1 は status を "free"/"closed" 程度に留め、細かい閾値は TODO
- 直前予約の締切: 予約コアの締切ルール（例: 開始60分前まで）と整合。締切超過は "closed" 扱い。
- 重複判定: シフト自体も同一セラで重複登録不可。予約との重複は空き枠計算時に除外。

## 4. 具体例
- ケース1: 通常シフト + 休憩 + 予約あり  
  - 10:00–18:00, 休憩 13:00–14:00, 予約 15:00–16:00  
  - 空き枠: 10–13 free, 14–15 free, 16–18 free/closed は残枠次第（v1は2値でも可）
- ケース2: 夕方スポット出勤 + 締切またぎ  
  - 17:00–22:00, 締切60分。現在16:30で 17:30–18:30 予約希望 → 締切内で closed, 18:30以降は free。
- ケース3: 一時受付停止  
  - availability_status="off" または break_slots で全時間を塞ぐ → その日の slots は全て "closed"。

## 5. 不変条件（invariants）
- start_at < end_at を満たさないシフトは登録不可。
- 同一セラピストのシフトは同じ時間帯で重複しない。
- 休憩時間はシフトの範囲内に完全に収まる。
- シフトが存在しない日時に「空きあり」と判定しない。
- GuestReservation の確定済み予約は基本的にどこかのシフトに内包される（例外時は closed 扱い）。
- fail-soft: ゲスト側判定では例外を投げず、空/closed を返す。

## 6. 前提・推測（ドラフトの補足）
- シフトは1日複数本を許容。重複チェックで排除。
- availability_status はシンプルな離散値で運用（"available"/"busy"/"off"）。拡張余地あり。
- free/few/full の閾値は v1 では簡易/未決。後続タスクで調整。
- 移動時間や複数店舗勤務は v1 では未対応（将来拡張）。
- base_staff_id などの類似優先はシフトでは扱わず、予約/マッチング側で処理。
