import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateOrganizationData,
  generateLocalBusinessData,
  generateServiceData,
  generateBreadcrumbData,
  generateWebSiteData,
  serializeStructuredData,
} from '../structured-data'

describe('structured-data', () => {
  const baseUrl = 'https://example.com'

  describe('generateOrganizationData', () => {
    it('returns organization schema with correct structure', () => {
      const result = generateOrganizationData(baseUrl)

      expect(result['@context']).toBe('https://schema.org')
      expect(result['@type']).toBe('Organization')
      expect(result.name).toBe('大阪メンエス.com')
      expect(result.url).toBe(baseUrl)
      expect(result.logo).toBe(`${baseUrl}/logo.png`)
    })

    it('includes contact point information', () => {
      const result = generateOrganizationData(baseUrl)

      expect(result.contactPoint).toBeDefined()
      expect(result.contactPoint?.['@type']).toBe('ContactPoint')
      expect(result.contactPoint?.contactType).toBe('customer service')
      expect(result.contactPoint?.areaServed).toBe('JP')
      expect(result.contactPoint?.availableLanguage).toEqual(['Japanese'])
    })
  })

  describe('generateLocalBusinessData', () => {
    it('returns basic LocalBusiness schema', () => {
      const shop = {
        id: 'shop-1',
        name: 'Test Shop',
      }

      const result = generateLocalBusinessData(shop, baseUrl)

      expect(result['@context']).toBe('https://schema.org')
      expect(result['@type']).toBe('HealthAndBeautyBusiness')
      expect(result['@id']).toBe(`${baseUrl}/shops/shop-1`)
      expect(result.name).toBe('Test Shop')
      expect(result.url).toBe(`${baseUrl}/shops/shop-1`)
    })

    it('uses slug if available', () => {
      const shop = {
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
      }

      const result = generateLocalBusinessData(shop, baseUrl)

      expect(result['@id']).toBe(`${baseUrl}/shops/test-shop`)
      expect(result.url).toBe(`${baseUrl}/shops/test-shop`)
    })

    it('includes images when provided', () => {
      const shop = {
        id: 'shop-1',
        name: 'Test Shop',
        images: ['image1.jpg', 'image2.jpg'],
      }

      const result = generateLocalBusinessData(shop, baseUrl)

      expect(result.image).toEqual(['image1.jpg', 'image2.jpg'])
    })

    it('includes price range when provided', () => {
      const shop = {
        id: 'shop-1',
        name: 'Test Shop',
        price_range: { min: 5000, max: 15000 },
      }

      const result = generateLocalBusinessData(shop, baseUrl)

      expect(result.priceRange).toBe('¥5000-¥15000')
    })

    it('handles missing price values', () => {
      const shop = {
        id: 'shop-1',
        name: 'Test Shop',
        price_range: {},
      }

      const result = generateLocalBusinessData(shop, baseUrl)

      expect(result.priceRange).toBe('¥0-¥0')
    })

    it('includes address when provided', () => {
      const shop = {
        id: 'shop-1',
        name: 'Test Shop',
        address: '1-2-3 Namba',
        area: '難波',
      }

      const result = generateLocalBusinessData(shop, baseUrl)

      expect(result.address).toEqual({
        '@type': 'PostalAddress',
        streetAddress: '1-2-3 Namba',
        addressLocality: '難波',
        addressRegion: '大阪府',
        addressCountry: 'JP',
      })
    })

    it('uses default area when not provided', () => {
      const shop = {
        id: 'shop-1',
        name: 'Test Shop',
        address: '1-2-3 Namba',
      }

      const result = generateLocalBusinessData(shop, baseUrl)

      expect(result.address?.addressLocality).toBe('大阪市')
    })

    it('includes opening hours when provided', () => {
      const shop = {
        id: 'shop-1',
        name: 'Test Shop',
        hours: [
          { day: 1, open: '10:00', close: '22:00' },
          { day: 2, open: '10:00', close: '22:00' },
        ],
      }

      const result = generateLocalBusinessData(shop, baseUrl)

      expect(result.openingHoursSpecification).toHaveLength(2)
      expect(result.openingHoursSpecification?.[0]).toEqual({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Monday',
        opens: '10:00',
        closes: '22:00',
      })
    })

    it('handles invalid day number in hours', () => {
      const shop = {
        id: 'shop-1',
        name: 'Test Shop',
        hours: [{ day: 99, open: '10:00', close: '22:00' }],
      }

      const result = generateLocalBusinessData(shop, baseUrl)

      expect(result.openingHoursSpecification?.[0]?.dayOfWeek).toBe('Monday')
    })

    it('includes rating when provided', () => {
      const shop = {
        id: 'shop-1',
        name: 'Test Shop',
        rating: { average: 4.5, count: 100 },
      }

      const result = generateLocalBusinessData(shop, baseUrl)

      expect(result.aggregateRating).toEqual({
        '@type': 'AggregateRating',
        ratingValue: 4.5,
        ratingCount: 100,
        bestRating: 5,
        worstRating: 1,
      })
    })
  })

  describe('generateServiceData', () => {
    it('returns basic Service schema', () => {
      const therapist = {
        id: 'therapist-1',
        name: 'Test Therapist',
      }

      const result = generateServiceData(therapist, baseUrl)

      expect(result['@context']).toBe('https://schema.org')
      expect(result['@type']).toBe('Service')
      expect(result.name).toBe('Test Therapistのメンズエステサービス')
    })

    it('uses slug if available', () => {
      const therapist = {
        id: 'therapist-1',
        name: 'Test Therapist',
        slug: 'test-therapist',
      }

      const result = generateServiceData(therapist, baseUrl)

      expect(result.provider.url).toBe(`${baseUrl}/therapists/test-therapist`)
    })

    it('includes services in description', () => {
      const therapist = {
        id: 'therapist-1',
        name: 'Test Therapist',
        services: ['オイルマッサージ', 'アロマ'],
      }

      const result = generateServiceData(therapist, baseUrl)

      expect(result.description).toBe('オイルマッサージ、アロマ')
    })

    it('includes offer when price is provided', () => {
      const therapist = {
        id: 'therapist-1',
        name: 'Test Therapist',
        price: 10000,
      }

      const result = generateServiceData(therapist, baseUrl)

      expect(result.offers).toEqual({
        '@type': 'Offer',
        price: 10000,
        priceCurrency: 'JPY',
        availability: 'https://schema.org/InStock',
      })
    })

    it('sets area served to Osaka', () => {
      const therapist = {
        id: 'therapist-1',
        name: 'Test Therapist',
      }

      const result = generateServiceData(therapist, baseUrl)

      expect(result.areaServed).toEqual({
        '@type': 'Place',
        name: '大阪府',
      })
    })
  })

  describe('generateBreadcrumbData', () => {
    it('returns BreadcrumbList schema', () => {
      const items = [
        { name: 'ホーム', url: '/' },
        { name: '店舗一覧', url: '/shops' },
      ]

      const result = generateBreadcrumbData(items, baseUrl)

      expect(result['@context']).toBe('https://schema.org')
      expect(result['@type']).toBe('BreadcrumbList')
    })

    it('generates correct list items with positions', () => {
      const items = [
        { name: 'ホーム', url: '/' },
        { name: '店舗一覧', url: '/shops' },
        { name: 'Test Shop' },
      ]

      const result = generateBreadcrumbData(items, baseUrl)

      expect(result.itemListElement).toHaveLength(3)
      expect(result.itemListElement[0]).toEqual({
        '@type': 'ListItem',
        position: 1,
        name: 'ホーム',
        item: `${baseUrl}/`,
      })
      expect(result.itemListElement[1]).toEqual({
        '@type': 'ListItem',
        position: 2,
        name: '店舗一覧',
        item: `${baseUrl}/shops`,
      })
      expect(result.itemListElement[2]).toEqual({
        '@type': 'ListItem',
        position: 3,
        name: 'Test Shop',
        item: undefined,
      })
    })
  })

  describe('generateWebSiteData', () => {
    it('returns WebSite schema', () => {
      const result = generateWebSiteData(baseUrl)

      expect(result['@context']).toBe('https://schema.org')
      expect(result['@type']).toBe('WebSite')
      expect(result.url).toBe(baseUrl)
      expect(result.name).toBe('大阪メンエス.com')
    })

    it('includes search action', () => {
      const result = generateWebSiteData(baseUrl)

      expect(result.potentialAction).toBeDefined()
      expect(result.potentialAction?.['@type']).toBe('SearchAction')
      expect(result.potentialAction?.target.urlTemplate).toBe(
        `${baseUrl}/search?q={search_term_string}`
      )
    })
  })

  describe('serializeStructuredData', () => {
    const originalEnv = process.env.NODE_ENV

    afterEach(() => {
      ;(process.env as { NODE_ENV: string }).NODE_ENV = originalEnv as string
    })

    it('serializes data as JSON', () => {
      const data = { '@type': 'Organization', name: 'Test' }

      const result = serializeStructuredData(data)

      expect(JSON.parse(result)).toEqual(data)
    })

    it('uses pretty formatting in development', () => {
      ;(process.env as { NODE_ENV: string }).NODE_ENV = 'development'
      const data = { '@type': 'Organization', name: 'Test' }

      const result = serializeStructuredData(data)

      expect(result).toContain('\n')
    })

    it('uses compact formatting in production', () => {
      ;(process.env as { NODE_ENV: string }).NODE_ENV = 'production'
      const data = { '@type': 'Organization', name: 'Test' }

      const result = serializeStructuredData(data)

      expect(result).not.toContain('\n')
    })
  })
})
