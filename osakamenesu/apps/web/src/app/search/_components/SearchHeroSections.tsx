import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { ShopHit } from '@/components/shop/ShopCard'
import { nextSlotPayloadToScheduleSlot } from '@/lib/nextAvailableSlot'
import { formatSlotJp } from '@/lib/schedule'

export type SpotlightItem = {
  id: string
  title: string
  description: string
  href: string
}

type SearchPickupContentProps = {
  items: SpotlightItem[]
}

export function SearchPickupContent({ items }: SearchPickupContentProps) {
  if (!items.length) return null
  return (
    <section className="rounded-section border border-white/60 bg-white/80 p-6 shadow-lg shadow-brand-primary/5 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-text">編集部ピックアップ</p>
          <p className="text-xs text-neutral-textMuted">キャンペーンや特集などの注目コンテンツ</p>
        </div>
        <Badge variant="brand" className="tracking-wide">
          PICK UP
        </Badge>
      </header>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.href}
            className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 focus-visible:ring-offset-2"
          >
            <Card
              interactive
              className="h-full border-brand-primary/10 bg-gradient-to-br from-brand-primary/10 via-white to-brand-secondary/15 p-5 text-sm text-neutral-text shadow-[0_20px_60px_rgba(37,99,235,0.18)]"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
                Editor&apos;s Note
              </p>
              <h3 className="mt-2 text-base font-semibold text-neutral-text">{item.title}</h3>
              <p className="mt-2 text-neutral-textMuted">{item.description}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary">
                詳しく見る
                <span aria-hidden>→</span>
              </span>
            </Card>
          </a>
        ))}
      </div>
    </section>
  )
}

type SearchAvailableTodayProps = {
  shops: ShopHit[]
}

const quickChipClass =
  'inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-neutral-text'

export function SearchAvailableToday({ shops }: SearchAvailableTodayProps) {
  const items = shops.slice(0, 4)
  return (
    <section className="rounded-section border border-white/60 bg-white/80 p-6 shadow-lg shadow-brand-primary/5 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-text">本日予約できる店舗</p>
          <p className="text-xs text-neutral-textMuted">直近の空き枠を編集部がピックアップ</p>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-brand-primary">
          TODAY
        </Badge>
      </header>
      {items.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {items.map((shop) => {
            const href = shop.slug ? `/profiles/${shop.slug}` : `/profiles/${shop.id}`
            const tags = Array.isArray(shop.service_tags)
              ? shop.service_tags.filter(Boolean).slice(0, 2)
              : []
            const nextSlotPayload = shop.next_available_slot ?? null
            const nextSlotEntity = nextSlotPayload
              ? nextSlotPayloadToScheduleSlot(nextSlotPayload)
              : null
            const formattedSlot = formatSlotJp(nextSlotEntity)
            const nextSlotLabel = (() => {
              if (!formattedSlot) {
                return shop.today_available === false
                  ? '本日の受付は終了しました'
                  : '最短の空き枠: 情報確認中'
              }
              if (shop.today_available === false) {
                return `本日空きなし / 最短: ${formattedSlot}`
              }
              return `最短の空き枠: ${formattedSlot}`
            })()
            return (
              <a
                key={shop.id}
                href={href}
                className="flex items-center justify-between gap-3 rounded-2xl border border-brand-primary/20 bg-white/90 px-4 py-3 text-sm text-neutral-text shadow-[0_16px_50px_rgba(37,99,235,0.15)] transition hover:border-brand-primary hover:bg-brand-primary/5"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{shop.store_name || shop.name}</p>
                  <p className="truncate text-xs text-neutral-textMuted">
                    {shop.area_name || shop.area || 'エリア確認中'}
                  </p>
                  {tags.length ? (
                    <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-neutral-textMuted">
                      {tags.map((tag) => (
                        <span key={`${shop.id}-${tag}`} className={quickChipClass}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs font-semibold text-brand-primary">{nextSlotLabel}</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-brand-primary">
                  <Badge variant="brand" className="text-[10px]">
                    {shop.today_available ? '本日空きあり' : '要確認'}
                  </Badge>
                </div>
              </a>
            )
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-brand-primary/30 bg-brand-primary/5 p-4 text-sm text-brand-primaryDark">
          本日の空き枠は確認中です。条件を変更するか、後ほどご確認ください。
        </div>
      )}
    </section>
  )
}
