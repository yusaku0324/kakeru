/**
 * Critical CSS extraction utilities
 *
 * Helps identify and inline critical CSS for faster initial render
 */

import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Extract critical CSS from built stylesheets
 */
export function extractCriticalCSS(
  htmlPath: string,
  cssPath: string,
  options?: {
    width?: number
    height?: number
    penthouse?: any // Penthouse options
  }
): Promise<string> {
  // This would be implemented with penthouse or similar tool
  // For now, return a placeholder
  return Promise.resolve(`
    /* Critical CSS for above-the-fold content */
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
    header { background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    main { min-height: 100vh; }
  `)
}

/**
 * Generate preload links for critical resources
 */
export function generatePreloadLinks(resources: {
  fonts?: string[]
  stylesheets?: string[]
  scripts?: string[]
  images?: string[]
}): string {
  const links: string[] = []

  // Preload fonts
  resources.fonts?.forEach(font => {
    links.push(`<link rel="preload" href="${font}" as="font" type="font/woff2" crossorigin>`)
  })

  // Preload critical CSS
  resources.stylesheets?.forEach(css => {
    links.push(`<link rel="preload" href="${css}" as="style">`)
  })

  // Preload critical JS (use with caution)
  resources.scripts?.forEach(script => {
    links.push(`<link rel="preload" href="${script}" as="script">`)
  })

  // Preload hero images
  resources.images?.forEach(image => {
    links.push(`<link rel="preload" href="${image}" as="image">`)
  })

  return links.join('\n')
}

/**
 * Inline critical CSS in HTML
 */
export function inlineCriticalCSS(html: string, criticalCSS: string): string {
  const styleTag = `<style>${criticalCSS}</style>`

  // Insert before closing head tag
  return html.replace('</head>', `${styleTag}\n</head>`)
}

/**
 * Add resource hints for better performance
 */
export function addResourceHints(html: string, hints: {
  preconnect?: string[]
  dnsPrefetch?: string[]
  prefetch?: string[]
}): string {
  const hintTags: string[] = []

  // DNS prefetch for external domains
  hints.dnsPrefetch?.forEach(domain => {
    hintTags.push(`<link rel="dns-prefetch" href="${domain}">`)
  })

  // Preconnect for critical origins
  hints.preconnect?.forEach(origin => {
    hintTags.push(`<link rel="preconnect" href="${origin}" crossorigin>`)
  })

  // Prefetch for next page resources
  hints.prefetch?.forEach(resource => {
    hintTags.push(`<link rel="prefetch" href="${resource}">`)
  })

  // Insert after opening head tag
  return html.replace('<head>', `<head>\n${hintTags.join('\n')}`)
}

/**
 * Optimize font loading with font-display
 */
export function optimizeFontLoading(css: string): string {
  // Add font-display: swap to all @font-face rules
  return css.replace(
    /@font-face\s*{([^}]+)}/g,
    (match, content) => {
      if (!content.includes('font-display')) {
        return `@font-face {${content}\n  font-display: swap;\n}`
      }
      return match
    }
  )
}

/**
 * Remove unused CSS (simplified version)
 */
export function removeUnusedCSS(
  css: string,
  html: string,
  options?: {
    whitelist?: string[]
    keyframes?: boolean
  }
): string {
  // This is a simplified implementation
  // In production, use PurgeCSS or similar tool

  const usedSelectors = new Set<string>()
  const whitelistPatterns = options?.whitelist || []

  // Extract all classes and IDs from HTML
  const classMatches = html.matchAll(/class="([^"]+)"/g)
  const idMatches = html.matchAll(/id="([^"]+)"/g)

  for (const match of classMatches) {
    match[1].split(/\s+/).forEach(cls => usedSelectors.add(`.${cls}`))
  }

  for (const match of idMatches) {
    usedSelectors.add(`#${match[1]}`)
  }

  // Add whitelisted selectors
  whitelistPatterns.forEach(pattern => usedSelectors.add(pattern))

  // Filter CSS rules (simplified)
  // In production, use a proper CSS parser
  return css
}

/**
 * Performance budget configuration
 */
export interface PerformanceBudget {
  maxBundleSize: number // in KB
  maxImageSize: number // in KB
  maxTotalSize: number // in KB
  maxRequests: number
  targetLCP: number // in ms
  targetFID: number // in ms
  targetCLS: number
}

export const defaultPerformanceBudget: PerformanceBudget = {
  maxBundleSize: 200, // 200KB for JS bundle
  maxImageSize: 100, // 100KB per image
  maxTotalSize: 1000, // 1MB total page weight
  maxRequests: 50, // Max 50 requests
  targetLCP: 2500, // 2.5s LCP
  targetFID: 100, // 100ms FID
  targetCLS: 0.1, // 0.1 CLS
}

/**
 * Check if resources meet performance budget
 */
export function checkPerformanceBudget(
  resources: {
    bundleSize: number
    imageSizes: number[]
    totalSize: number
    requestCount: number
  },
  budget: PerformanceBudget = defaultPerformanceBudget
): {
  passed: boolean
  violations: string[]
} {
  const violations: string[] = []

  if (resources.bundleSize > budget.maxBundleSize) {
    violations.push(
      `Bundle size (${resources.bundleSize}KB) exceeds budget (${budget.maxBundleSize}KB)`
    )
  }

  const largeImages = resources.imageSizes.filter(size => size > budget.maxImageSize)
  if (largeImages.length > 0) {
    violations.push(
      `${largeImages.length} images exceed size budget (${budget.maxImageSize}KB)`
    )
  }

  if (resources.totalSize > budget.maxTotalSize) {
    violations.push(
      `Total page size (${resources.totalSize}KB) exceeds budget (${budget.maxTotalSize}KB)`
    )
  }

  if (resources.requestCount > budget.maxRequests) {
    violations.push(
      `Request count (${resources.requestCount}) exceeds budget (${budget.maxRequests})`
    )
  }

  return {
    passed: violations.length === 0,
    violations,
  }
}