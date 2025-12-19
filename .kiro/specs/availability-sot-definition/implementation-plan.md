# SoT仕様実装計画（Autopilot）

## 🔒 絶対ルール確認
- SoT: TherapistShift + GuestReservation のみ
- Availability(slots_json): 派生キャッシュ
- Guest向け機能でのslots_json参照禁止
- 表示用推測・暗黙的補完・キャッシュ優先ロジック禁止
- 優先順位: TherapistShift + GuestReservation > Availability(slots_json)

## Phase 1: 違反箇所特定

### 違反箇所一覧

| ファイル | 行番号 | 違反内容 | 仕様条文 |
|---------|--------|----------|----------|
| `osakamenesu/services/api/app/domains/site/services/shop/search_service.py` | 555-565 | Guest向けtoday_availableフィルタでslots_json参照 | 1.2項「❌参照禁止ユースケース」 |
| `osakamenesu/services/api/app/domains/site/services/shop/availability.py` | 153-167 | Guest向けnext_available_slot導出でslots_json参照 | 1.2項「❌参照禁止ユースケース」 |

### 仕様条文 → コード影響マッピング表

| 仕様条文 | 違反コード | 影響範囲 | 修正必要性 |
|----------|------------|----------|------------|
| **1.2項 ❌参照禁止「Guest向けリアルタイム空き状況表示」** | `search_service.py:555` `select(models.Availability.slots_json)` | shop search API | 🔴 必須修正 |
| **1.2項 ❌参照禁止「次回空き時間の正確な表示」** | `availability.py:153` `models.Availability.slots_json` | shop detail API | 🔴 必須修正 |
| **2項 各API・機能の参照元「Shop search (today_available)」** | `search_service.py` 全体 | 検索結果フィルタリング | 🔴 SoT移行必須 |
| **2項 各API・機能の参照元「Shop detail (next_available_slot)」** | `availability.py` 全体 | 詳細画面表示 | 🔴 SoT移行必須 |

### 具体的違反理由

#### search_service.py:555-565
```python
# 🔴 違反: Guest向け機能でslots_json参照
stmt = (
    select(models.Availability.profile_id, models.Availability.slots_json)  # ← 違反
    .where(models.Availability.profile_id.in_(shop_ids))
    .where(models.Availability.date == target_date)
)
```
**違反理由**: 仕様1.2項「❌参照禁止ユースケース - Guest向けリアルタイム空き状況表示」に該当

#### availability.py:153-167
```python
# 🔴 違反: Guest向けnext_available_slot導出でslots_json参照
select(
    models.Availability.profile_id,
    models.Availability.slots_json,  # ← 違反
    models.Availability.date,
)
```
**違反理由**: 仕様1.2項「❌参照禁止ユースケース - 次回空き時間の正確な表示」に該当

## Phase 2: SoT移行実装方針

### 2.1 today_available移行

#### 現在の実装（違反）
```python
# search_service.py - 🔴 違反実装
async def _filter_shops_with_today_availability(
    db: AsyncSession, shops: List[ShopSummary], target_date: date
) -> List[ShopSummary]:
    stmt = (
        select(models.Availability.profile_id, models.Availability.slots_json)  # 違反
        .where(models.Availability.profile_id.in_(shop_ids))
        .where(models.Availability.date == target_date)
    )
```

#### 修正実装（SoT準拠）
```python
# search_service.py - ✅ SoT準拠実装
# 仕様根拠: 2項「Shop search (today_available) → TherapistShift + GuestReservation」
async def _filter_shops_with_today_availability(
    db: AsyncSession, shops: List[ShopSummary], target_date: date
) -> List[ShopSummary]:
    from app.domains.guest.services.availability_service import calculate_availability_from_sot
    
    shop_ids = [shop.id for shop in shops]
    eligible: Set[UUID] = set()
    
    # SoT直接参照による正確な計算
    for shop_id in shop_ids:
        availability = await calculate_availability_from_sot(
            db=db,
            therapist_id=shop_id,  # shop_id = therapist_id in this context
            target_date=target_date
        )
        if availability and any(slot.status in {"open", None} for slot in availability):
            eligible.add(shop_id)
    
    return [shop for shop in shops if shop.id in eligible]
```

