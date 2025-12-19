# Availability Calendar UI/API Design Document

## 概要

本設計書は、availability calendar UI/APIの詳細設計を定義し、requirements.mdで定められた要件を実現するための具体的な実装方針を示す。SoTに基づく正確な状態管理と、ユーザビリティを両立する設計を採用する。

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  AvailabilityCalendar                                       │
│  ├─ AvailabilityGrid (7日分のカレンダー表示)                  │
│  ├─ AvailabilityCell (個別時間枠セル)                        │
│  ├─ StatusIcon (◎△×アイコン)                               │
│  └─ ReservationForm (予約フォーム)                           │
└─────────────────────────────────────────────────────────────┘
                              │ API Call
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API                              │
├─────────────────────────────────────────────────────────────┤
│  GET /api/guest/therapists/{id}/availability_slots          │
│  ├─ SoT計算: TherapistShift + GuestReservation              │
│  ├─ ステータス決定: open/tentative/blocked                   │
│  └─ JST基準の時間枠生成                                      │
└─────────────────────────────────────────────────────────────┘
                              │ Data Source
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SoT (Single Source of Truth)            │
├─────────────────────────────────────────────────────────────┤
│  TherapistShift (シフト情報)                                 │
│  ├─ availability_status: open/busy/off                      │
│  ├─ break_slots: JSON配列                                   │
│  └─ date, start_at, end_at                                  │
│                                                             │
│  GuestReservation (予約情報)                                │
│  ├─ status: pending/confirmed/reserved                      │
│  ├─ buffer_minutes適用                                       │
│  └─ start_at, end_at                                        │
└─────────────────────────────────────────────────────────────┘
```

## ステータス優先度ルール

### 計算ロジック
```typescript
function calculateSlotStatus(
  shifts: TherapistShift[],
  reservations: GuestReservation[],
  timeSlot: TimeSlot
): AvailabilityStatus {
  // 1. 予約済みまたは休憩時間の場合
  if (hasActiveReservation(reservations, timeSlot) || 
      isBreakTime(shifts, timeSlot)) {
    return "blocked";
  }
  
  // 2. 利用可能なシフトがある場合
  if (hasAvailableShift(shifts, timeSlot)) {
    return "open";
  }
  
  // 3. その他（シフト未登録、営業時間外等）
  return "blocked";
}
```

### 同一時間帯の優先度マトリクス
| シフト1 | シフト2 | 結果 | 理由 |
|---------|---------|------|------|
| blocked | blocked | blocked | 全てblocked |
| blocked | open | blocked | 1つでもblockedなら全体blocked |
| blocked | tentative | blocked | blockedが最優先 |
| open | open | open | 全てopen |
| open | tentative | open | openがtentativeより優先 |
| tentative | tentative | tentative | 全てtentative |

## アイコン・色・UI制約の実装仕様

### CSS クラス定義
```css
/* ベースセルスタイル */
.availability-cell {
  width: 60px;
  height: 40px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  transition: all 0.2s ease;
  position: relative;
}

/* open状態 */
.availability-cell--open {
  background-color: #22c55e;
  color: #ffffff;
  cursor: pointer;
  border-color: #16a34a;
}

.availability-cell--open:hover {
  background-color: #16a34a;
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
}

/* tentative状態 */
.availability-cell--tentative {
  background-color: #fbbf24;
  color: #000000;
  cursor: pointer;
  border-color: #f59e0b;
  animation: pulse 2s infinite;
}

.availability-cell--tentative:hover {
  background-color: #f59e0b;
  transform: scale(1.05);
}

/* blocked状態 */
.availability-cell--blocked {
  background-color: #6b7280;
  color: #9ca3af;
  cursor: not-allowed;
  pointer-events: none;
  opacity: 0.6;
  border-color: #4b5563;
}

/* アイコン定義 */
.availability-icon--open::before { content: "◎"; }
.availability-icon--tentative::before { content: "△"; }
.availability-icon--blocked::before { content: "×"; }

