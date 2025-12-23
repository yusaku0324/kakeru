/**
 * JSON-LD structured data components for SEO
 * @see https://schema.org/LocalBusiness
 * @see https://developers.google.com/search/docs/appearance/structured-data/local-business
 */

type LocalBusinessJsonLdProps = {
  name: string
  description?: string | null
  url?: string | null
  image?: string | string[] | null
  telephone?: string | null
  address?: string | null
  areaServed?: string | null
  priceRange?: string | null
  openingHours?: string | null
  aggregateRating?: {
    ratingValue: number
    reviewCount: number
  } | null
}

export function LocalBusinessJsonLd({
  name,
  description,
  url,
  image,
  telephone,
  address,
  areaServed,
  priceRange,
  openingHours,
  aggregateRating,
}: LocalBusinessJsonLdProps) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HealthAndBeautyBusiness',
    name,
  }

  if (description) jsonLd.description = description
  if (url) jsonLd.url = url

  // Handle image(s)
  if (image) {
    jsonLd.image = Array.isArray(image) ? image : [image]
  }

  if (telephone) jsonLd.telephone = telephone
  if (priceRange) jsonLd.priceRange = priceRange

  // Address - simplified for Japanese addresses
  if (address) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      addressLocality: areaServed || '大阪府',
      streetAddress: address,
      addressCountry: 'JP',
    }
  }

  if (areaServed) {
    jsonLd.areaServed = {
      '@type': 'City',
      name: areaServed,
    }
  }

  // Opening hours - parse from Japanese format if available
  if (openingHours) {
    // Try to extract hours like "10:00-22:00" or "10時-22時"
    const hoursMatch = openingHours.match(/(\d{1,2})[時:]?(\d{2})?[-〜~](\d{1,2})[時:]?(\d{2})?/)
    if (hoursMatch) {
      const startHour = hoursMatch[1].padStart(2, '0')
      const startMin = hoursMatch[2] || '00'
      const endHour = hoursMatch[3].padStart(2, '0')
      const endMin = hoursMatch[4] || '00'
      jsonLd.openingHours = `Mo-Su ${startHour}:${startMin}-${endHour}:${endMin}`
    }
  }

  // Aggregate rating
  if (aggregateRating && aggregateRating.ratingValue > 0 && aggregateRating.reviewCount > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: aggregateRating.ratingValue.toFixed(1),
      reviewCount: aggregateRating.reviewCount,
      bestRating: '5',
      worstRating: '1',
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

type BreadcrumbJsonLdProps = {
  items: Array<{ name: string; url?: string }>
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

type FAQJsonLdProps = {
  items: Array<{ question: string; answer: string }>
}

export function FAQJsonLd({ items }: FAQJsonLdProps) {
  if (!items.length) return null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
