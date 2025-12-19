# Availability Single Source of Truth (SoT) 最終仕様書

## 概要

本仕様書は、空き状況（availability）データの単一真実源（Single Source of Truth）を定義し、システム全体での一貫した参照ルールを確立する。この仕様は最終決定版であり、将来の開発者が迷うことなく実装できることを目的とする。

## SoT構成図

```
┌─────────────────────────────────────────────────────────────┐
│                    Primary SoT (真実の源泉)                    │
├─────────────────────────────────────────────────────────────┤
│  TherapistShift                                             │
│  ├─ therapist_id, date, start_at, end_at                    │
│  ├─ availability_status = 'available'                       │
│  └─ break_slots (JSON) → _parse_breaks で処理               │
│                                                             │
│  GuestReservation                                           │
│  ├─ therapist_id, start_at, end_at                          │
│  ├─ status IN ('pending', 'confirmed', 'reserved')          │
│  ├─ reserved_until (reserved の場合のみ future チェック)      │
│  └─ buffer_minutes (Profile経由で取得)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ _calculate_available_slots()
┌─────────────────────────────────────────────────────────────┐
│                  Derived Cache (派生データ)                   │
├─────────────────────────────────────────────────────────────┤
│  Availability(slots_json)                                   │
│  ├─ 管理画面・同期用途のみ                                    │
│  ├─ 書き込み: availability_sync.py, admin系                  │
│  ├─ 読み込み: admin画面のみ（キャッシュ時点明示）              │
│  └─ Guest向けコードでの参照は禁止                             │
└─────────────────────────────────────────────────────────────┘
```

## slots_json の役割と参照可否マトリクス

| コードパス | slots_json参照 | 理由 | 代替手段 |
|-----------|---------------|------|----------|
| **Guest系API** | ❌ 禁止 | リアルタイム正確性が必要 | `therapist_availability._calculate_available_slots()` |
| **Search系API** | ❌ 禁止 | ユーザー意思決定に影響 | `therapist_availability._calculate_available_slots()` |
| **Shop系API** | ❌ 禁止 | 予約確定に関わる | `therapist_availability._calculate_available_slots()` |
| **Admin画面** | ✅ 許可 | パフォーマンス重視、概算用途 | キャッシュ時点を明示して表示 |
| **統計・レポート** | ✅ 許可 | 集計用途、概算値で十分 | 「概算値」として明示 |
| **同期処理** | ✅ 許可 | キャッシュ更新のため | `sync_availability_from_shifts.py` |

## today_available / next_available_slot の決定フロー

### データ取得（3クエリ・N+1禁止）

```
1. buffer_minutes取得
   SELECT t.id, p.buffer_minutes 
   FROM therapists t JOIN profiles p ON t.profile_id = p.id
   WHERE t.id IN (:therapist_ids)

2. TherapistShift取得  
   SELECT * FROM therapist_shifts
   WHERE therapist_id IN (:therapist_ids)
     AND date = :target_date_jst
     AND availability_status = 'available'

3. GuestReservation取得
   SELECT * FROM guest_reservations  
   WHERE therapist_id IN (:therapist_ids)
     AND start_at >= :range_start_utc
     AND start_at < :range_end_utc
     AND status IN ('pending', 'confirmed', 'reserved')
```

### 判定ロジック

```
1. _calculate_available_slots(shifts, reservations, buffer_minutes)を実行
   ├─ break_slots を _parse_breaks で処理してshift時間から減算
   ├─ 有効予約を _subtract_intervals で減算  
   ├─ buffer_minutes を予約前後に適用
   └─ 結果: available_intervals のリスト

2. today_available判定
   available_intervals.length > 0 ? true : false

3. next_available_slot決定
   available_intervals.length > 0 ? 
     min(interval.start for interval in available_intervals) : null
```

### タイムゾーン処理

```
- DB取得: UTC範囲で取得
- ロジック処理: JST基準で計算
- target_date_jst: JST基準の日付
- range_start_utc: target_date_jst 00:00:00 JST → UTC変換
- range_end_utc: target_date_jst 23:59:59 JST → UTC変換
```

## 絶対ルール（Do / Don't）

### ✅ Do（必須事項）

1. **SoT参照の徹底**
   - Guest/Search/Shop系では必ず `therapist_availability._calculate_available_slots()` を使用
   - today_available/next_available_slotは上記関数の結果のみから算出

2. **タイムゾーン処理の統一**
   - 日付境界判定はJST基準
   - DB取得はUTC範囲指定
   - ロジック内部はJST扱い

