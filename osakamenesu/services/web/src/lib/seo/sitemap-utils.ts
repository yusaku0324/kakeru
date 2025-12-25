/**
 * Sitemap generation utilities
 *
 * Enhanced sitemap features:
 * - Dynamic priority calculation
 * - Image sitemap support
 * - Change frequency optimization
 * - Multi-language support
 */

import type { MetadataRoute } from 'next'

export interface SitemapEntry {
  url: string
  lastModified?: Date
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
  images?: Array<{
    url: string
    title?: string
    caption?: string
    geo_location?: string
    license?: string
  }>
  alternates?: {
    languages?: Record<string, string>
  }
}

/**
 * Calculate priority based on page depth and importance
 */
export function calculatePriority(
  path: string,
  options?: {
    baseValue?: number
    depthPenalty?: number
    boostPatterns?: Array<{ pattern: RegExp; boost: number }>
  }
): number {
  const { baseValue = 0.5, depthPenalty = 0.1, boostPatterns = [] } = options || {}

  // Calculate depth (number of slashes)
  const depth = path.split('/').filter(Boolean).length

  // Base priority minus depth penalty
  let priority = Math.max(0.1, baseValue - depth * depthPenalty)

  // Apply boosts for matching patterns
  for (const { pattern, boost } of boostPatterns) {
    if (pattern.test(path)) {
      priority = Math.min(1.0, priority + boost)
    }
  }

  // Round to 1 decimal place
  return Math.round(priority * 10) / 10
}

/**
 * Determine change frequency based on content type
 */
export function getChangeFrequency(
  path: string,
  lastModified?: Date
): SitemapEntry['changeFrequency'] {
  // Homepage updates frequently
  if (path === '/') return 'daily'

  // Search and listing pages update frequently
  if (path.includes('/search') || path.includes('/shops') || path.includes('/therapists')) {
    return 'daily'
  }

  // Individual pages based on last modified
  if (lastModified) {
    const daysSinceModified = Math.floor(
      (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysSinceModified < 7) return 'daily'
    if (daysSinceModified < 30) return 'weekly'
    if (daysSinceModified < 180) return 'monthly'
  }

  return 'weekly'
}

/**
 * Generate sitemap entries with enhanced metadata
 */
export function generateSitemapEntries(
  entries: Array<{
    path: string
    lastModified?: Date | string
    priority?: number
    images?: string[]
  }>,
  baseUrl: string
): MetadataRoute.Sitemap {
  const boostPatterns = [
    { pattern: /^\/(shops|therapists)\/[^\/]+$/, boost: 0.1 }, // Individual pages
    { pattern: /^\/search/, boost: 0.2 }, // Search pages
    { pattern: /^\/$/, boost: 0.5 }, // Homepage
  ]

  return entries.map(entry => {
    const lastModified = entry.lastModified
      ? entry.lastModified instanceof Date
        ? entry.lastModified
        : new Date(entry.lastModified)
      : new Date()

    const url = `${baseUrl}${entry.path}`
    const priority = entry.priority ?? calculatePriority(entry.path, { boostPatterns })
    const changeFrequency = getChangeFrequency(entry.path, lastModified)

    // Add image information if available
    const images = entry.images?.map(imageUrl => ({
      url: imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`,
    }))

    return {
      url,
      lastModified,
      changeFrequency,
      priority,
      ...(images?.length && { images }),
    }
  })
}

/**
 * Split sitemap into multiple files if needed
 */
export function splitSitemap(
  entries: MetadataRoute.Sitemap,
  maxEntriesPerSitemap: number = 50000
): MetadataRoute.Sitemap[] {
  const chunks: MetadataRoute.Sitemap[] = []

  for (let i = 0; i < entries.length; i += maxEntriesPerSitemap) {
    chunks.push(entries.slice(i, i + maxEntriesPerSitemap))
  }

  return chunks
}

/**
 * Generate sitemap index for multiple sitemaps
 */
export function generateSitemapIndex(
  sitemapUrls: string[],
  baseUrl: string
): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    url => `  <sitemap>
    <loc>${baseUrl}${url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>`
  )
  .join('\n')}
</sitemapindex>`

  return xml
}

/**
 * Validate sitemap entry
 */
export function validateSitemapEntry(entry: SitemapEntry): string[] {
  const errors: string[] = []

  // Validate URL
  if (!entry.url || !entry.url.startsWith('http')) {
    errors.push('URL must be absolute and start with http(s)://')
  }

  // Validate priority
  if (entry.priority !== undefined && (entry.priority < 0 || entry.priority > 1)) {
    errors.push('Priority must be between 0.0 and 1.0')
  }

  // Validate change frequency
  const validFrequencies = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']
  if (entry.changeFrequency && !validFrequencies.includes(entry.changeFrequency)) {
    errors.push(`Change frequency must be one of: ${validFrequencies.join(', ')}`)
  }

  // Validate images
  if (entry.images) {
    entry.images.forEach((image, index) => {
      if (!image.url || !image.url.startsWith('http')) {
        errors.push(`Image ${index} URL must be absolute`)
      }
    })
  }

  return errors
}

/**
 * Generate robots.txt content
 */
export function generateRobotsTxt(options: {
  baseUrl: string
  sitemapUrls: string[]
  disallowPaths?: string[]
  crawlDelay?: number
  customRules?: Array<{ userAgent: string; rules: string[] }>
}): string {
  const { baseUrl, sitemapUrls, disallowPaths = [], crawlDelay, customRules = [] } = options

  let content = ''

  // Default rules for all bots
  content += 'User-agent: *\n'
  content += 'Allow: /\n'

  // Disallow paths
  disallowPaths.forEach(path => {
    content += `Disallow: ${path}\n`
  })

  // Crawl delay if specified
  if (crawlDelay) {
    content += `Crawl-delay: ${crawlDelay}\n`
  }

  content += '\n'

  // Custom rules for specific bots
  customRules.forEach(({ userAgent, rules }) => {
    content += `User-agent: ${userAgent}\n`
    rules.forEach(rule => {
      content += `${rule}\n`
    })
    content += '\n'
  })

  // Sitemap references
  sitemapUrls.forEach(url => {
    content += `Sitemap: ${baseUrl}${url}\n`
  })

  return content
}