### 2.2 next_available_slot移行

#### 現在の実装（違反）
```python
# availability.py - 🔴 違反実装
for profile_id, slots_json, _slot_date in rows:  # 違反
    slots = convert_slots(slots_json)  # 違反
```

#### 修正実装（SoT準拠）
```python
# availability.py - ✅ SoT準拠実装
# 仕様根拠: 2項「Shop detail (next_available_slot) → TherapistShift + GuestReservation」
async def get_next_available_slots(
    db: AsyncSession,
    shop_ids: List[UUID],
    staff_ids: List[UUID],
    lookahead_days: int = 14,
) -> tuple[dict[UUID, NextAvailableSlot], dict[UUID, NextAvailableSlot]]:
    from app.domains.guest.services.availability_service import calculate_availability_from_sot
    
    today = now_jst().date()
    end_date = today + timedelta(days=lookahead_days)
    
    shop_map: dict[UUID, NextAvailableSlot] = {}
    staff_map: dict[UUID, NextAvailableSlot] = {}
    
    # SoT直接参照による正確な計算
    all_ids = set(shop_ids) | set(staff_ids)
    for profile_id in all_ids:
        current_date = today
        while current_date <= end_date:
            availability = await calculate_availability_from_sot(
                db=db,
                therapist_id=profile_id,
                target_date=current_date
            )
            
            if availability:
                for slot in availability:
                    if slot.status in {"open", None}:
                        candidate = _build_next_slot_candidate(slot, now_jst_value=now_jst())
                        if candidate:
                            comparable, payload = candidate
                            
                            # Shop mapping
                            if profile_id in shop_ids:
                                existing = shop_map.get(profile_id)
                                if existing is None or comparable < existing.start_at:
                                    shop_map[profile_id] = payload
                            
                            # Staff mapping
                            if slot.staff_id and slot.staff_id in staff_ids:
                                existing = staff_map.get(slot.staff_id)
                                if existing is None or comparable < existing.start_at:
                                    staff_map[slot.staff_id] = payload
                            break
            
            current_date += timedelta(days=1)
    
    return shop_map, staff_map
```

### 2.3 パフォーマンス最適化

#### クエリ設計
```python
# 仕様根拠: 5.2項「パフォーマンス指標 - Guest availability API レスポンス時間: 現状維持」

# バッチクエリでN+1問題回避
async def batch_calculate_availability_from_sot(
    db: AsyncSession,
    therapist_ids: List[UUID],
    target_date: date
) -> Dict[UUID, List[AvailabilitySlot]]:
    # TherapistShift一括取得
    shift_stmt = (
        select(models.TherapistShift)
        .where(models.TherapistShift.therapist_id.in_(therapist_ids))
        .where(models.TherapistShift.date == target_date)
        .options(selectinload(models.TherapistShift.therapist))
    )
    
    # GuestReservation一括取得
    reservation_stmt = (
        select(models.GuestReservation)
        .where(models.GuestReservation.therapist_id.in_(therapist_ids))
        .where(func.date(models.GuestReservation.start_time) == target_date)
    )
    
    shifts = (await db.execute(shift_stmt)).scalars().all()
    reservations = (await db.execute(reservation_stmt)).scalars().all()
    
    # メモリ内で効率的に計算
    return _calculate_availability_batch(shifts, reservations, target_date)
```

#### インデックス要件
```sql
-- 仕様根拠: パフォーマンス劣化防止
-- TherapistShift用インデックス
CREATE INDEX CONCURRENTLY idx_therapist_shift_therapist_date 
ON therapist_shift (therapist_id, date);

-- GuestReservation用インデックス
CREATE INDEX CONCURRENTLY idx_guest_reservation_therapist_start 
ON guest_reservation (therapist_id, start_time);
```

