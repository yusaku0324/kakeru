# Availability Single Source of Truth (SoT) Specification

## 1. SoT 定義

### 1.1 データソース役割定義

| データソース | 役割 | 性質 | 更新責務 |
|-------------|------|------|----------|
| **TherapistShift** | **Primary SoT** | マスターデータ | セラピスト・管理者による直接更新 |
| **GuestReservation** | **Primary SoT** | マスターデータ | ゲスト・管理者による直接更新 |
| **Availability(slots_json)** | **Derived Cache** | 派生データ | TherapistShift + GuestReservation から自動生成 |

### 1.2 参照ルール

#### ✅ 参照してよいユースケース

**TherapistShift + GuestReservation（Primary SoT）**:
- ✅ Guest availability API（リアルタイム計算）
- ✅ 予約作成・変更・キャンセル処理
- ✅ シフト作成・変更処理
- ✅ リアルタイム空き状況表示
- ✅ 正確性が要求される全ての機能

**Availability(slots_json)（Derived Cache）**:
- ✅ 管理画面での一覧表示（パフォーマンス重視）
- ✅ 検索結果の事前フィルタリング（概算用途）
- ✅ 統計・レポート生成（集計用途）
- ✅ 明示的に「キャッシュデータ」と表示される画面

#### ❌ 参照禁止ユースケース

**Availability(slots_json)を参照禁止**:
- ❌ Guest向けリアルタイム空き状況表示
- ❌ 予約確定処理
- ❌ 「次回空き時間」の正確な表示
- ❌ ユーザーが意思決定に使用する情報の表示
- ❌ SLA・正確性が要求される機能

## 2. 各API・機能の参照元

| 機能 | 現在の参照元 | **新仕様での参照元** | 理由 |
|------|-------------|-------------------|------|
| **Guest availability API** | TherapistShift + GuestReservation | **TherapistShift + GuestReservation** | ✅ 既に正しい（PR #200で修正済み） |
| **Shop search (today_available)** | slots_json | **TherapistShift + GuestReservation** | 🔄 正確性重視のため SoT に移行 |
| **Shop detail (next_available_slot)** | slots_json | **TherapistShift + GuestReservation** | 🔄 ユーザー意思決定に影響するため SoT に移行 |
| **Admin 管理画面** | slots_json | **slots_json (Cache)** | ✅ パフォーマンス重視、「キャッシュ」明示で継続 |
| **統計・レポート** | slots_json | **slots_json (Cache)** | ✅ 集計用途、「概算値」明示で継続 |

### 2.1 移行対象の詳細

#### search_service.py (today_available フィルタ)
```python
# 現在（slots_json参照）
def filter_today_available(shops):
    return [shop for shop in shops if shop.availability.today_available]

# 新仕様（SoT参照）
def filter_today_available(shops):
    return [shop for shop in shops if calculate_today_available_from_sot(shop)]
```

#### shop/availability.py (next_available_slot 導出)
```python
# 現在（slots_json参照）
def get_next_available_slot(therapist_id):
    return Availability.objects.get(therapist_id=therapist_id).next_available_slot

# 新仕様（SoT参照）
def get_next_available_slot(therapist_id):
    return calculate_next_available_from_sot(therapist_id)
```

## 3. slots_json の扱い

### 3.1 選択：**管理用途キャッシュ限定**

**理由**:
- 完全廃止は管理画面のパフォーマンス劣化を招く
- 統計・レポート機能で集計処理が重くなる
- 段階的移行でリスクを最小化

### 3.2 キャッシュとしての制約

#### Read-Only 制約
```python
class Availability(models.Model):
    # slots_json への直接書き込みを禁止
    def save(self, *args, **kwargs):
        if self.pk and 'slots_json' in kwargs.get('update_fields', []):
            raise ValueError("slots_json is read-only. Use sync_from_sot() instead.")
        super().save(*args, **kwargs)
    
    @classmethod
    def sync_from_sot(cls, therapist_id):
        """SoT から slots_json を再生成する唯一の方法"""
        pass
```