3. **有効予約の正確な判定**
   ```python
   ACTIVE_RESERVATION_STATUSES = ('pending', 'confirmed', 'reserved')
   
   def _is_active_reservation(reservation, now):
       if reservation.status in ('pending', 'confirmed'):
           return True
       if reservation.status == 'reserved':
           return reservation.reserved_until > now
       return False
   ```

4. **N+1問題の回避**
   - 必ず3クエリでバッチ処理
   - therapist_ids集合に対して一括取得

### ❌ Don't（禁止事項）

1. **slots_json参照の禁止**
   ```python
   # ❌ 禁止
   availability = Availability.objects.get(therapist_id=id)
   return availability.slots_json
   
   # ❌ 禁止  
   if availability.today_available:  # キャッシュ値参照
   
   # ❌ 禁止
   next_slot = availability.next_available_slot  # キャッシュ値参照
   ```

2. **推測・補完ロジックの禁止**
   ```python
   # ❌ 禁止: 表示用の推測
   if cache_is_stale:
       return guess_availability()
   
   # ❌ 禁止: キャッシュ優先
   return cache_value or calculate_from_sot()
   
   # ❌ 禁止: 暗黙的補完
   return availability or "空きなし"  # 推測表示
   ```

3. **独自計算ロジックの禁止**
   ```python
   # ❌ 禁止: 独自のavailability計算
   def my_calculate_availability():
       # 独自実装は禁止
   
   # ❌ 禁止: 部分的な計算
   def quick_today_check():
       # 簡易計算も禁止、必ず_calculate_available_slotsを使用
   ```

4. **タイムゾーン推測の禁止**
   ```python
   # ❌ 禁止: タイムゾーン推測
   local_time = utc_time + timedelta(hours=9)  # JST決め打ち
   
   # ❌ 禁止: 暗黙的な日付境界
   if datetime.now().hour < 6:  # 何のタイムゾーンか不明
   ```

## specs/availability/core.yaml 追記内容

```yaml
# Availability Single Source of Truth Definition
sot_definition:
  version: "1.0"
  last_updated: "2025-01-01"
  
  primary_sources:
    - name: "TherapistShift"
      table: "therapist_shifts"
      key_fields: ["therapist_id", "date", "start_at", "end_at"]
      filters: ["availability_status = 'available'"]
      special_handling:
        - "break_slots: JSON field processed by _parse_breaks()"
    
    - name: "GuestReservation"  
      table: "guest_reservations"
      key_fields: ["therapist_id", "start_at", "end_at"]
      filters: ["status IN ('pending', 'confirmed', 'reserved')"]
      special_handling:
        - "reserved: check reserved_until > now"
        - "buffer_minutes: applied before/after reservation"

  derived_caches:
    - name: "Availability.slots_json"
      table: "availability"
      purpose: "管理画面・同期用途のみ"
      write_sources: ["availability_sync.py", "admin系"]
      read_restrictions: "admin画面のみ（キャッシュ時点明示）"

calculation_rules:
  core_function: "therapist_availability._calculate_available_slots()"
  query_limit: 3  # N+1禁止
  timezone_basis: "JST"
  
  today_available:
    definition: "len(available_intervals) > 0"
    source: "_calculate_available_slots() result"
    
  next_available_slot:
    definition: "min(interval.start) if available_intervals else null"
    source: "_calculate_available_slots() result"

reference_rules:
  guest_facing:
    allowed_sources: ["TherapistShift", "GuestReservation"]
    forbidden_sources: ["slots_json"]
    required_function: "therapist_availability._calculate_available_slots()"
    
  admin_facing:
    allowed_sources: ["slots_json"]
    display_requirements:
      - "data_source_label: 'キャッシュ'"
      - "last_updated_timestamp: required"
      - "staleness_warning: if > 1 hour"

prohibited_patterns:
  - name: "slots_json_in_guest_code"
    pattern: "availability\\.slots_json"
    scope: ["app/domains/site", "app/domains/guest"]
    enforcement: "CI/CD automatic detection"
    
  - name: "availability_guessing"
    examples: 
      - "guess_availability()"
      - "cache_value or fallback"
      - "if cache_is_stale: estimate()"
    enforcement: "Code review mandatory rejection"
    
  - name: "timezone_assumption"
    examples:
      - "utc_time + timedelta(hours=9)"
      - "datetime.now().date()"  # without timezone
    enforcement: "Linting rules"

compliance_monitoring:
  automated_checks:
    - "grep -r 'slots_json' app/domains/site/ app/domains/guest/"
    - "pytest tests/test_sot_compliance.py"
  
  manual_reviews:
    - "All availability-related PRs require SoT compliance review"
    - "Monthly audit of availability calculation paths"
```

