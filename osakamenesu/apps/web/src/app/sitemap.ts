import type { MetadataRoute } from 'next'

import { getServerConfig } from '@/lib/server-config'
import { generateSitemapEntries } from '@/lib/seo/sitemap-utils'

const SERVER_CONFIG = getServerConfig()

async function fetchShops(): Promise<Array<{ id: string; slug?: string; updated_at?: string }>> {
  try {
    const res = await fetch(`${SERVER_CONFIG.internalApiBase}/api/dashboard/shops?limit=1000`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error('Failed to fetch shops for sitemap:', res.status)
      return []
    }
    const data = (await res.json().catch(() => undefined)) as
      | { shops?: Array<{ id?: string; slug?: string; updated_at?: string } | null> }
      | undefined
    if (!data?.shops?.length) {
      return []
    }
    return data.shops
      .map((shop) => ({
        id: shop?.id ?? '',
        slug: shop?.slug ?? undefined,
        updated_at: shop?.updated_at,
      }))
      .filter((shop) => shop.id)
  } catch (error) {
    console.error('Error fetching shops for sitemap:', error)
    return []
  }
}

async function fetchTherapists(): Promise<Array<{ id: string; slug?: string; updated_at?: string }>> {
  try {
    const res = await fetch(`${SERVER_CONFIG.internalApiBase}/api/v1/therapists?limit=1000`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error('Failed to fetch therapists for sitemap:', res.status)
      return []
    }
    const data = (await res.json().catch(() => undefined)) as
      | { therapists?: Array<{ id?: string; slug?: string; updated_at?: string } | null> }
      | undefined
    if (!data?.therapists?.length) {
      return []
    }
    return data.therapists
      .map((therapist) => ({
        id: therapist?.id ?? '',
        slug: therapist?.slug ?? undefined,
        updated_at: therapist?.updated_at,
      }))
      .filter((therapist) => therapist.id)
  } catch (error) {
    console.error('Error fetching therapists for sitemap:', error)
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SERVER_CONFIG.siteUrl.replace(/\/$/, '')
  const [shops, therapists] = await Promise.all([
    fetchShops(),
    fetchTherapists(),
  ])
  const now = new Date()

  const urls: MetadataRoute.Sitemap = [
    // Top pages
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
      priority: 0.9,
    },
    {
      url: `${base}/shops`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${base}/therapists`,
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
    // Individual shop pages
    ...shops.map((shop) => ({
      url: `${base}/shops/${shop.slug ?? shop.id}`,
      lastModified: shop.updated_at ? new Date(shop.updated_at) : now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
    // Individual therapist pages
    ...therapists.map((therapist) => ({
      url: `${base}/therapists/${therapist.slug ?? therapist.id}`,
      lastModified: therapist.updated_at ? new Date(therapist.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ]

  return urls
}
