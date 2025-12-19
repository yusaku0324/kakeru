# SoT仕様実装 - PR分割計画（確定版）

## 🔒 修正対象の確定（Issue #201準拠）

### 違反箇所（正確）
- **backend**: `search_service.py:555-563`（today_available）
- **backend**: `shop/availability.py:105,153,166`（next_available_slot）

### 仕様根拠
- **sot-specification.md 1.2項**: ❌参照禁止「Guest向けリアルタイム空き状況表示」
- **sot-specification.md 2項**: 各API・機能の参照元でSoT移行必須

## 具体的置き換え仕様

### 1) today_available の置き換え仕様

#### 現在の違反実装
```python
# search_service.py:555-563 - 🔴 違反
stmt = (
    select(models.Availability.profile_id, models.Availability.slots_json)  # 違反
    .where(models.Availability.profile_id.in_(shop_ids))
    .where(models.Availability.date == target_date)
)
```

#### SoT準拠実装（疑似SQL）
```sql
-- 仕様根拠: sot-specification.md 2項「Shop search → TherapistShift + GuestReservation」
-- N+1禁止: shop/profileの集合に対して1〜2クエリで判定

-- Query 1: TherapistShift取得（今日の空き枠）
SELECT DISTINCT ts.therapist_id
FROM therapist_shifts ts
WHERE ts.therapist_id IN (:shop_ids)
  AND ts.date = :target_date_jst
  AND ts.availability_status = 'available'
  AND ts.start_at > :now_jst;

-- Query 2: GuestReservation取得（予約済み時間）
SELECT gr.therapist_id, gr.start_at, gr.end_at
FROM guest_reservations gr
WHERE gr.therapist_id IN (:shop_ids)
  AND DATE(gr.start_at AT TIME ZONE 'Asia/Tokyo') = :target_date_jst
  AND gr.status IN ('pending', 'confirmed', 'reserved');
```

#### 必要なindex
```sql
-- 仕様根拠: sot-specification.md 5.2項「パフォーマンス劣化防止」
CREATE INDEX CONCURRENTLY idx_therapist_shift_therapist_date_status 
ON therapist_shifts (therapist_id, date, availability_status);

CREATE INDEX CONCURRENTLY idx_guest_reservation_therapist_date_status 
ON guest_reservations (therapist_id, date(start_at AT TIME ZONE 'Asia/Tokyo'), status);
```

### 2) next_available_slot の置き換え仕様

#### 既存guest availability APIとの共通化
```python
# 仕様根拠: sot-specification.md「既存guest availability APIとロジック重複させない」
# 既存: app.domains.site.services.shop.search_service._derive_next_availability_from_slots_sot
# → この関数を共通サービスに移動して再利用

# 共通サービス化
from app.domains.site.services.availability_sot_service import calculate_next_available_batch

async def get_next_available_slots_from_sot(
    db: AsyncSession,
    therapist_ids: List[UUID],
    lookahead_days: int = 14
) -> Dict[UUID, NextAvailableSlot | None]:
    """
    仕様根拠: sot-specification.md 2項「Shop detail → TherapistShift + GuestReservation」
    profile_id集合→最短空き時刻を返すバッチ計算
    """
    return await calculate_next_available_batch(
        db=db,
        therapist_ids=therapist_ids,
        lookahead_days=lookahead_days
    )
```

#### タイムゾーン(JST)・日付境界の扱い
```python
# 仕様根拠: sot-specification.md 4.2項「JST基準の統一」
from app.utils.datetime import JST, now_jst

def get_today_jst() -> date:
    """JST基準の今日を取得"""
    return now_jst().date()

def jst_date_range(target_date: date) -> tuple[datetime, datetime]:
    """JST基準の日付境界を取得"""
    start = datetime.combine(target_date, time.min).replace(tzinfo=JST)
    end = datetime.combine(target_date, time.max).replace(tzinfo=JST)
    return start, end
```

### 3) slots_json の管理用途固定化

#### Guest向けコードパスでの参照禁止（機械的ガード）
```python
# 仕様根拠: sot-specification.md 3.2項「Read-Only制約」

# models.py - slots_json参照禁止
class Availability(Base):
    @property
    def slots_json(self):
        """
        slots_jsonへの直接アクセスを制限
        管理画面以外からの参照を禁止
        """
        import inspect
        frame = inspect.currentframe()
        try:
            # 呼び出し元のモジュールパスをチェック
            caller_module = frame.f_back.f_globals.get('__name__', '')
            if not caller_module.startswith('app.domains.admin'):
                raise ValueError(
                    f"slots_json access forbidden from {caller_module}. "
                    f"Use SoT (TherapistShift + GuestReservation) instead. "
                    f"Specification: sot-specification.md 1.2項"
                )
        finally:
            del frame
        return self._slots_json

# lint/grepテスト
def test_no_slots_json_in_guest_code():
    """Guest向けコードでslots_json参照がないことを確認"""
    import os
    import re
    
    guest_dirs = ['app/domains/site', 'app/domains/guest']
    for guest_dir in guest_dirs:
        for root, dirs, files in os.walk(guest_dir):
            for file in files:
                if file.endswith('.py'):
                    with open(os.path.join(root, file)) as f:
                        content = f.read()
                        if re.search(r'\.slots_json', content):
                            raise AssertionError(
                                f"slots_json reference found in guest code: {file}"
                            )
```