/* アニメーション */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

### React コンポーネント設計

#### AvailabilityCell コンポーネント
```typescript
interface AvailabilityCellProps {
  slot: AvailabilitySlot;
  isSelected: boolean;
  onSelect: (slot: AvailabilitySlot) => void;
  onDeselect: (slot: AvailabilitySlot) => void;
}

const AvailabilityCell: React.FC<AvailabilityCellProps> = ({
  slot,
  isSelected,
  onSelect,
  onDeselect
}) => {
  const handleClick = () => {
    if (slot.status === 'blocked') return; // blocked は操作不可
    
    if (isSelected) {
      onDeselect(slot);
    } else {
      onSelect(slot);
    }
  };

  const getCellClassName = () => {
    const baseClass = 'availability-cell';
    const statusClass = `availability-cell--${slot.status}`;
    const selectedClass = isSelected ? 'availability-cell--selected' : '';
    return `${baseClass} ${statusClass} ${selectedClass}`.trim();
  };

  const getAriaLabel = () => {
    const timeRange = `${formatTime(slot.start_at)}から${formatTime(slot.end_at)}`;
    const statusText = {
      open: '予約可能',
      tentative: '選択中',
      blocked: '予約不可'
    }[slot.status];
    return `${timeRange} ${statusText}`;
  };

  return (
    <button
      className={getCellClassName()}
      onClick={handleClick}
      disabled={slot.status === 'blocked'}
      aria-label={getAriaLabel()}
      role="gridcell"
      tabIndex={slot.status === 'blocked' ? -1 : 0}
    >
      <span className={`availability-icon--${slot.status}`} />
      <span className="sr-only">{getAriaLabel()}</span>
    </button>
  );
};
```

## リアルタイム検証フローの詳細設計

### 検証シーケンス図（文章）
```
1. ユーザーがtentativeセルを選択
   ↓
2. 予約フォームに詳細入力
   ↓
3. 「予約確定」ボタンクリック
   ↓
4. フロントエンド: 選択セルの再検証API呼び出し
   GET /api/guest/therapists/{id}/availability_slots?verify_slot={start_at}
   ↓
5. バックエンド: SoTから最新状態を計算
   ↓
6. レスポンス判定:
   - status="open" → 予約処理続行（ステップ7へ）
   - status="blocked" → エラー表示（ステップ8へ）
   ↓
7. 予約API呼び出し
   POST /api/guest/reservations
   ↓
8. 競合エラー処理:
   - エラーメッセージ表示
   - カレンダー最新状態に更新
   - tentativeセル解除
```

### 検証API仕様

#### GET /api/guest/therapists/{id}/availability_slots?verify_slot={start_at}

**パラメータ**:
- `verify_slot`: 検証対象の開始時刻（ISO 8601 format）

**レスポンス**:
```json
{
  "slot": {
    "start_at": "2025-01-15T10:00:00+09:00",
    "end_at": "2025-01-15T10:30:00+09:00", 
    "status": "open",
    "verified_at": "2025-01-15T09:58:30+09:00"
  }
}
```

**エラーレスポンス（409 Conflict）**:
```json
{
  "error": "SLOT_UNAVAILABLE",
  "message": "選択された時間は他のお客様により予約されました",
  "details": {
    "slot_start": "2025-01-15T10:00:00+09:00",
    "current_status": "blocked",
    "reason": "already_reserved",
    "conflicted_at": "2025-01-15T09:57:45+09:00"
  }
}
```

## 状態管理設計

### React State 構造
```typescript
interface AvailabilityCalendarState {
  // カレンダーデータ
  availabilityDays: AvailabilityDay[];
  loading: boolean;
  error: string | null;
  
  // 選択状態
  selectedSlot: AvailabilitySlot | null;
  
  // UI状態
  showReservationForm: boolean;
  isVerifying: boolean;
  
  // エラー表示
  conflictError: ConflictError | null;
}

interface ConflictError {
  message: string;
  conflictedSlot: AvailabilitySlot;
  showUntil: Date; // 3秒後に自動非表示
}
```

