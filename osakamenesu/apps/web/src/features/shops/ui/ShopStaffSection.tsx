import type { StaffItem } from '@/features/shops/model'

type ShopStaffSectionProps = {
  staff: StaffItem[]
  onUpdateStaff: (index: number, patch: Partial<StaffItem>) => void
  onAddStaff: () => void
  onRemoveStaff: (index: number) => void
}

export function ShopStaffSection({
  staff,
  onUpdateStaff,
  onAddStaff,
  onRemoveStaff,
}: ShopStaffSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">スタッフ</h2>
        <button onClick={onAddStaff} className="rounded border px-3 py-1 text-sm" type="button">
          スタッフを追加
        </button>
      </div>
      <div className="space-y-3">
        {staff.map((member, idx) => (
          <div
            key={member.id || idx}
            className="space-y-2 rounded-lg border bg-white p-3 shadow-sm"
            data-testid="staff-item"
          >
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={member.name}
                onChange={(e) => onUpdateStaff(idx, { name: e.target.value })}
                className="rounded border px-3 py-2 text-sm"
                placeholder="名前"
              />
              <input
                value={member.alias || ''}
                onChange={(e) => onUpdateStaff(idx, { alias: e.target.value })}
                className="rounded border px-3 py-2 text-sm"
                placeholder="表示名"
              />
            </div>
            <textarea
              value={member.headline || ''}
              onChange={(e) => onUpdateStaff(idx, { headline: e.target.value })}
              className="w-full rounded border px-3 py-2 text-sm"
              rows={2}
              placeholder="紹介文"
            />
            <input
              value={(member.specialties || []).join(', ')}
              onChange={(e) =>
                onUpdateStaff(idx, {
                  specialties: e.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="得意分野 (カンマ区切り)"
            />
            <div className="flex justify-end">
              <button
                onClick={() => onRemoveStaff(idx)}
                className="text-xs text-red-600"
                type="button"
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