#### Sync 失敗時の扱い

| シナリオ | 許容性 | 対応 |
|----------|--------|------|
| **Guest向け機能** | **非許容** | SoT直接参照のため影響なし |
| **管理画面表示** | **許容** | 「データ同期中」表示、古いキャッシュ継続使用 |
| **統計レポート** | **許容** | 「データ更新日時」明示、注意喚起表示 |

#### 監視・再生成の責務

```python
# 監視対象
- SoT更新からsync完了までの時間（SLA: 5分以内）
- sync失敗率（SLA: 1%未満）
- キャッシュとSoTの差分検出

# 再生成トリガー
1. TherapistShift 更新時（自動）
2. GuestReservation 更新時（自動）
3. 定期バッチ（1時間毎）
4. 手動実行（管理画面から）
```

## 4. 禁止ルール

### 4.1 「表示用の推測」を禁止

#### ❌ 禁止される推測の具体例

```python
# ❌ 禁止：フロントエンドでの推測計算
def guess_today_available(last_sync_time, cached_slots):
    if last_sync_time > datetime.now() - timedelta(hours=1):
        return len(cached_slots) > 0  # 推測による表示
    return None

# ❌ 禁止：不正確な時刻表示
def display_next_available(cached_slot):
    # キャッシュが古い可能性があるのに「次回空き」として表示
    return f"次回 {cached_slot.start_time} 〜"

# ❌ 禁止：タイムゾーン推測
def convert_to_user_timezone(utc_time):
    # ユーザーのタイムゾーンを推測して変換
    return utc_time + timedelta(hours=9)  # JST決め打ち推測
```

#### ✅ 正しいアプローチ

```python
# ✅ 正しい：SoTからの正確な計算
def get_today_available(therapist_id):
    return calculate_availability_from_sot(therapist_id, date.today())

# ✅ 正しい：データソースの明示
def display_availability_with_source(data, source_type):
    if source_type == 'cache':
        return f"空き状況（{data.updated_at}時点）: {data.status}"
    else:
        return f"空き状況（リアルタイム）: {data.status}"

# ✅ 正しい：JST明示的処理
def format_jst_time(utc_time):
    return utc_time.astimezone(timezone(timedelta(hours=9)))
```

### 4.2 タイムゾーン・日付境界・丸め処理のルール

#### JST基準の統一
```python
# 全ての日付計算はJST基準で実行
JST = timezone(timedelta(hours=9))

def get_today_jst():
    return datetime.now(JST).date()

def is_same_day_jst(dt1, dt2):
    return dt1.astimezone(JST).date() == dt2.astimezone(JST).date()
```

#### 日付境界の明確化
```python
# 「今日の空き」は JST 0:00-23:59 で判定
def get_today_slots(therapist_id):
    today_jst = get_today_jst()
    start_time = datetime.combine(today_jst, time.min).replace(tzinfo=JST)
    end_time = datetime.combine(today_jst, time.max).replace(tzinfo=JST)
    return get_slots_in_range(therapist_id, start_time, end_time)
```

#### 時刻丸め処理の統一
```python
# 30分単位での丸め処理を統一
def round_to_30min(dt):
    minutes = dt.minute
    if minutes < 15:
        rounded_minutes = 0
    elif minutes < 45:
        rounded_minutes = 30
    else:
        rounded_minutes = 0
        dt = dt + timedelta(hours=1)
    return dt.replace(minute=rounded_minutes, second=0, microsecond=0)
```

## 5. 移行プラン

### 5.1 短期（今すぐやること）

#### Phase 1: 禁止ルールの明文化（1週間）
- [ ] 本仕様書をチーム共有
- [ ] コードレビューチェックリストに追加
- [ ] 「推測表示」の既存箇所を特定・文書化