## PR分割（確定版）

### PR #1: 参照禁止の機械的ガード

#### 変更概要
Guest向けコードでslots_json参照を機械的に禁止し、違反を自動検出する仕組みを構築

#### 変更ファイル
- `app/models.py` - Availability.slots_jsonプロパティに参照制限追加
- `tests/test_sot_compliance.py` - slots_json参照禁止テスト追加
- `.github/workflows/sot-compliance.yml` - CI/CDでの自動チェック
- `pyproject.toml` - lintルール追加

#### 疑似コード
```python
# models.py
class Availability(Base):
    @property
    def slots_json(self):
        # 仕様根拠: sot-specification.md 3.2項
        caller_module = inspect.currentframe().f_back.f_globals.get('__name__', '')
        if not caller_module.startswith('app.domains.admin'):
            raise ValueError("slots_json access forbidden. Use SoT instead.")
        return self._slots_json

# tests/test_sot_compliance.py
def test_no_slots_json_in_guest_paths():
    """Guest向けパスでslots_json参照がないことを確認"""
    violations = grep_slots_json_in_guest_code()
    assert len(violations) == 0, f"SoT violations found: {violations}"
```

#### テスト項目
- [ ] Guest向けコードでslots_json参照時にValueError発生
- [ ] Admin向けコードでslots_json参照が正常動作
- [ ] CI/CDでslots_json参照違反を自動検出
- [ ] 既存のadmin機能が正常動作（回帰テスト）

#### リスクとロールバック
- **リスク**: 既存のadmin機能でslots_json参照が失敗する可能性
- **ロールバック**: プロパティ制限を削除、元のフィールドアクセスに戻す
- **検証**: admin画面での空き状況表示が正常動作することを確認

### PR #2: search_service.py today_available SoT化

#### 変更概要
検索APIのtoday_availableフィルタをslots_json参照からSoT（TherapistShift + GuestReservation）参照に変更

#### 変更ファイル
- `app/domains/site/services/shop/search_service.py` - `_filter_shops_with_today_availability`修正
- `app/domains/site/services/availability_sot_service.py` - 共通SoT計算サービス新規作成
- `migrations/add_sot_indexes.py` - パフォーマンス用インデックス追加
- `tests/test_search_service_sot.py` - SoT移行テスト追加

#### 疑似コード
```python
# search_service.py
async def _filter_shops_with_today_availability(
    db: AsyncSession, shops: List[ShopSummary], target_date: date
) -> List[ShopSummary]:
    # 仕様根拠: sot-specification.md 2項
    from app.domains.site.services.availability_sot_service import batch_calculate_today_available
    
    shop_ids = [shop.id for shop in shops]
    today_available_map = await batch_calculate_today_available(
        db=db, therapist_ids=shop_ids, target_date=target_date
    )
    
    return [shop for shop in shops if today_available_map.get(shop.id, False)]

# availability_sot_service.py
async def batch_calculate_today_available(
    db: AsyncSession, therapist_ids: List[UUID], target_date: date
) -> Dict[UUID, bool]:
    # SoT: TherapistShift + GuestReservation から計算
    # N+1禁止: 1〜2クエリで全therapist_idsを処理
    pass
```

#### テスト項目
- [ ] SoT計算結果とslots_json結果の一致性確認
- [ ] JST境界条件（23:59→00:00）での正確性
- [ ] パフォーマンス: 現状維持（レスポンス時間測定）
- [ ] N+1問題なし（SQLクエリ数確認）
- [ ] 検索API既存インターフェース保持

#### リスクとロールバック
- **リスク**: パフォーマンス劣化、計算結果の不一致
- **ロールバック**: `_filter_shops_with_today_availability`を元のslots_json参照に戻す
- **検証**: A/Bテストでslots_json版とSoT版の結果一致を確認

### PR #3: shop/availability.py next_available_slot SoT化

#### 変更概要
shop詳細のnext_available_slot導出をslots_json参照からSoT参照に変更し、既存guest availability APIと共通化

