import { Card } from '@/components/ui/Card'
import type { AvailabilityDay, AvailabilitySlot } from '@/features/shops/model'

type ShopReservationSummaryProps = {
  availability: AvailabilityDay[]
  onAddDay: () => void
  onDeleteDay: (dayIndex: number) => void
  onUpdateDate: (dayIndex: number, value: string) => void
  onAddSlot: (dayIndex: number) => void
  onUpdateSlot: (dayIndex: number, slotIndex: number, key: keyof AvailabilitySlot, value: string) => void
  onRemoveSlot: (dayIndex: number, slotIndex: number) => void
  onSaveDay: (date: string, slots: AvailabilitySlot[]) => void | Promise<boolean>
}

const STATUS_OPTIONS: AvailabilitySlot['status'][] = ['open', 'tentative', 'blocked']

export function ShopReservationSummary({
  availability,
  onAddDay,
  onDeleteDay,
  onUpdateDate,
  onAddSlot,
  onUpdateSlot,
  onRemoveSlot,
  onSaveDay,
}: ShopReservationSummaryProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">出勤・空き枠</h2>
        <button
          type="button"
          onClick={onAddDay}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          日を追加
        </button>
      </div>
      <p className="text-xs text-slate-500">日付を選び、時間帯とステータスを編集して保存してください。</p>
      {availability.length === 0 ? <Card className="p-4 text-sm text-slate-500">登録された空き枠はありません。</Card> : null}
      <div className="space-y-4">
        {availability.map((day, dayIndex) => (
          <Card key={`${day.date}-${dayIndex}`} className="space-y-4 p-4" data-testid="availability-day">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">日付</label>
                <input
                  type="date"
                  value={day.date}
                  onChange={e => onUpdateDate(dayIndex, e.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  data-testid="availability-date"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onDeleteDay(dayIndex)}
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
                >
                  日を削除
                </button>
                <button
                  type="button"
                  onClick={() => onSaveDay(day.date, day.slots)}
                  className="rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  data-testid="save-availability"
                >
                  この日の枠を保存
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {day.slots.map((slot, slotIndex) => (
                <div
                  key={slotIndex}
                  className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_160px_auto] md:items-end"
                  data-testid="availability-slot"
                >
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">開始</label>
                    <input
                      type="datetime-local"
                      value={slot.start_at}
                      onChange={e => onUpdateSlot(dayIndex, slotIndex, 'start_at', e.target.value)}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      data-testid="slot-start"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">終了</label>
                    <input
                      type="datetime-local"
                      value={slot.end_at}
                      onChange={e => onUpdateSlot(dayIndex, slotIndex, 'end_at', e.target.value)}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      data-testid="slot-end"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">ステータス</label>
                    <select
                      value={slot.status}
                      onChange={e => onUpdateSlot(dayIndex, slotIndex, 'status', e.target.value as AvailabilitySlot['status'])}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      data-testid="slot-status"
                    >
                      {STATUS_OPTIONS.map(option => (
                        <option key={option} value={option}>
                          {option === 'open' ? '空きあり' : option === 'tentative' ? '調整中' : '受付停止'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex h-full items-end justify-end">
                    <button
                      type="button"
                      onClick={() => onRemoveSlot(dayIndex, slotIndex)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      枠を削除
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onAddSlot(dayIndex)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                data-testid="add-slot"
              >
                枠を追加
              </button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