## Phase 3: slots_json管理画面専用化

### 3.1 Read-Only制約実装

```python
# models.py - ✅ 仕様3.2項「Read-Only制約」準拠
class Availability(models.Model):
    # 仕様根拠: 3.2項「slots_jsonへの直接書き込みを禁止」
    def save(self, *args, **kwargs):
        if self.pk and 'slots_json' in kwargs.get('update_fields', []):
            raise ValueError(
                "slots_json is read-only. Use sync_from_sot() instead. "
                "Specification: 3.2 Read-Only制約"
            )
        super().save(*args, **kwargs)
    
    @classmethod
    async def sync_from_sot(cls, db: AsyncSession, therapist_id: UUID):
        """
        仕様根拠: 3.2項「SoTからslots_jsonを再生成する唯一の方法」
        """
        from app.domains.guest.services.availability_service import calculate_availability_from_sot
        
        today = now_jst().date()
        availability_data = await calculate_availability_from_sot(
            db=db, therapist_id=therapist_id, target_date=today
        )
        
        slots_json = [
            {
                "start_at": slot.start_at.isoformat(),
                "end_at": slot.end_at.isoformat(),
                "status": slot.status,
                "staff_id": str(slot.staff_id) if slot.staff_id else None,
            }
            for slot in availability_data
        ] if availability_data else []
        
        await db.execute(
            update(cls)
            .where(cls.therapist_id == therapist_id)
            .where(cls.date == today)
            .values(
                slots_json=slots_json,
                updated_at=now_jst(),
                sync_source="sot"  # 同期元明示
            )
        )
```

### 3.2 管理画面でのキャッシュ時点明示

```python
# admin/views.py - ✅ 仕様3.2項「display_data_source: true」準拠
async def admin_availability_view(request):
    availability = await get_availability_cache(therapist_id)
    
    # 仕様根拠: 3.2項「キャッシュ要件 - display_last_updated: true」
    context = {
        "availability_data": availability.slots_json,
        "data_source": "キャッシュ",  # 必須表示
        "last_updated": availability.updated_at,  # 必須表示
        "sync_source": availability.sync_source,
        "cache_staleness_warning": (
            now_jst() - availability.updated_at
        ).total_seconds() > 3600  # 1時間以上古い場合警告
    }
    
    return render(request, "admin/availability.html", context)
```

```html
<!-- admin/availability.html - キャッシュ時点明示 -->
<!-- 仕様根拠: 3.2項「管理画面でのキャッシュ時点明示実装方針」 -->
<div class="availability-header">
    <h2>空き状況管理</h2>
    <div class="data-source-info">
        <span class="badge badge-info">{{ data_source }}</span>
        <span class="last-updated">最終更新: {{ last_updated|date:"Y-m-d H:i:s" }}</span>
        {% if cache_staleness_warning %}
            <span class="badge badge-warning">データが古い可能性があります</span>
        {% endif %}
    </div>
</div>
```

## 安全な修正ステップ（PR単位）

### PR #1: 監視・検証基盤構築
- [ ] SoT ↔ Cache差分検出機能実装
- [ ] 違反箇所特定のためのlinter追加
- [ ] テスト環境でのSoT参照パフォーマンス測定

### PR #2: search_service.py移行
- [ ] `_filter_shops_with_today_availability`をSoT参照に変更
- [ ] バッチクエリ最適化実装
- [ ] A/Bテスト用フィーチャーフラグ追加
- [ ] パフォーマンステスト実行

### PR #3: availability.py移行
- [ ] `get_next_available_slots`をSoT参照に変更
- [ ] インデックス追加（マイグレーション）
- [ ] 既存APIインターフェース保持確認

