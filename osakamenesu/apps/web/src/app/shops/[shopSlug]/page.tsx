"use client"

import { useParams } from "next/navigation"
import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { openReservationOverlay } from '@/components/reservationOverlayBus'
import { ShopReviewList } from './ShopReviewList'

type AvailabilitySlot = {
  start_at: string
  end_at: string
  status: 'open' | 'tentative' | 'blocked'
}

type AvailabilityDay = {
  date: string
  is_today?: boolean | null
  slots: AvailabilitySlot[]
}

type StaffMember = {
  id: string
  name: string
  alias?: string | null
  avatar_url?: string | null
  headline?: string | null
  specialties?: string[]
  today_available?: boolean
  next_available_at?: string | null
}

type ReviewSummary = {
  average_score: number
  review_count: number
}

type ReviewItem = {
  id: string
  profile_id: string
  status: string
  score: number
  title: string | null
  body: string
  author_alias: string | null
  visited_at: string | null
  created_at: string
}

type ShopDetail = {
  id: string
  slug?: string | null
  name: string
  store_name?: string | null
  area?: string | null
  area_name?: string | null
  address?: string | null
  min_price?: number | null
  max_price?: number | null
  nearest_station?: string | null
  station_walk_minutes?: number | null
  rating?: number | null
  review_count?: number | null
  lead_image_url?: string | null
  description?: string | null
  catch_copy?: string | null
  photos?: Array<{ url: string; order: number }>
  staff?: StaffMember[]
  reviews?: ReviewSummary
  today_available?: boolean
  service_tags?: string[]
  contact?: {
    phone?: string | null
    line_id?: string | null
    website_url?: string | null
  } | null
}

function formatNextAvailableLabel(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const nextDate = new Date(dateStr)
  if (Number.isNaN(nextDate.getTime())) return null
  const now = new Date()
  const isToday =
    nextDate.getFullYear() === now.getFullYear() &&
    nextDate.getMonth() === now.getMonth() &&
    nextDate.getDate() === now.getDate()
  const hours = nextDate.getHours()
  const minutes = nextDate.getMinutes()
  const timeStr = minutes === 0 ? `${hours}時` : `${hours}時${minutes}分`
  if (isToday) {
    return `次回 ${timeStr}から`
  }
  const month = nextDate.getMonth() + 1
  const day = nextDate.getDate()
  return `${month}月${day}日 ${timeStr}から`
}

async function fetchTherapistAvailability(therapistId: string): Promise<AvailabilityDay[]> {
  try {
    const resp = await fetch(`/api/guest/therapists/${therapistId}/availability_slots`)
    if (!resp.ok) return []
    const data = await resp.json()
    // The API returns { days: AvailabilityDay[] }
    return Array.isArray(data?.days) ? data.days : []
  } catch {
    return []
  }
}