### 状態遷移ルール
```typescript
// セル選択時の状態遷移
const handleCellSelect = (slot: AvailabilitySlot) => {
  // 現在のtentativeセルをopenに戻す
  if (state.selectedSlot) {
    updateSlotStatus(state.selectedSlot, 'open');
  }
  
  // 新しいセルをtentativeに設定
  updateSlotStatus(slot, 'tentative');
  setState({
    ...state,
    selectedSlot: slot,
    showReservationForm: true,
    conflictError: null
  });
};

// セル選択解除時の状態遷移
const handleCellDeselect = (slot: AvailabilitySlot) => {
  updateSlotStatus(slot, 'open');
  setState({
    ...state,
    selectedSlot: null,
    showReservationForm: false
  });
};
```

## API実装設計

### バックエンド処理フロー
```python
# availability_slots エンドポイント実装
async def get_availability_slots(
    therapist_id: UUID,
    date_from: date,
    date_to: date,
    verify_slot: Optional[datetime] = None
) -> AvailabilityCalendarResponse:
    
    # 1. SoTからデータ取得（3クエリ）
    buffer_minutes = await get_buffer_minutes(therapist_id)
    shifts = await get_therapist_shifts(therapist_id, date_from, date_to)
    reservations = await get_active_reservations(therapist_id, date_from, date_to)
    
    # 2. 空き状況計算
    available_intervals = _calculate_available_slots(
        shifts, reservations, buffer_minutes
    )
    
    # 3. 30分単位のスロット生成
    slots = generate_30min_slots(available_intervals, date_from, date_to)
    
    # 4. 特定スロット検証（verify_slotが指定された場合）
    if verify_slot:
        return verify_single_slot(slots, verify_slot)
    
    # 5. カレンダー形式に整形
    return format_calendar_response(slots)

def generate_30min_slots(
    available_intervals: List[TimeInterval],
    date_from: date,
    date_to: date
) -> List[AvailabilitySlot]:
    slots = []
    current_date = date_from
    
    while current_date <= date_to:
        # JST基準で1日分の30分スロットを生成
        day_start = datetime.combine(current_date, time(9, 0)).replace(tzinfo=JST)
        day_end = datetime.combine(current_date, time(21, 0)).replace(tzinfo=JST)
        
        current_time = day_start
        while current_time < day_end:
            slot_end = current_time + timedelta(minutes=30)
            
            # このスロットが利用可能かチェック
            status = determine_slot_status(
                current_time, slot_end, available_intervals
            )
            
            slots.append(AvailabilitySlot(
                start_at=current_time.isoformat(),
                end_at=slot_end.isoformat(),
                status=status
            ))
            
            current_time = slot_end
        
        current_date += timedelta(days=1)
    
    return slots
```

### ステータス決定ロジック
```python
def determine_slot_status(
    slot_start: datetime,
    slot_end: datetime,
    available_intervals: List[TimeInterval]
) -> AvailabilityStatus:
    
    # 過去の時間は常にblocked
    if slot_start < now_jst():
        return "blocked"
    
    # 利用可能な時間帯に完全に含まれるかチェック
    for interval in available_intervals:
        if interval.start <= slot_start and slot_end <= interval.end:
            return "open"
    
    # 部分的に重複する場合もblocked
    return "blocked"
```

## エラーハンドリング設計

### フロントエンドエラー処理
```typescript
const handleReservationSubmit = async () => {
  try {
    setState(prev => ({ ...prev, isVerifying: true }));
    
    // 1. スロット再検証
    const verification = await verifySlot(selectedSlot.start_at);
    
    if (verification.status !== 'open') {
      // 競合エラー処理
      handleSlotConflict(verification);
      return;
    }
    
    // 2. 予約処理
    await createReservation(reservationData);
    
    // 3. 成功処理
    handleReservationSuccess();
    
  } catch (error) {
    handleReservationError(error);
  } finally {
    setState(prev => ({ ...prev, isVerifying: false }));
  }
};

const handleSlotConflict = (verification: SlotVerification) => {
  // エラーメッセージ表示
  setState(prev => ({
    ...prev,
    conflictError: {
      message: "選択された時間は他のお客様により予約されました。別の時間をお選びください。",
      conflictedSlot: selectedSlot,
      showUntil: new Date(Date.now() + 3000) // 3秒後に非表示
    },
    selectedSlot: null,
    showReservationForm: false
  }));
  
  // カレンダーを最新状態に更新
  refreshCalendar();
};
```