### PR #4: slots_json制約追加
- [ ] `Availability.save()`にread-only制約追加
- [ ] `sync_from_sot()`メソッド実装
- [ ] 管理画面でのキャッシュ時点明示

### PR #5: 監視・アラート実装
- [ ] sync失敗アラート設定
- [ ] SoT参照パフォーマンス監視
- [ ] 定期バッチでのキャッシュ再生成

## テスト観点

### SoT整合性テスト
```python
# 仕様根拠: 7.1項「正確性指標 - SoT↔実際の表示内容の一致率: 100%」
async def test_sot_cache_consistency():
    """SoTとキャッシュの整合性を検証"""
    therapist_id = create_test_therapist()
    
    # SoTから直接計算
    sot_availability = await calculate_availability_from_sot(
        db, therapist_id, date.today()
    )
    
    # キャッシュ同期実行
    await Availability.sync_from_sot(db, therapist_id)
    cache_availability = await get_availability_cache(therapist_id)
    
    # 完全一致を検証
    assert sot_availability == parse_cache_slots(cache_availability.slots_json)
```

### 境界条件テスト
```python
# 仕様根拠: 4.2項「JST基準の統一」
async def test_jst_boundary_conditions():
    """JST境界条件での正確性を検証"""
    # JST 23:59 → 00:00 境界
    jst_2359 = datetime(2025, 1, 1, 23, 59, tzinfo=JST)
    jst_0000 = datetime(2025, 1, 2, 0, 0, tzinfo=JST)
    
    with freeze_time(jst_2359):
        today_slots_before = await calculate_availability_from_sot(
            db, therapist_id, date(2025, 1, 1)
        )
    
    with freeze_time(jst_0000):
        today_slots_after = await calculate_availability_from_sot(
            db, therapist_id, date(2025, 1, 2)
        )
    
    # 日付境界で正しく切り替わることを検証
    assert today_slots_before != today_slots_after
```

### タイムゾーンテスト
```python
# 仕様根拠: 4.2項「タイムゾーン・日付境界・丸め処理のルール」
async def test_timezone_consistency():
    """タイムゾーン処理の一貫性を検証"""
    # UTC環境でのテスト
    utc_time = datetime(2025, 1, 1, 15, 0, tzinfo=timezone.utc)  # JST 00:00
    
    with freeze_time(utc_time):
        availability = await calculate_availability_from_sot(
            db, therapist_id, date(2025, 1, 2)  # JST基準の翌日
        )
    
    # JST基準で正しい日付の空き状況が取得されることを検証
    assert all(
        slot.start_at.astimezone(JST).date() == date(2025, 1, 2)
        for slot in availability
    )
```

## やらないこと（誤実装防止）

### ❌ 禁止事項
1. **新しい仕様提案**: 既存仕様に厳密に従う
2. **キャッシュ優先ロジック**: SoTが常に優先
3. **推測・補完ロジック**: 不明な場合はエラーとする
4. **段階的キャッシュ参照**: Guest向けは即座にSoT移行
5. **パフォーマンス理由でのslots_json参照**: 最適化はSoT側で実施

### ✅ 必須実装
1. **仕様根拠コメント**: 全ての変更に仕様条文番号を明記
2. **エラーハンドリング**: SoT参照失敗時の明確なエラー
3. **監視・アラート**: 整合性違反の即座な検出
4. **テスト網羅**: SoT整合性・境界条件・タイムゾーン
5. **段階的移行**: 既存システムを壊さない安全な移行

## 仕様不足として明示する点

以下の点について仕様が不明確なため、実装前に確認が必要：

1. **SoT計算の具体的アルゴリズム**: TherapistShift + GuestReservationからの空き状況計算ロジック
2. **パフォーマンスSLA**: 「現状維持」の具体的な数値目標
3. **エラー時のフォールバック**: SoT参照失敗時の動作
4. **キャッシュ同期頻度**: 「5分以内」の具体的なトリガー条件

これらの点は仕様策定者に確認後、厳密に実装する。