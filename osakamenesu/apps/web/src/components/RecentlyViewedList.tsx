"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

import SafeImage from '@/components/SafeImage'
import { Card } from '@/components/ui/Card'
import { RECENTLY_VIEWED_STORAGE_KEY, RECENTLY_VIEWED_UPDATE_EVENT } from './RecentlyViewedRecorder'

const dateFormatter = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'short', timeStyle: 'short' })

type Entry = {
  shopId: string
  slug: string | null
  name: string
  area: string | null
  imageUrl: string | null
  viewedAt: string
}

type Props = {
  className?: string
}

function readEntries(): Entry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => typeof item?.shopId === 'string') as Entry[]
  } catch (error) {
    console.warn('[recentlyViewed] failed to parse storage', error)
    return []
  }
}

export default function RecentlyViewedList({ className }: Props) {
  const [entries, setEntries] = useState<Entry[]>([])

  const refresh = useCallback(() => {
    setEntries(readEntries())
  }, [])

  useEffect(() => {
    refresh()
    const storageListener = (event: StorageEvent) => {
      if (event.key && event.key !== RECENTLY_VIEWED_STORAGE_KEY) return
      refresh()
    }
    const customListener = () => refresh()
    window.addEventListener('storage', storageListener)
    window.addEventListener(RECENTLY_VIEWED_UPDATE_EVENT, customListener)
    return () => {
      window.removeEventListener('storage', storageListener)
      window.removeEventListener(RECENTLY_VIEWED_UPDATE_EVENT, customListener)
    }
  }, [refresh])

  const clear = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(RECENTLY_VIEWED_STORAGE_KEY)
      setEntries([])
    } catch (error) {
      console.warn('[recentlyViewed] failed to clear storage', error)
    }
  }, [])

  const items = useMemo(() => entries.slice(0, 8), [entries])

  return (
    <section className={className} aria-labelledby="recently-viewed-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="recently-viewed-heading" className="text-xl font-semibold tracking-tight text-neutral-900">
            最近見た店舗
          </h2>
          <p className="text-sm text-neutral-600">直近で閲覧した店舗を最大8件まで保存しています。</p>
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={!items.length}
          className="inline-flex items-center rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          履歴をクリア
        </button>
      </div>

      {items.length === 0 ? (
        <Card className="mt-4 p-4 text-sm text-neutral-600">
          最近閲覧した店舗がここに表示されます。検索ページから気になる店舗を開くと自動で記録されます。
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const href = item.slug ? `/profiles/${item.slug}` : `/profiles/${item.shopId}`
            const viewedLabel = (() => {
              try {
                return dateFormatter.format(new Date(item.viewedAt))
              } catch {
                return ''
              }
            })()

            return (
              <Card key={`${item.shopId}-${item.viewedAt}`} className="overflow-hidden">
                <Link href={href} className="group block h-full">
                  <div className="relative h-40 w-full overflow-hidden bg-neutral-100">
                    {item.imageUrl ? (
                      <SafeImage
                        src={item.imageUrl}
                        alt={`${item.name}の写真`}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl font-semibold text-neutral-400">
                        {item.name.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-4">
                    <div className="text-sm font-semibold text-neutral-900 group-hover:text-brand-primary">{item.name}</div>
                    {item.area ? <div className="text-xs text-neutral-600">{item.area}</div> : null}
                    {viewedLabel ? <div className="text-xs text-neutral-500">最終閲覧: {viewedLabel}</div> : null}
                  </div>
                </Link>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