export default function ShopDetailPage() {
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params.shopSlug
  const [shop, setShop] = useState<ShopDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingTherapistId, setLoadingTherapistId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchShop() {
      try {
        setLoading(true)
        const resp = await fetch(`/api/v1/shops/${shopSlug}`)
        if (!resp.ok) {
          if (resp.status === 404) {
            setError("店舗が見つかりませんでした")
          } else {
            setError("店舗情報の取得に失敗しました")
          }
          return
        }
        const data = await resp.json()
        setShop(data)
      } catch (e) {
        console.error("Failed to fetch shop", e)
        setError("店舗情報の取得に失敗しました")
      } finally {
        setLoading(false)
      }
    }
    void fetchShop()
  }, [shopSlug])

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-neutral-100 rounded-lg" />
          <div className="h-8 bg-neutral-100 rounded w-1/2" />
          <div className="h-4 bg-neutral-100 rounded w-3/4" />
        </div>
      </main>
    )
  }

  if (error || !shop) {
    return (
      <main className="mx-auto max-w-4xl p-4">
        <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
          {error || "店舗情報を取得できませんでした"}
        </div>
        <Link href="/guest/search" className="mt-4 inline-block text-brand-primary underline">
          検索に戻る
        </Link>
      </main>
    )
  }

  const priceRange =
    shop.min_price != null && shop.max_price != null
      ? `¥${shop.min_price.toLocaleString()} ~ ¥${shop.max_price.toLocaleString()}`
      : shop.min_price != null
        ? `¥${shop.min_price.toLocaleString()}~`
        : null

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      {/* Header with lead image */}
      {shop.lead_image_url && (
        <div className="relative h-48 w-full overflow-hidden rounded-lg bg-neutral-100 sm:h-64">
          <Image
            src={shop.lead_image_url}
            alt={shop.name}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      {/* Shop name and basic info */}
      <section className="space-y-2">
        <h1 className="text-2xl font-bold text-neutral-text">{shop.name}</h1>
        {shop.catch_copy && (
          <p className="text-sm text-neutral-textMuted">{shop.catch_copy}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-textMuted">
          {shop.area_name && <span>{shop.area_name}</span>}
          {shop.nearest_station && (
            <span>
              {shop.nearest_station}
              {shop.station_walk_minutes != null && ` 徒歩${shop.station_walk_minutes}分`}
            </span>
          )}
          {priceRange && <span>{priceRange}</span>}
        </div>

        {/* Rating */}
        {shop.reviews && shop.reviews.review_count > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-yellow-600">
              ★ {shop.reviews.average_score.toFixed(1)}
            </span>
            <span className="text-neutral-textMuted">
              ({shop.reviews.review_count}件のレビュー)
            </span>
          </div>
        )}

        {/* Today available badge */}
        {shop.today_available && (
          <span className="inline-block rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
            本日空きあり
          </span>
        )}
      </section>

      {/* Description */}
      {shop.description && (
        <section className="space-y-2 rounded border border-neutral-borderLight bg-white p-4">
          <h2 className="text-lg font-semibold text-neutral-text">店舗紹介</h2>
          <p className="whitespace-pre-line text-sm text-neutral-textMuted">
            {shop.description}
          </p>
        </section>
      )}

      {/* Service tags */}
      {shop.service_tags && shop.service_tags.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-neutral-text">サービス</h2>
          <div className="flex flex-wrap gap-2">
            {shop.service_tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-text"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Staff list */}
      {shop.staff && shop.staff.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-text">
            在籍セラピスト ({shop.staff.length}人)
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shop.staff.map((member) => {
              const availabilityLabel = member.today_available
                ? '本日空きあり'
                : formatNextAvailableLabel(member.next_available_at)
              return (
                <div
                  key={member.id}
                  className="group rounded-xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <Link
                    href={`/shops/${shopSlug}/therapists/${member.id}`}
                    className="block"
                  >
                    {/* Image - square aspect ratio */}
                    <div className="relative aspect-square overflow-hidden bg-neutral-100">
                      {member.avatar_url ? (
                        <Image
                          src={member.avatar_url}
                          alt={member.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl font-semibold text-neutral-textMuted">
                          {member.name.slice(0, 1)}
                        </div>
                      )}
                    </div>
                  </Link>
                  {/* Info & Button */}
                  <div className="p-2.5 space-y-2">
                    <div className="text-center">
                      <Link
                        href={`/shops/${shopSlug}/therapists/${member.id}`}
                        className="text-sm font-semibold text-neutral-text hover:text-brand-primary transition"
                      >
                        {member.name}
                      </Link>
                      {availabilityLabel && (
                        <p className={`mt-1 text-[11px] font-medium ${
                          member.today_available
                            ? 'text-green-600'
                            : 'text-amber-600'
                        }`}>
                          {availabilityLabel}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={loadingTherapistId === member.id}
                      onClick={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setLoadingTherapistId(member.id)
                        try {
                          const availabilityDays = await fetchTherapistAvailability(member.id)
                          openReservationOverlay({
                            hit: {
                              id: member.id,
                              therapistId: member.id,
                              staffId: member.id,
                              name: member.name,
                              alias: member.alias ?? null,
                              headline: member.headline ?? null,
                              specialties: member.specialties ?? [],
                              avatarUrl: member.avatar_url ?? null,
                              rating: null,
                              reviewCount: null,
                              shopId: shop.id,
                              shopSlug: shopSlug,
                              shopName: shop.name,
                              shopArea: shop.area ?? '',
                              shopAreaName: shop.area_name ?? null,
                              todayAvailable: member.today_available ?? null,
                              nextAvailableSlot: member.next_available_at
                                ? { start_at: member.next_available_at, status: 'ok' }
                                : null,
                            },
                            defaultStart: member.next_available_at ?? null,
                            availabilityDays: availabilityDays.length > 0 ? availabilityDays : undefined,
                          })
                        } finally {
                          setLoadingTherapistId(null)
                        }
                      }}
                      className="w-full rounded-lg bg-brand-primary py-2 text-xs font-semibold text-white transition hover:bg-brand-primary/90 active:scale-[0.98] disabled:opacity-50"
                    >
                      {loadingTherapistId === member.id ? '読み込み中...' : '予約する'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Photos gallery */}
      {shop.photos && shop.photos.length > 1 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-neutral-text">写真</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {shop.photos.slice(0, 8).map((photo, idx) => (
              <div
                key={idx}
                className="relative aspect-square overflow-hidden rounded bg-neutral-100"
              >
                <Image
                  src={photo.url}
                  alt={`${shop.name} photo ${idx + 1}`}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact info */}
      {shop.contact && (
        <section className="space-y-2 rounded border border-neutral-borderLight bg-white p-4">
          <h2 className="text-lg font-semibold text-neutral-text">お問い合わせ</h2>
          <div className="space-y-1 text-sm">
            {shop.contact.phone && (
              <p>
                <span className="text-neutral-textMuted">電話: </span>
                <a href={`tel:${shop.contact.phone}`} className="text-brand-primary underline">
                  {shop.contact.phone}
                </a>
              </p>
            )}
            {shop.contact.line_id && (
              <p>
                <span className="text-neutral-textMuted">LINE ID: </span>
                <span>{shop.contact.line_id}</span>
              </p>
            )}
            {shop.contact.website_url && (
              <p>
                <span className="text-neutral-textMuted">HP: </span>
                <a
                  href={shop.contact.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary underline"
                >
                  {shop.contact.website_url}
                </a>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Reviews */}
      <ShopReviewList
        shopId={shop.id}
        initialReviewCount={shop.reviews?.review_count ?? 0}
      />

      {/* Address */}
      {shop.address && (
        <section className="space-y-2 rounded border border-neutral-borderLight bg-white p-4">
          <h2 className="text-lg font-semibold text-neutral-text">アクセス</h2>
          <p className="text-sm text-neutral-textMuted">{shop.address}</p>
          {shop.nearest_station && (
            <p className="text-sm text-neutral-textMuted">
              {shop.nearest_station}
              {shop.station_walk_minutes != null && ` から徒歩${shop.station_walk_minutes}分`}
            </p>
          )}
        </section>
      )}

    </main>
  )
}
