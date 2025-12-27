import { describe, it, expect } from 'vitest'
import {
  generateMetadata,
  generateShopMetadata,
  generateTherapistMetadata,
  generateSearchMetadata,
  generateJsonLdScript,
  optimizeTitle,
  optimizeDescription,
  generateCanonicalUrl,
  generateAlternateUrls,
} from '../metadata'

describe('metadata', () => {
  const siteConfig = {
    name: 'Test Site',
    description: 'Test site description',
    url: 'https://example.com',
    locale: 'ja_JP',
    twitterHandle: '@test',
  }

  describe('generateMetadata', () => {
    it('generates basic metadata', () => {
      const page = {
        title: 'Page Title',
        description: 'Page description',
      }

      const result = generateMetadata(page, siteConfig)

      expect(result.title).toBe('Page Title | Test Site')
      expect(result.description).toBe('Page description')
    })

    it('does not duplicate site name in title if same', () => {
      const page = {
        title: 'Test Site',
        description: 'Description',
      }

      const result = generateMetadata(page, siteConfig)

      expect(result.title).toBe('Test Site')
    })

    it('uses site description as fallback', () => {
      const page = {
        title: 'Page',
        description: '',
      }

      const result = generateMetadata(page, siteConfig)

      expect(result.description).toBe(siteConfig.description)
    })

    it('includes keywords when provided', () => {
      const page = {
        title: 'Page',
        description: 'Desc',
        keywords: ['keyword1', 'keyword2'],
      }

      const result = generateMetadata(page, siteConfig)

      expect(result.keywords).toBe('keyword1, keyword2')
    })

    it('includes author when provided', () => {
      const page = {
        title: 'Page',
        description: 'Desc',
        author: 'Test Author',
      }

      const result = generateMetadata(page, siteConfig)

      expect(result.authors).toEqual([{ name: 'Test Author' }])
    })

    it('generates Open Graph metadata', () => {
      const page = {
        title: 'Page Title',
        description: 'Description',
        url: '/test-page',
        image: 'https://example.com/image.png',
      }

      const result = generateMetadata(page, siteConfig)

      expect(result.openGraph?.title).toBe('Page Title | Test Site')
      expect(result.openGraph?.description).toBe('Description')
      expect(result.openGraph?.url).toBe('https://example.com/test-page')
      expect(result.openGraph?.siteName).toBe('Test Site')
      expect(result.openGraph?.images).toHaveLength(1)
    })

    it('uses default og-image when no image provided', () => {
      const page = {
        title: 'Page',
        description: 'Desc',
      }

      const result = generateMetadata(page, siteConfig)
      const images = result.openGraph?.images as { url: string }[]

      expect(images?.[0]?.url).toBe('https://example.com/og-image.png')
    })

    it('generates Twitter metadata', () => {
      const page = {
        title: 'Page',
        description: 'Desc',
      }

      const result = generateMetadata(page, siteConfig)
      const twitter = result.twitter as { card?: string; site?: string }

      expect(twitter?.card).toBe('summary_large_image')
      expect(twitter?.site).toBe('@test')
    })

    it('sets robots noindex when specified', () => {
      const page = {
        title: 'Page',
        description: 'Desc',
        noindex: true,
      }

      const result = generateMetadata(page, siteConfig)

      expect(result.robots).toEqual({
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      })
    })

    it('includes canonical URL in alternates', () => {
      const page = {
        title: 'Page',
        description: 'Desc',
        url: '/test',
      }

      const result = generateMetadata(page, siteConfig)

      expect(result.alternates?.canonical).toBe('https://example.com/test')
    })
  })

  describe('generateShopMetadata', () => {
    it('generates shop-specific metadata', () => {
      const shop = {
        id: 'shop-1',
        name: 'Test Shop',
        area: '難波',
        services: ['オイル', 'アロマ'],
      }

      const result = generateShopMetadata(shop, 'https://example.com')

      expect(result.title).toContain('Test Shop')
      expect(result.title).toContain('難波')
      expect(result.description).toContain('Test Shop')
    })

    it('uses default area when not provided', () => {
      const shop = {
        id: 'shop-1',
        name: 'Test Shop',
      }

      const result = generateShopMetadata(shop, 'https://example.com')

      expect(result.description).toContain('大阪')
    })

    it('uses slug for URL when available', () => {
      const shop = {
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
      }

      const result = generateShopMetadata(shop, 'https://example.com')

      expect(result.alternates?.canonical).toContain('/shops/test-shop')
    })
  })

  describe('generateTherapistMetadata', () => {
    it('generates therapist-specific metadata', () => {
      const therapist = {
        id: 'therapist-1',
        name: 'Test Therapist',
        shop_name: 'Test Shop',
      }

      const result = generateTherapistMetadata(therapist, 'https://example.com')

      expect(result.title).toContain('Test Therapist')
      expect(result.title).toContain('Test Shop')
    })

    it('works without shop name', () => {
      const therapist = {
        id: 'therapist-1',
        name: 'Test Therapist',
      }

      const result = generateTherapistMetadata(therapist, 'https://example.com')

      expect(result.title).toContain('Test Therapist')
    })
  })

  describe('generateSearchMetadata', () => {
    it('generates search page metadata', () => {
      const params = {
        area: '難波',
        service: 'オイル',
      }

      const result = generateSearchMetadata(params, 'https://example.com')

      expect(result.title).toContain('難波')
      expect(result.title).toContain('オイル')
    })

    it('adds page number to title when paginated', () => {
      const params = { page: 2 }

      const result = generateSearchMetadata(params, 'https://example.com')

      expect(result.title).toContain('2ページ目')
    })

    it('sets noindex for paginated results', () => {
      const params = { page: 2 }

      const result = generateSearchMetadata(params, 'https://example.com')

      expect(result.robots).toEqual({
        index: false,
        follow: false,
        googleBot: expect.any(Object),
      })
    })

    it('includes keyword in title', () => {
      const params = { keyword: 'テスト' }

      const result = generateSearchMetadata(params, 'https://example.com')

      expect(result.title).toContain('「テスト」')
    })

    it('uses default search term when no params', () => {
      const result = generateSearchMetadata({}, 'https://example.com')

      expect(result.title).toContain('大阪')
    })
  })

  describe('generateJsonLdScript', () => {
    it('generates valid script tag', () => {
      const data = { '@type': 'Organization' }

      const result = generateJsonLdScript(data)

      expect(result).toBe(
        '<script type="application/ld+json">{"@type":"Organization"}</script>'
      )
    })
  })

  describe('optimizeTitle', () => {
    it('returns title unchanged if within limit', () => {
      const title = 'Short title'

      const result = optimizeTitle(title, 60)

      expect(result).toBe('Short title')
    })

    it('truncates long titles with ellipsis', () => {
      const title = 'This is a very long title that needs to be truncated because it exceeds the limit'

      const result = optimizeTitle(title, 60)

      expect(result.length).toBeLessThanOrEqual(60)
      expect(result).toContain('...')
    })

    it('tries to cut at word boundary', () => {
      const title = 'This is a long title with clear word boundaries that should be truncated'

      const result = optimizeTitle(title, 60)

      // Result should end with ellipsis and be within limit
      expect(result.length).toBeLessThanOrEqual(60)
      expect(result).toContain('...')
    })
  })

  describe('optimizeDescription', () => {
    it('returns description unchanged if within limit', () => {
      const desc = 'Short description'

      const result = optimizeDescription(desc, 155)

      expect(result).toBe('Short description')
    })

    it('truncates long descriptions', () => {
      const desc =
        'This is a very long description that needs to be truncated because it exceeds the limit. It has multiple sentences. And more content here that should be cut off.'

      const result = optimizeDescription(desc, 155)

      expect(result.length).toBeLessThanOrEqual(155)
    })

    it('tries to cut at sentence boundary', () => {
      const desc = 'First sentence is complete。Second sentence is also complete。Third sentence is here。'

      const result = optimizeDescription(desc, 60)

      expect(result.endsWith('。') || result.endsWith('...')).toBe(true)
    })
  })

  describe('generateCanonicalUrl', () => {
    it('generates canonical URL with path', () => {
      const result = generateCanonicalUrl('/shops/test', undefined, 'https://example.com')

      expect(result).toBe('https://example.com/shops/test')
    })

    it('adds leading slash if missing', () => {
      const result = generateCanonicalUrl('shops/test', undefined, 'https://example.com')

      expect(result).toBe('https://example.com/shops/test')
    })

    it('includes sorted query params', () => {
      const params = { b: '2', a: '1' }

      const result = generateCanonicalUrl('/search', params, 'https://example.com')

      expect(result).toBe('https://example.com/search?a=1&b=2')
    })

    it('excludes empty params', () => {
      const params = { a: '1', b: '', c: undefined }

      const result = generateCanonicalUrl('/search', params, 'https://example.com')

      expect(result).toBe('https://example.com/search?a=1')
    })
  })

  describe('generateAlternateUrls', () => {
    it('generates alternate URLs for locales', () => {
      const result = generateAlternateUrls('/test', ['ja', 'en'], 'https://example.com')

      expect(result).toEqual({
        ja: 'https://example.com/test',
        en: 'https://example.com/en/test',
      })
    })

    it('uses default locale for Japanese', () => {
      const result = generateAlternateUrls('/test', ['ja'], 'https://example.com')

      expect(result.ja).toBe('https://example.com/test')
    })
  })
})