#### Phase 2: 監視体制の構築（2週間）
- [ ] SoT ↔ Cache 差分検出の監視実装
- [ ] sync失敗アラートの設定
- [ ] 管理画面に「データソース」表示を追加

### 5.2 中期（search / site の SoT 移行）

#### Phase 3: search_service.py 移行（4週間）
- [ ] `today_available` フィルタをSoT参照に変更
- [ ] パフォーマンステスト実施
- [ ] A/Bテストで正確性向上を検証

#### Phase 4: shop/availability.py 移行（4週間）
- [ ] `next_available_slot` 導出をSoT参照に変更
- [ ] キャッシュウォームアップ機能実装
- [ ] ユーザー体験の改善測定

### 5.3 長期（slots_json の最終的な位置づけ）

#### Phase 5: キャッシュ最適化（8週間）
- [ ] 管理画面専用のキャッシュ戦略実装
- [ ] 統計・レポート用の集計テーブル分離
- [ ] slots_json の段階的縮小

#### Phase 6: アーキテクチャ完成（12週間）
- [ ] SoT参照の完全移行完了
- [ ] キャッシュ層の責務明確化
- [ ] 運用監視の自動化完成

## 6. specs への反映案

### 6.1 specs/availability/core.yaml への追記項目

```yaml
# 追加すべき項目案
sot_definition:
  primary_sources:
    - TherapistShift
    - GuestReservation
  derived_caches:
    - Availability.slots_json
  
reference_rules:
  guest_facing:
    allowed_sources: [TherapistShift, GuestReservation]
    forbidden_sources: [slots_json]
  admin_facing:
    allowed_sources: [slots_json]
    cache_requirements:
      - display_data_source: true
      - display_last_updated: true
      
prohibited_patterns:
  - name: "frontend_availability_calculation"
    description: "フロントエンドでの空き状況推測計算"
    examples: ["guess_today_available()", "estimate_next_slot()"]
  - name: "timezone_assumption"
    description: "タイムゾーンの暗黙的な仮定"
    examples: ["utc_time + 9hours", "local_timezone_guess()"]

migration_phases:
  phase1: "monitoring_and_rules"
  phase2: "search_service_migration" 
  phase3: "availability_service_migration"
  phase4: "cache_optimization"
  phase5: "architecture_completion"
```

### 6.2 既存項目の修正案

```yaml
# 修正すべき既存項目
availability_calculation:
  # 修正前
  source: "flexible"
  
  # 修正後
  source: "TherapistShift + GuestReservation"
  cache_policy: "slots_json for admin only"
  
data_consistency:
  # 追加
  sot_priority: "TherapistShift + GuestReservation > slots_json"
  sync_sla: "5 minutes"
  acceptable_cache_staleness: "admin: 1 hour, guest: 0 seconds"
```

## 7. 成功指標

### 7.1 正確性指標
- SoT ↔ 実際の表示内容の一致率: 100%
- 「推測表示」による不整合報告: 0件/月
- ユーザーからの「空き状況が違う」報告: 50%削減

### 7.2 パフォーマンス指標
- Guest availability API レスポンス時間: 現状維持
- 管理画面表示速度: 現状維持
- SoT計算処理時間: 500ms以内

### 7.3 運用指標
- Cache sync成功率: 99%以上
- 監視アラート対応時間: 5分以内
- 開発者の「どのデータを使うべきか」迷い: 0件

## まとめ

この仕様により：

1. **明確なSoT定義**: TherapistShift + GuestReservation が唯一の真実
2. **段階的移行**: 既存システムを壊さず安全に移行
3. **禁止ルールの明文化**: 推測表示を根絶
4. **運用監視体制**: 不整合を早期検出・修正
5. **将来の迷いを排除**: 「この仕様を読めば迷わない」状態を実現

が達成され、**正確で一貫性のある空き状況表示システム**が構築される。