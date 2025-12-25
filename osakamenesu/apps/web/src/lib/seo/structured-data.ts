/**
 * Structured data generation for SEO
 *
 * Implements JSON-LD structured data for:
 * - Organization
 * - LocalBusiness
 * - Service
 * - BreadcrumbList
 * - SearchAction
 */

export interface Organization {
  '@context': 'https://schema.org'
  '@type': 'Organization'
  name: string
  url: string
  logo?: string
  sameAs?: string[]
  contactPoint?: {
    '@type': 'ContactPoint'
    telephone?: string
    contactType: string
    areaServed: string
    availableLanguage: string[]
  }
}

export interface LocalBusiness {
  '@context': 'https://schema.org'
  '@type': 'LocalBusiness' | 'HealthAndBeautyBusiness'
  '@id': string
  name: string
  image?: string | string[]
  url: string
  telephone?: string
  priceRange?: string
  address?: {
    '@type': 'PostalAddress'
    streetAddress?: string
    addressLocality?: string
    addressRegion?: string
    postalCode?: string
    addressCountry: string
  }
  geo?: {
    '@type': 'GeoCoordinates'
    latitude: number
    longitude: number
  }
  openingHoursSpecification?: Array<{
    '@type': 'OpeningHoursSpecification'
    dayOfWeek: string | string[]
    opens?: string
    closes?: string
    validFrom?: string
    validThrough?: string
  }>
  aggregateRating?: {
    '@type': 'AggregateRating'
    ratingValue: number
    ratingCount: number
    bestRating?: number
    worstRating?: number
  }
}

export interface Service {
  '@context': 'https://schema.org'
  '@type': 'Service'
  name: string
  description?: string
  provider: {
    '@type': 'LocalBusiness' | 'Person'
    name: string
    url?: string
  }
  areaServed?: {
    '@type': 'Place'
    name: string
  }
  offers?: {
    '@type': 'Offer'
    price?: string | number
    priceCurrency?: string
    availability?: string
    validFrom?: string
    validThrough?: string
  }
}

export interface BreadcrumbList {
  '@context': 'https://schema.org'
  '@type': 'BreadcrumbList'
  itemListElement: Array<{
    '@type': 'ListItem'
    position: number
    name: string
    item?: string
  }>
}

export interface WebSite {
  '@context': 'https://schema.org'
  '@type': 'WebSite'
  url: string
  name: string
  description?: string
  potentialAction?: {
    '@type': 'SearchAction'
    target: {
      '@type': 'EntryPoint'
      urlTemplate: string
    }
    'query-input': string
  }
}

/**
 * Generate organization structured data
 */
export function generateOrganizationData(baseUrl: string): Organization {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '大阪メンエス.com',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    sameAs: [
      // Add social media URLs when available
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      areaServed: 'JP',
      availableLanguage: ['Japanese'],
    },
  }
}

/**
 * Generate LocalBusiness structured data for shops
 */
export function generateLocalBusinessData(
  shop: {
    id: string
    name: string
    slug?: string
    description?: string
    images?: string[]
    phone?: string
    address?: string
    area?: string
    price_range?: { min?: number; max?: number }
    rating?: { average: number; count: number }
    hours?: Array<{ day: number; open: string; close: string }>
  },
  baseUrl: string
): LocalBusiness {
  const url = `${baseUrl}/shops/${shop.slug || shop.id}`

  return {
    '@context': 'https://schema.org',
    '@type': 'HealthAndBeautyBusiness',
    '@id': url,
    name: shop.name,
    url,
    image: shop.images?.length ? shop.images : undefined,
    telephone: shop.phone,
    priceRange: shop.price_range
      ? `¥${shop.price_range.min || 0}-¥${shop.price_range.max || 0}`
      : undefined,
    address: shop.address
      ? {
          '@type': 'PostalAddress',
          streetAddress: shop.address,
          addressLocality: shop.area || '大阪市',
          addressRegion: '大阪府',
          addressCountry: 'JP',
        }
      : undefined,
    openingHoursSpecification: shop.hours?.map(hour => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: getDayOfWeek(hour.day),
      opens: hour.open,
      closes: hour.close,
    })),
    aggregateRating: shop.rating
      ? {
          '@type': 'AggregateRating',
          ratingValue: shop.rating.average,
          ratingCount: shop.rating.count,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined,
  }
}

/**
 * Generate Service structured data for therapists
 */
export function generateServiceData(
  therapist: {
    id: string
    name: string
    slug?: string
    shop_name?: string
    shop_id?: string
    services?: string[]
    price?: number
  },
  baseUrl: string
): Service {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${therapist.name}のメンズエステサービス`,
    description: therapist.services?.join('、'),
    provider: {
      '@type': 'Person',
      name: therapist.name,
      url: `${baseUrl}/therapists/${therapist.slug || therapist.id}`,
    },
    areaServed: {
      '@type': 'Place',
      name: '大阪府',
    },
    offers: therapist.price
      ? {
          '@type': 'Offer',
          price: therapist.price,
          priceCurrency: 'JPY',
          availability: 'https://schema.org/InStock',
        }
      : undefined,
  }
}

/**
 * Generate breadcrumb structured data
 */
export function generateBreadcrumbData(
  items: Array<{ name: string; url?: string }>,
  baseUrl: string
): BreadcrumbList {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url ? `${baseUrl}${item.url}` : undefined,
    })),
  }
}

/**
 * Generate website structured data with search
 */
export function generateWebSiteData(baseUrl: string): WebSite {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: baseUrl,
    name: '大阪メンエス.com',
    description: '大阪エリアのメンズエステ・セラピスト検索ポータルサイト',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/**
 * Helper to convert day number to schema.org day format
 */
function getDayOfWeek(day: number): string {
  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ]
  return days[day] || 'Monday'
}

/**
 * Serialize structured data for HTML
 */
export function serializeStructuredData(data: any): string {
  return JSON.stringify(data, null, process.env.NODE_ENV === 'development' ? 2 : 0)
}