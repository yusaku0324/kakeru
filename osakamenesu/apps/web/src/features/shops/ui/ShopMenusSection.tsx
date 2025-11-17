import type { MenuItem } from '@/features/shops/model'

type ShopMenusSectionProps = {
  menus: MenuItem[]
  onUpdateMenu: (index: number, patch: Partial<MenuItem>) => void
  onAddMenu: () => void
  onRemoveMenu: (index: number) => void
}

export function ShopMenusSection({
  menus,
  onUpdateMenu,
  onAddMenu,
  onRemoveMenu,
}: ShopMenusSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">メニュー</h2>
        <button onClick={onAddMenu} className="rounded border px-3 py-1 text-sm" type="button">
          メニューを追加
        </button>
      </div>
      <div className="space-y-3">
        {menus.map((menu, idx) => (
          <div
            key={menu.id || idx}
            className="space-y-2 rounded-lg border bg-white p-3 shadow-sm"
            data-testid="menu-item"
          >
            <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr]">
              <input
                value={menu.name}
                onChange={(e) => onUpdateMenu(idx, { name: e.target.value })}
                className="rounded border px-3 py-2 text-sm"
                placeholder="メニュー名"
              />
              <input
                value={menu.price ?? ''}
                onChange={(e) => onUpdateMenu(idx, { price: Number(e.target.value) })}
                className="rounded border px-3 py-2 text-sm"
                type="number"
                min={0}
                placeholder="価格"
              />
              <input
                value={menu.duration_minutes ?? ''}
                onChange={(e) =>
                  onUpdateMenu(idx, {
                    duration_minutes: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="rounded border px-3 py-2 text-sm"
                type="number"
                min={0}
                placeholder="時間(分)"
              />
            </div>
            <textarea
              value={menu.description || ''}
              onChange={(e) => onUpdateMenu(idx, { description: e.target.value })}
              className="w-full rounded border px-3 py-2 text-sm"
              rows={2}
              placeholder="説明"
            />
            <input
              value={(menu.tags || []).join(', ')}
              onChange={(e) =>
                onUpdateMenu(idx, {
                  tags: e.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="タグ (カンマ区切り)"
            />
            <div className="flex justify-end">
              <button
                onClick={() => onRemoveMenu(idx)}
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
