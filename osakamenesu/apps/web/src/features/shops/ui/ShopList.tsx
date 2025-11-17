import type { ShopSummary } from '@/features/shops/model'

type ShopListProps = {
  shops: ShopSummary[]
  selectedId: string | null
  isCreating: boolean
  onSelectShop: (id: string) => void
  onCreateShop: () => void
}

export function ShopList({
  shops,
  selectedId,
  isCreating,
  onSelectShop,
  onCreateShop,
}: ShopListProps) {
  return (
    <aside className="w-full rounded-lg border bg-white shadow-sm md:w-64">
      <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
        <span>店舗一覧</span>
        <button
          type="button"
          onClick={onCreateShop}
          className="rounded border border-blue-600 px-2 py-0.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
        >
          新規
        </button>
      </div>
      {shops.length === 0 ? (
        <p className="px-3 py-4 text-xs text-slate-500">登録済みの店舗がありません。</p>
      ) : null}
      <ul className="max-h-[60vh] overflow-y-auto">
        {shops.map((shop) => (
          <li key={shop.id}>
            <button
              type="button"
              onClick={() => onSelectShop(shop.id)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-100 ${
                shop.id === selectedId && !isCreating ? 'bg-blue-50 font-semibold' : ''
              }`}
            >
              <div>{shop.name}</div>
              <div className="text-xs text-slate-500">
                {shop.area} / {shop.status}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
