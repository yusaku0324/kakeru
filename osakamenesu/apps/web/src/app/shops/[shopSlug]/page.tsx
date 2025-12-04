"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"

type StaffMember = {
  id: string
  name: string
  alias?: string | null
  avatar_url?: string | null
  headline?: string | null
  specialties?: string[]
}

type ReviewSummary = {
  average_score: number
  review_count: number
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

export default function ShopDetailPage() {
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params.shopSlug
  const [shop, setShop] = useState<ShopDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-text">
            在籍セラピスト ({shop.staff.length}人)
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {shop.staff.map((member) => (
              <Link
                key={member.id}
                href={`/shops/${shopSlug}/therapists/${member.id}`}
                className="group rounded border border-neutral-borderLight bg-white p-3 transition hover:border-brand-primary"
              >
                <div className="flex flex-col items-center space-y-2">
                  {member.avatar_url ? (
                    <div className="relative h-16 w-16 overflow-hidden rounded-full bg-neutral-100">
                      <Image
                        src={member.avatar_url}
                        alt={member.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-textMuted">
                      {member.name.slice(0, 1)}
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-sm font-medium text-neutral-text group-hover:text-brand-primary">
                      {member.name}
                    </p>
                    {member.headline && (
                      <p className="line-clamp-2 text-xs text-neutral-textMuted">
                        {member.headline}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
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

      {/* Back link */}
      <div className="pt-4">
        <Link href="/guest/search" className="text-sm text-brand-primary underline">
          ← 検索に戻る
        </Link>
      </div>
    </main>
  )
}
