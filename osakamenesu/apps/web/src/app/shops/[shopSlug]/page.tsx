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

import { fetchShop, type ShopDetail, type StaffSummary } from '@/lib/shops'

type PageProps = {
  params: Promise<{ shopSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shopSlug } = await params
  let shop: ShopDetail | null = null
  try {
    shop = await fetchShop(shopSlug)
  } catch {
    // Ignore error
  }

  if (!shop) {
    return {
      title: '店舗が見つかりません',
      robots: { index: false },
    }
  }

  const leadImage = shop.photos?.[0]?.url

  return generateShopMetadata({
    name: shop.name,
    description: shop.description || shop.catch_copy || undefined,
    area: shop.area_name || shop.area || undefined,
    services: shop.service_tags || undefined,
    images: leadImage ? [leadImage] : undefined,
    slug: shop.slug || undefined,
    id: shop.id,
  })
}

export default async function ShopDetailPage({ params }: PageProps) {
  const { shopSlug } = await params
  const shop = await fetchShop(shopSlug).catch(() => notFound())

  if (!shop) {
    notFound()
  }

  const leadImage = shop.photos?.[0]?.url

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
      images: shop.photos?.map(p => p.url) || undefined,
      phone: shop.contact?.phone || undefined,
      address: shop.address || undefined,
      area: shop.area_name || shop.area || undefined,
      price_range: shop.min_price && shop.max_price ? { min: shop.min_price, max: shop.max_price } : undefined,
      rating: shop.reviews ? { average: shop.reviews.average_score || 0, count: shop.reviews.review_count || 0 } : undefined,
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
        {leadImage && (
          <div className="relative h-48 w-full overflow-hidden rounded-lg bg-neutral-100 sm:h-64">
            <Image
              src={leadImage}
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
            {priceRange && <span>{priceRange}</span>}
          </div>

          {/* Rating */}
          {shop.reviews && shop.reviews.review_count > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-yellow-600">
                ★ {shop.reviews.average_score?.toFixed(1) ?? '—'}
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
          </section>
        )}
      </main>
    </>
  )
}
