import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'

import { resolveInternalApiBase } from '@/lib/server-config'
import { ShopStaffGrid, type StaffMember } from './ShopStaffGrid'
import { ShopReviewList } from './ShopReviewList'
import { generateShopMetadata } from '@/lib/seo/metadata'
import { generateLocalBusinessData } from '@/lib/seo/structured-data'
import SchemaMarkup from '@/components/seo/SchemaMarkup'
import Breadcrumb from '@/components/seo/Breadcrumb'

// ISR: Revalidate every 60 seconds for fresh data while still caching
export const revalidate = 60

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

async function fetchShop(shopSlug: string): Promise<ShopDetail | null> {
  const internalBase = resolveInternalApiBase()
  const url = `${internalBase}/api/v1/shops/${encodeURIComponent(shopSlug)}`

  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      console.error(`Failed to fetch shop: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to fetch shop:', error)
    return null
  }
}

type PageProps = {
  params: Promise<{ shopSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shopSlug } = await params
  const shop = await fetchShop(shopSlug)

  if (!shop) {
    return {
      title: '店舗が見つかりません',
      robots: { index: false },
    }
  }

  return generateShopMetadata({
    name: shop.name,
    description: shop.description || shop.catch_copy || undefined,
    area: shop.area_name || shop.area || undefined,
    services: shop.service_tags,
    images: shop.lead_image_url ? [shop.lead_image_url] : undefined,
    slug: shop.slug || undefined,
    id: shop.id,
  })
}

export default async function ShopDetailPage({ params }: PageProps) {
  const { shopSlug } = await params
  const shop = await fetchShop(shopSlug)

  if (!shop) {
    notFound()
  }

  const priceRange =
    shop.min_price != null && shop.max_price != null
      ? `¥${shop.min_price.toLocaleString()} ~ ¥${shop.max_price.toLocaleString()}`
      : shop.min_price != null
        ? `¥${shop.min_price.toLocaleString()}~`
        : null

  // Generate structured data
  const structuredData = generateLocalBusinessData(
    {
      id: shop.id,
      name: shop.name,
      slug: shop.slug || undefined,
      description: shop.description || undefined,
      images: shop.photos?.map(p => p.url) || (shop.lead_image_url ? [shop.lead_image_url] : undefined),
      phone: shop.contact?.phone || undefined,
      address: shop.address || undefined,
      area: shop.area_name || shop.area || undefined,
      price_range: shop.min_price && shop.max_price ? { min: shop.min_price, max: shop.max_price } : undefined,
      rating: shop.reviews ? { average: shop.reviews.average_score, count: shop.reviews.review_count } : undefined,
    },
    process.env.NEXT_PUBLIC_SITE_URL || 'https://osakamenesu.com'
  )

  const breadcrumbItems = [
    { name: '店舗一覧', url: '/shops' },
    { name: shop.name },
  ]

  return (
    <>
      <SchemaMarkup data={structuredData} />
      <main className="mx-auto max-w-4xl space-y-6 p-4">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} className="mb-4" />

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

      {/* Staff list - Client Component for interactivity */}
      {shop.staff && shop.staff.length > 0 && (
        <ShopStaffGrid
          staff={shop.staff}
          shopId={shop.id}
          shopSlug={shopSlug}
          shopName={shop.name}
          shopArea={shop.area}
          shopAreaName={shop.area_name}
        />
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

      {/* Reviews - Client Component */}
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
    </>
  )
}