## 将来の開発者向け「よくある間違い」

### 間違い1: 「パフォーマンスのためにキャッシュを見る」

```python
# ❌ よくある間違い
def get_today_available_fast(therapist_id):
    # 「高速化のため」キャッシュを見る
    cache = Availability.objects.get(therapist_id=therapist_id)
    return cache.today_available  # 禁止

# ✅ 正しい実装
def get_today_available(therapist_id):
    # 必ずSoTから計算
    return calculate_from_sot(therapist_id)
```

**理由**: Guest向け機能では正確性がパフォーマンスより優先。キャッシュは管理画面のみ。

### 間違い2: 「簡単な判定だから独自実装」

```python
# ❌ よくある間違い
def quick_availability_check(therapist_id):
    # 「簡単だから」独自で計算
    shifts = TherapistShift.objects.filter(therapist_id=therapist_id)
    return len(shifts) > 0  # 禁止

# ✅ 正しい実装  
def availability_check(therapist_id):
    # 必ず_calculate_available_slotsを使用
    intervals = _calculate_available_slots(shifts, reservations, buffer)
    return len(intervals) > 0
```

**理由**: break_slots、buffer_minutes、予約状況など複雑な計算が必要。独自実装は必ず漏れが発生。

### 間違い3: 「管理画面だからSoTを使う」

```python
# ❌ よくある間違い
def admin_availability_view(therapist_id):
    # 管理画面でもSoTを使ってしまう
    return calculate_from_sot(therapist_id)  # 不要な負荷

# ✅ 正しい実装
def admin_availability_view(therapist_id):
    # 管理画面はキャッシュ使用（時点明示）
    cache = Availability.objects.get(therapist_id=therapist_id)
    return {
        'data': cache.slots_json,
        'source': 'キャッシュ',
        'updated_at': cache.updated_at
    }
```

**理由**: 管理画面はパフォーマンス重視。ただしキャッシュであることを明示する。

### 間違い4: 「タイムゾーンは自動で合う」

```python
# ❌ よくある間違い
def get_today_slots(therapist_id):
    today = datetime.now().date()  # ローカルタイムゾーン依存
    return get_slots_for_date(therapist_id, today)

# ✅ 正しい実装
def get_today_slots(therapist_id):
    today_jst = now_jst().date()  # JST明示
    return get_slots_for_date(therapist_id, today_jst)
```

**理由**: サーバーのタイムゾーンに依存すると、UTC環境で日付がずれる。

### 間違い5: 「予約状況は単純にstatusで判定」

```python
# ❌ よくある間違い
def is_reserved(reservation):
    return reservation.status == 'reserved'  # reserved_until無視

# ✅ 正しい実装
def is_reserved(reservation, now):
    if reservation.status in ('pending', 'confirmed'):
        return True
    if reservation.status == 'reserved':
        return reservation.reserved_until > now  # 期限チェック必須
    return False
```

**理由**: `reserved`状態は`reserved_until`が未来の場合のみ有効。過去なら無効予約。

## 実装時のチェックリスト

### 新機能開発時

- [ ] Guest/Search/Shop系でslots_json参照していないか？
- [ ] `_calculate_available_slots()`を使用しているか？
- [ ] 3クエリでN+1を回避しているか？
- [ ] JST基準でタイムゾーン処理しているか？
- [ ] ACTIVE_RESERVATION_STATUSESを正しく判定しているか？

### コードレビュー時

- [ ] `availability.slots_json`の参照がないか？
- [ ] 独自のavailability計算ロジックがないか？
- [ ] タイムゾーン推測・決め打ちがないか？
- [ ] キャッシュ優先ロジックがないか？
- [ ] 管理画面でキャッシュ時点を明示しているか？

### テスト時

- [ ] SoT計算結果の正確性テスト
- [ ] JST境界条件（23:59→00:00）テスト
- [ ] 予約状況の複雑パターンテスト
- [ ] N+1問題のないことを確認
- [ ] パフォーマンス劣化のないことを確認

## まとめ

この仕様書により、以下が明確になった：

1. **なぜslots_jsonを見てはいけないか**: Guest向けはリアルタイム正確性が必要、キャッシュは管理用途のみ
2. **today_available/next_available_slotをどこから計算するか**: `therapist_availability._calculate_available_slots()`が唯一の根拠
3. **どこに手を入れてはいけないか**: Guest/Search/Shop系でのslots_json参照、独自計算ロジック、タイムゾーン推測

この仕様は最終決定版であり、将来の開発者はこの仕様に従って実装することで、一貫性のある正確なavailabilityシステムを維持できる。