import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  calculatePriority,
  getChangeFrequency,
  generateSitemapEntries,
  splitSitemap,
  generateSitemapIndex,
  validateSitemapEntry,
  generateRobotsTxt,
} from '../sitemap-utils'

describe('sitemap-utils', () => {
  const baseUrl = 'https://example.com'

  describe('calculatePriority', () => {
    it('returns base value for root path', () => {
      const result = calculatePriority('/', { baseValue: 0.8 })

      expect(result).toBe(0.8)
    })

    it('reduces priority for deeper paths', () => {
      const result = calculatePriority('/shops/test-shop', { baseValue: 0.8, depthPenalty: 0.1 })

      expect(result).toBe(0.6) // 0.8 - 0.2 (2 levels * 0.1)
    })

    it('applies boost for matching patterns', () => {
      const boostPatterns = [{ pattern: /^\/search/, boost: 0.2 }]
      const result = calculatePriority('/search', { baseValue: 0.5, boostPatterns })

      expect(result).toBe(0.6) // 0.5 - 0.1 (1 level) + 0.2 (boost)
    })

    it('clamps priority to minimum 0.1', () => {
      const result = calculatePriority('/a/b/c/d/e/f/g', { baseValue: 0.5, depthPenalty: 0.1 })

      expect(result).toBeGreaterThanOrEqual(0.1)
    })

    it('clamps priority to maximum 1.0', () => {
      const boostPatterns = [{ pattern: /.*/, boost: 1.0 }]
      const result = calculatePriority('/', { baseValue: 0.5, boostPatterns })

      expect(result).toBeLessThanOrEqual(1.0)
    })

    it('uses default values when no options provided', () => {
      const result = calculatePriority('/shops')

      expect(result).toBe(0.4) // 0.5 - 0.1
    })
  })

  describe('getChangeFrequency', () => {
    it('returns daily for homepage', () => {
      expect(getChangeFrequency('/')).toBe('daily')
    })

    it('returns daily for search pages', () => {
      expect(getChangeFrequency('/search')).toBe('daily')
      expect(getChangeFrequency('/search?area=namba')).toBe('daily')
    })

    it('returns daily for shops listing', () => {
      expect(getChangeFrequency('/shops')).toBe('daily')
    })

    it('returns daily for therapists listing', () => {
      expect(getChangeFrequency('/therapists')).toBe('daily')
    })

    it('returns daily for recently modified pages', () => {
      const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      expect(getChangeFrequency('/about', recentDate)).toBe('daily')
    })

    it('returns weekly for pages modified within 30 days', () => {
      const date = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
      expect(getChangeFrequency('/about', date)).toBe('weekly')
    })

    it('returns monthly for pages modified within 180 days', () => {
      const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
      expect(getChangeFrequency('/about', date)).toBe('monthly')
    })

    it('returns weekly as default for pages without lastModified', () => {
      expect(getChangeFrequency('/about')).toBe('weekly')
    })
  })

  describe('generateSitemapEntries', () => {
    it('generates sitemap entries with correct URLs', () => {
      const entries = [{ path: '/shops/test' }, { path: '/therapists/jane' }]

      const result = generateSitemapEntries(entries, baseUrl)

      expect(result[0].url).toBe(`${baseUrl}/shops/test`)
      expect(result[1].url).toBe(`${baseUrl}/therapists/jane`)
    })

    it('uses provided lastModified date', () => {
      const date = new Date('2024-01-15')
      const entries = [{ path: '/', lastModified: date }]

      const result = generateSitemapEntries(entries, baseUrl)

      expect(result[0].lastModified).toEqual(date)
    })

    it('parses string lastModified to Date', () => {
      const entries = [{ path: '/', lastModified: '2024-01-15T00:00:00.000Z' }]

      const result = generateSitemapEntries(entries, baseUrl)

      expect(result[0].lastModified).toBeInstanceOf(Date)
    })

    it('uses provided priority', () => {
      const entries = [{ path: '/', priority: 0.9 }]

      const result = generateSitemapEntries(entries, baseUrl)

      expect(result[0].priority).toBe(0.9)
    })

    it('calculates priority with boost patterns when not provided', () => {
      const entries = [{ path: '/' }]

      const result = generateSitemapEntries(entries, baseUrl)

      // Homepage should get a boost
      expect(result[0].priority).toBe(1.0)
    })

    it('includes change frequency', () => {
      const entries = [{ path: '/' }]

      const result = generateSitemapEntries(entries, baseUrl)

      expect(result[0].changeFrequency).toBe('daily')
    })

    it('includes images with absolute URLs', () => {
      const entries = [{ path: '/', images: ['/image.png', 'https://cdn.example.com/image.png'] }]

      const result = generateSitemapEntries(entries, baseUrl)

      expect(result[0].images).toEqual([
        `${baseUrl}/image.png`,
        'https://cdn.example.com/image.png',
      ])
    })
  })

  describe('splitSitemap', () => {
    it('returns single chunk for small sitemaps', () => {
      const entries = [
        { url: 'https://example.com/1', lastModified: new Date() },
        { url: 'https://example.com/2', lastModified: new Date() },
      ]

      const result = splitSitemap(entries, 50000)

      expect(result).toHaveLength(1)
      expect(result[0]).toHaveLength(2)
    })

    it('splits large sitemaps into chunks', () => {
      const entries = Array.from({ length: 100 }, (_, i) => ({
        url: `https://example.com/${i}`,
        lastModified: new Date(),
      }))

      const result = splitSitemap(entries, 30)

      expect(result).toHaveLength(4) // ceil(100/30) = 4
    })

    it('uses default max entries of 50000', () => {
      const entries = [{ url: 'https://example.com', lastModified: new Date() }]

      const result = splitSitemap(entries)

      expect(result).toHaveLength(1)
    })
  })

  describe('generateSitemapIndex', () => {
    it('generates valid sitemap index XML', () => {
      const sitemapUrls = ['/sitemap-0.xml', '/sitemap-1.xml']

      const result = generateSitemapIndex(sitemapUrls, baseUrl)

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(result).toContain('<sitemapindex')
      expect(result).toContain('<sitemap>')
      expect(result).toContain(`<loc>${baseUrl}/sitemap-0.xml</loc>`)
      expect(result).toContain(`<loc>${baseUrl}/sitemap-1.xml</loc>`)
    })

    it('includes lastmod for each sitemap', () => {
      const result = generateSitemapIndex(['/sitemap.xml'], baseUrl)

      expect(result).toContain('<lastmod>')
    })
  })

  describe('validateSitemapEntry', () => {
    it('returns no errors for valid entry', () => {
      const entry = {
        url: 'https://example.com/page',
        priority: 0.5,
        changeFrequency: 'daily' as const,
      }

      const errors = validateSitemapEntry(entry)

      expect(errors).toHaveLength(0)
    })

    it('returns error for relative URL', () => {
      const entry = { url: '/page' }

      const errors = validateSitemapEntry(entry)

      expect(errors).toContain('URL must be absolute and start with http(s)://')
    })

    it('returns error for missing URL', () => {
      const entry = { url: '' }

      const errors = validateSitemapEntry(entry)

      expect(errors).toContain('URL must be absolute and start with http(s)://')
    })

    it('returns error for priority less than 0', () => {
      const entry = { url: 'https://example.com', priority: -0.1 }

      const errors = validateSitemapEntry(entry)

      expect(errors).toContain('Priority must be between 0.0 and 1.0')
    })

    it('returns error for priority greater than 1', () => {
      const entry = { url: 'https://example.com', priority: 1.1 }

      const errors = validateSitemapEntry(entry)

      expect(errors).toContain('Priority must be between 0.0 and 1.0')
    })

    it('returns error for invalid change frequency', () => {
      const entry = { url: 'https://example.com', changeFrequency: 'invalid' as any }

      const errors = validateSitemapEntry(entry)

      expect(errors[0]).toContain('Change frequency must be one of:')
    })

    it('returns error for image with relative URL', () => {
      const entry = {
        url: 'https://example.com',
        images: [{ url: '/image.png' }],
      }

      const errors = validateSitemapEntry(entry)

      expect(errors).toContain('Image 0 URL must be absolute')
    })
  })

  describe('generateRobotsTxt', () => {
    it('generates basic robots.txt with allow all', () => {
      const result = generateRobotsTxt({
        baseUrl,
        sitemapUrls: ['/sitemap.xml'],
      })

      expect(result).toContain('User-agent: *')
      expect(result).toContain('Allow: /')
    })

    it('includes disallow paths', () => {
      const result = generateRobotsTxt({
        baseUrl,
        sitemapUrls: ['/sitemap.xml'],
        disallowPaths: ['/admin', '/api'],
      })

      expect(result).toContain('Disallow: /admin')
      expect(result).toContain('Disallow: /api')
    })

    it('includes crawl delay when specified', () => {
      const result = generateRobotsTxt({
        baseUrl,
        sitemapUrls: ['/sitemap.xml'],
        crawlDelay: 10,
      })

      expect(result).toContain('Crawl-delay: 10')
    })

    it('includes custom rules for specific user agents', () => {
      const result = generateRobotsTxt({
        baseUrl,
        sitemapUrls: ['/sitemap.xml'],
        customRules: [{ userAgent: 'Googlebot', rules: ['Allow: /special'] }],
      })

      expect(result).toContain('User-agent: Googlebot')
      expect(result).toContain('Allow: /special')
    })

    it('includes sitemap references', () => {
      const result = generateRobotsTxt({
        baseUrl,
        sitemapUrls: ['/sitemap.xml', '/sitemap-shops.xml'],
      })

      expect(result).toContain(`Sitemap: ${baseUrl}/sitemap.xml`)
      expect(result).toContain(`Sitemap: ${baseUrl}/sitemap-shops.xml`)
    })
  })
})
