import type { MetadataRoute } from 'next'

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://osaka-menesu.com'
const INTERNAL_API_BASE =
  process.env.OSAKAMENESU_API_INTERNAL_BASE ||
  process.env.API_INTERNAL_BASE ||
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  '/api'

async function fetchProfiles(): Promise<Array<{ id: string; slug?: string; updated_at?: string }>> {
  const res = await fetch(`${INTERNAL_API_BASE}/api/dashboard/shops?limit=1000`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    return []
  }
  const data = (await res.json().catch(() => undefined)) as { shops?: Array<{ id?: string; slug?: string; updated_at?: string } | null> } | undefined
  if (!data?.shops?.length) {
    return []
  }
  return data.shops
    .map((shop) => ({ id: shop?.id ?? '', slug: shop?.slug ?? undefined, updated_at: shop?.updated_at }))
    .filter((shop) => shop.id)
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_BASE.replace(/\/$/, '')
  const profiles = await fetchProfiles()
  const now = new Date()

  const urls: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${base}/search`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${base}/profiles`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    ...profiles.map((shop) => ({
      url: `${base}/profiles/${shop.slug ?? shop.id}`,
      lastModified: shop.updated_at ? new Date(shop.updated_at) : now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
  ]

  return urls
}