### バックエンドエラーレスポンス
```python
# 競合エラーの詳細情報
class SlotConflictError(Exception):
    def __init__(self, slot_start: datetime, current_status: str, reason: str):
        self.slot_start = slot_start
        self.current_status = current_status
        self.reason = reason
        super().__init__(f"Slot {slot_start} is {current_status}: {reason}")

# エラーレスポンス生成
def create_conflict_response(error: SlotConflictError) -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={
            "error": "SLOT_UNAVAILABLE",
            "message": "選択された時間は予約できません",
            "details": {
                "slot_start": error.slot_start.isoformat(),
                "current_status": error.current_status,
                "reason": error.reason,
                "conflicted_at": now_jst().isoformat()
            }
        }
    )
```

## パフォーマンス最適化

### フロントエンド最適化
```typescript
// メモ化によるレンダリング最適化
const AvailabilityGrid = React.memo(({ days, onSlotSelect }) => {
  return (
    <div className="availability-grid">
      {days.map(day => (
        <AvailabilityDay
          key={day.date}
          day={day}
          onSlotSelect={onSlotSelect}
        />
      ))}
    </div>
  );
});

// 仮想化による大量データ対応
const VirtualizedCalendar = () => {
  return (
    <FixedSizeList
      height={400}
      itemCount={days.length}
      itemSize={60}
      itemData={{ days, onSlotSelect }}
    >
      {AvailabilityDayRow}
    </FixedSizeList>
  );
};
```

### バックエンド最適化
```python
# クエリ最適化（N+1問題回避）
async def get_availability_data_batch(
    therapist_ids: List[UUID],
    date_range: DateRange
) -> Dict[UUID, AvailabilityData]:
    
    # 1クエリで全therapistのbuffer_minutes取得
    buffer_query = select(Therapist.id, Profile.buffer_minutes).join(Profile)
    buffer_data = await db.execute(buffer_query.where(Therapist.id.in_(therapist_ids)))
    
    # 1クエリで全therapistのshift取得
    shift_query = select(TherapistShift).where(
        TherapistShift.therapist_id.in_(therapist_ids),
        TherapistShift.date.between(date_range.start, date_range.end)
    )
    shifts = await db.execute(shift_query)
    
    # 1クエリで全therapistの予約取得
    reservation_query = select(GuestReservation).where(
        GuestReservation.therapist_id.in_(therapist_ids),
        GuestReservation.start_at >= date_range.start_utc,
        GuestReservation.start_at < date_range.end_utc
    )
    reservations = await db.execute(reservation_query)
    
    # メモリ内で効率的に処理
    return process_availability_data(buffer_data, shifts, reservations)
```

## テスト設計方針

### 単体テスト
- ステータス決定ロジックのテスト
- 時間帯重複判定のテスト
- JST/UTC変換のテスト

### 統合テスト
- API エンドポイントのテスト
- SoT計算結果の整合性テスト
- エラーハンドリングのテスト

### E2Eテスト
- カレンダー表示・操作のテスト
- 予約競合検証のテスト
- アクセシビリティのテスト

## セキュリティ考慮事項

### 認証・認可
- therapist_id の所有権確認
- セッション管理による不正アクセス防止

### データ検証
- 入力値のサニタイゼーション
- SQLインジェクション対策
- XSS対策（React標準のエスケープ処理）

### レート制限
- API呼び出し頻度制限
- 同一IPからの大量リクエスト制限