#### 変更ファイル
- `app/domains/site/services/shop/availability.py` - `get_next_available_slots`修正
- `app/domains/site/services/availability_sot_service.py` - 共通サービス拡張
- `app/domains/site/services/shop/search_service.py` - 共通サービス利用に変更
- `tests/test_availability_sot_integration.py` - 統合テスト追加

#### 疑似コード
```python
# shop/availability.py
async def get_next_available_slots(
    db: AsyncSession,
    shop_ids: List[UUID],
    staff_ids: List[UUID],
    lookahead_days: int = 14,
) -> tuple[dict[UUID, NextAvailableSlot], dict[UUID, NextAvailableSlot]]:
    # 仕様根拠: sot-specification.md 2項「既存guest availability APIとロジック重複させない」
    from app.domains.site.services.availability_sot_service import calculate_next_available_batch
    
    all_ids = list(set(shop_ids) | set(staff_ids))
    next_available_map = await calculate_next_available_batch(
        db=db, therapist_ids=all_ids, lookahead_days=lookahead_days
    )
    
    shop_map = {id: slot for id, slot in next_available_map.items() if id in shop_ids}
    staff_map = {id: slot for id, slot in next_available_map.items() if id in staff_ids}
    
    return shop_map, staff_map
```

#### テスト項目
- [ ] next_available_slot計算結果の正確性
- [ ] 既存guest availability APIとの結果一致
- [ ] JST基準での日付境界処理
- [ ] lookahead_days範囲での正確な検索
- [ ] shop/staff両方での正常動作

#### リスクとロールバック
- **リスク**: next_available_slot計算ロジックの不一致
- **ロールバック**: `get_next_available_slots`を元のslots_json参照に戻す
- **検証**: shop詳細画面でのnext_available_slot表示が正確であることを確認

### PR #4: docs/specs更新

#### 変更概要
仕様書とドキュメントを更新し、SoT移行完了を明文化

#### 変更ファイル
- `specs/availability/core.yaml` - SoT定義追加
- `docs/architecture/sot-specification.md` - 仕様書リンク追加
- `README.md` - SoT原則の説明追加
- `CHANGELOG.md` - 変更履歴記録

#### 疑似コード
```yaml
# specs/availability/core.yaml
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
```

#### テスト項目
- [ ] 仕様書の内容が実装と一致
- [ ] リンク切れなし
- [ ] ドキュメント生成が正常動作
- [ ] チーム内での仕様理解度確認

#### リスクとロールバック
- **リスク**: ドキュメントの不整合
- **ロールバック**: ドキュメント変更を元に戻す
- **検証**: 仕様書レビューでの承認取得

## 全体的なテスト戦略

### 境界条件テスト
```python
# 仕様根拠: sot-specification.md 4.2項「JST基準の統一」
def test_jst_boundary_conditions():
    """JST 23:59→00:00境界での正確性テスト"""
    # JST 2025-01-01 23:59
    jst_before_midnight = datetime(2025, 1, 1, 23, 59, tzinfo=JST)
    # JST 2025-01-02 00:00  
    jst_after_midnight = datetime(2025, 1, 2, 0, 0, tzinfo=JST)
    
    with freeze_time(jst_before_midnight):
        today_before = get_today_available_from_sot(therapist_id)
    
    with freeze_time(jst_after_midnight):
        today_after = get_today_available_from_sot(therapist_id)
    
    # 日付境界で正しく切り替わることを検証
    assert today_before != today_after
```

### SoT整合性テスト
```python
# 仕様根拠: sot-specification.md 7.1項「SoT↔実際の表示内容の一致率: 100%」
def test_sot_cache_consistency():
    """SoTとキャッシュの整合性テスト"""
    # SoT計算
    sot_today_available = await calculate_today_available_from_sot(therapist_id)
    sot_next_slot = await calculate_next_available_from_sot(therapist_id)
    
    # キャッシュ同期
    await sync_cache_from_sot(therapist_id)
    cache_data = await get_availability_cache(therapist_id)
    
    # 完全一致を検証
    assert sot_today_available == cache_data.today_available
    assert sot_next_slot == cache_data.next_available_slot
```

## 仕様不足として明示する点

以下の点について仕様が不明確なため、実装前に確認が必要：

1. **TherapistShift.break_slots の扱い**: 休憩時間をどう空き状況計算に反映するか
2. **GuestReservation.status の優先順位**: pending/confirmed/reservedの具体的な扱い
3. **buffer_minutes の適用方法**: 予約間隔の具体的な計算ロジック
4. **パフォーマンスSLA**: 「現状維持」の具体的な数値目標（ms単位）

これらの点は仕様策定者に確認後、厳密に実装する。