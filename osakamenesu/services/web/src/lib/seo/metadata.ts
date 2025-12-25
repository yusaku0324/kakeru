/**
 * SEO metadata generation utilities
 *
 * Provides comprehensive metadata generation for:
 * - Title and description optimization
 * - Open Graph tags
 * - Twitter Cards
 * - Canonical URLs
 * - Alternate languages
 */

import type { Metadata } from 'next'

interface PageMetadata {
  title: string
  description: string
  keywords?: string[]
  image?: string
  url?: string
  type?: 'website' | 'article' | 'profile'
  locale?: string
  alternates?: { [locale: string]: string }
  noindex?: boolean
  author?: string
  publishedTime?: string
  modifiedTime?: string
}

interface SiteConfig {
  name: string
  description: string
  url: string
  locale: string
  twitterHandle?: string
}

const defaultSiteConfig: SiteConfig = {
  name: '大阪メンエス.com',
  description: '大阪エリアのメンズエステ・セラピスト検索ポータルサイト。探しやすい・誤解しない・速い',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://osakamenesu.com',
  locale: 'ja_JP',
}

/**
 * Generate optimized page metadata
 */
export function generateMetadata(
  page: PageMetadata,
  siteConfig: SiteConfig = defaultSiteConfig
): Metadata {
  const title = page.title === siteConfig.name
    ? page.title
    : `${page.title} | ${siteConfig.name}`

  const description = page.description || siteConfig.description
  const url = page.url ? `${siteConfig.url}${page.url}` : siteConfig.url
  const image = page.image || `${siteConfig.url}/og-image.png`

  return {
    title,
    description,
    keywords: page.keywords?.join(', '),
    authors: page.author ? [{ name: page.author }] : undefined,
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: page.locale || siteConfig.locale,
      type: page.type || 'website',
      ...(page.publishedTime && { publishedTime: page.publishedTime }),
      ...(page.modifiedTime && { modifiedTime: page.modifiedTime }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
      ...(siteConfig.twitterHandle && { site: siteConfig.twitterHandle }),
    },
    robots: {
      index: !page.noindex,
      follow: !page.noindex,
      googleBot: {
        index: !page.noindex,
        follow: !page.noindex,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: url,
      languages: page.alternates,
    },
  }
}

/**
 * Generate metadata for shop pages
 */
export function generateShopMetadata(
  shop: {
    name: string
    description?: string
    area?: string
    services?: string[]
    images?: string[]
    slug?: string
    id: string
  },
  baseUrl: string = defaultSiteConfig.url
): Metadata {
  const services = shop.services?.slice(0, 5).join('、') || 'メンズエステ'
  const area = shop.area || '大阪'

  return generateMetadata({
    title: `${shop.name} - ${area}のメンズエステ`,
    description:
      shop.description ||
      `${shop.name}は${area}で${services}を提供するメンズエステ店です。セラピスト情報、料金、アクセス、口コミはこちら。`,
    keywords: [
      shop.name,
      area,
      'メンズエステ',
      '大阪',
      ...shop.services || [],
    ],
    url: `/shops/${shop.slug || shop.id}`,
    type: 'profile',
    image: shop.images?.[0],
  })
}

/**
 * Generate metadata for therapist pages
 */
export function generateTherapistMetadata(
  therapist: {
    name: string
    shop_name?: string
    profile?: string
    services?: string[]
    image?: string
    slug?: string
    id: string
  },
  baseUrl: string = defaultSiteConfig.url
): Metadata {
  const shopInfo = therapist.shop_name ? `${therapist.shop_name}の` : ''

  return generateMetadata({
    title: `${therapist.name} - ${shopInfo}セラピスト`,
    description:
      therapist.profile ||
      `${therapist.name}さんは${shopInfo}セラピストです。施術内容、スケジュール、口コミはこちらから。`,
    keywords: [
      therapist.name,
      'セラピスト',
      'メンズエステ',
      '大阪',
      therapist.shop_name || '',
      ...(therapist.services || []),
    ],
    url: `/therapists/${therapist.slug || therapist.id}`,
    type: 'profile',
    image: therapist.image,
  })
}

/**
 * Generate metadata for search pages
 */
export function generateSearchMetadata(
  params: {
    area?: string
    service?: string
    keyword?: string
    page?: number
  },
  baseUrl: string = defaultSiteConfig.url
): Metadata {
  const parts: string[] = []

  if (params.area) parts.push(`${params.area}`)
  if (params.service) parts.push(`${params.service}`)
  if (params.keyword) parts.push(`「${params.keyword}」`)

  const searchTerm = parts.join('・') || '大阪'
  const pageInfo = params.page && params.page > 1 ? ` - ${params.page}ページ目` : ''

  return generateMetadata({
    title: `${searchTerm}のメンズエステ検索結果${pageInfo}`,
    description: `${searchTerm}のメンズエステ店・セラピストの検索結果。料金、サービス内容、口コミで比較して、あなたに最適なお店を見つけましょう。`,
    keywords: [
      searchTerm,
      'メンズエステ',
      '検索',
      '大阪',
      params.area || '',
      params.service || '',
    ].filter(Boolean),
    url: `/search?${new URLSearchParams(params as any).toString()}`,
    noindex: params.page && params.page > 1, // Noindex for pagination
  })
}

/**
 * Generate JSON-LD script tag
 */
export function generateJsonLdScript(data: any): string {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`
}

/**
 * Optimize title length for SEO
 */
export function optimizeTitle(title: string, maxLength: number = 60): string {
  if (title.length <= maxLength) return title

  // Try to cut at word boundary
  const truncated = title.substring(0, maxLength - 3)
  const lastSpace = truncated.lastIndexOf(' ')

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...'
  }

  return truncated + '...'
}

/**
 * Optimize description length for SEO
 */
export function optimizeDescription(
  description: string,
  maxLength: number = 155
): string {
  if (description.length <= maxLength) return description

  // Try to cut at sentence boundary
  const truncated = description.substring(0, maxLength - 3)
  const lastPeriod = truncated.lastIndexOf('。')

  if (lastPeriod > maxLength * 0.7) {
    return truncated.substring(0, lastPeriod + 1)
  }

  // Otherwise cut at word boundary
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...'
  }

  return truncated + '...'
}

/**
 * Generate canonical URL
 */
export function generateCanonicalUrl(
  path: string,
  params?: Record<string, any>,
  baseUrl: string = defaultSiteConfig.url
): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  let url = `${baseUrl}${cleanPath}`

  // Add canonical parameters (sorted for consistency)
  if (params) {
    const canonicalParams = new URLSearchParams()
    const sortedKeys = Object.keys(params).sort()

    for (const key of sortedKeys) {
      if (params[key] !== undefined && params[key] !== '') {
        canonicalParams.append(key, params[key])
      }
    }

    const queryString = canonicalParams.toString()
    if (queryString) {
      url += `?${queryString}`
    }
  }

  return url
}

/**
 * Generate alternate language URLs
 */
export function generateAlternateUrls(
  path: string,
  locales: string[] = ['ja'],
  baseUrl: string = defaultSiteConfig.url
): Record<string, string> {
  const alternates: Record<string, string> = {}

  for (const locale of locales) {
    if (locale === 'ja') {
      alternates[locale] = `${baseUrl}${path}`
    } else {
      alternates[locale] = `${baseUrl}/${locale}${path}`
    }
  }

  return alternates
}