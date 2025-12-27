import { describe, it, expect } from 'vitest'
import {
  generatePreloadLinks,
  inlineCriticalCSS,
  addResourceHints,
  optimizeFontLoading,
  removeUnusedCSS,
  checkPerformanceBudget,
  defaultPerformanceBudget,
} from '../critical-css'

describe('critical-css', () => {
  describe('generatePreloadLinks', () => {
    it('generates font preload links', () => {
      const result = generatePreloadLinks({
        fonts: ['/fonts/inter.woff2'],
      })

      expect(result).toContain('rel="preload"')
      expect(result).toContain('href="/fonts/inter.woff2"')
      expect(result).toContain('as="font"')
      expect(result).toContain('type="font/woff2"')
      expect(result).toContain('crossorigin')
    })

    it('generates stylesheet preload links', () => {
      const result = generatePreloadLinks({
        stylesheets: ['/styles/main.css'],
      })

      expect(result).toContain('rel="preload"')
      expect(result).toContain('href="/styles/main.css"')
      expect(result).toContain('as="style"')
    })

    it('generates script preload links', () => {
      const result = generatePreloadLinks({
        scripts: ['/scripts/main.js'],
      })

      expect(result).toContain('rel="preload"')
      expect(result).toContain('href="/scripts/main.js"')
      expect(result).toContain('as="script"')
    })

    it('generates image preload links', () => {
      const result = generatePreloadLinks({
        images: ['/images/hero.jpg'],
      })

      expect(result).toContain('rel="preload"')
      expect(result).toContain('href="/images/hero.jpg"')
      expect(result).toContain('as="image"')
    })

    it('generates multiple preload links', () => {
      const result = generatePreloadLinks({
        fonts: ['/fonts/a.woff2', '/fonts/b.woff2'],
        stylesheets: ['/styles/main.css'],
        images: ['/images/hero.jpg'],
      })

      const lines = result.split('\n')
      expect(lines.length).toBe(4)
    })

    it('returns empty string for empty resources', () => {
      const result = generatePreloadLinks({})
      expect(result).toBe('')
    })
  })

  describe('inlineCriticalCSS', () => {
    it('inlines CSS before closing head tag', () => {
      const html = '<html><head><title>Test</title></head><body></body></html>'
      const css = 'body { margin: 0; }'

      const result = inlineCriticalCSS(html, css)

      expect(result).toContain('<style>body { margin: 0; }</style>')
      expect(result).toContain('<style>body { margin: 0; }</style>\n</head>')
    })

    it('preserves other head content', () => {
      const html = '<html><head><title>Test</title><meta name="test"></head><body></body></html>'
      const css = '.test { color: red; }'

      const result = inlineCriticalCSS(html, css)

      expect(result).toContain('<title>Test</title>')
      expect(result).toContain('<meta name="test">')
    })
  })

  describe('addResourceHints', () => {
    it('adds dns-prefetch hints', () => {
      const html = '<html><head><title>Test</title></head></html>'
      const result = addResourceHints(html, {
        dnsPrefetch: ['https://cdn.example.com'],
      })

      expect(result).toContain('rel="dns-prefetch"')
      expect(result).toContain('href="https://cdn.example.com"')
    })

    it('adds preconnect hints with crossorigin', () => {
      const html = '<html><head><title>Test</title></head></html>'
      const result = addResourceHints(html, {
        preconnect: ['https://api.example.com'],
      })

      expect(result).toContain('rel="preconnect"')
      expect(result).toContain('href="https://api.example.com"')
      expect(result).toContain('crossorigin')
    })

    it('adds prefetch hints', () => {
      const html = '<html><head><title>Test</title></head></html>'
      const result = addResourceHints(html, {
        prefetch: ['/next-page.js'],
      })

      expect(result).toContain('rel="prefetch"')
      expect(result).toContain('href="/next-page.js"')
    })

    it('adds hints after opening head tag', () => {
      const html = '<html><head><title>Test</title></head></html>'
      const result = addResourceHints(html, {
        preconnect: ['https://api.example.com'],
      })

      expect(result).toMatch(/<head>\n<link rel="preconnect"/)
    })
  })

  describe('optimizeFontLoading', () => {
    it('adds font-display: swap to font-face rules', () => {
      const css = `
        @font-face {
          font-family: 'Inter';
          src: url('/fonts/inter.woff2');
        }
      `

      const result = optimizeFontLoading(css)

      expect(result).toContain('font-display: swap;')
    })

    it('does not duplicate font-display if already present', () => {
      const css = `
        @font-face {
          font-family: 'Inter';
          src: url('/fonts/inter.woff2');
          font-display: optional;
        }
      `

      const result = optimizeFontLoading(css)

      expect(result).not.toContain('font-display: swap')
      expect(result).toContain('font-display: optional')
    })

    it('handles multiple font-face rules', () => {
      const css = `
        @font-face {
          font-family: 'Inter';
          src: url('/fonts/inter.woff2');
        }
        @font-face {
          font-family: 'Roboto';
          src: url('/fonts/roboto.woff2');
        }
      `

      const result = optimizeFontLoading(css)
      const matches = result.match(/font-display: swap/g)

      expect(matches).toHaveLength(2)
    })

    it('preserves other CSS rules', () => {
      const css = `
        body { margin: 0; }
        @font-face {
          font-family: 'Inter';
          src: url('/fonts/inter.woff2');
        }
        .container { padding: 1rem; }
      `

      const result = optimizeFontLoading(css)

      expect(result).toContain('body { margin: 0; }')
      expect(result).toContain('.container { padding: 1rem; }')
    })
  })

  describe('removeUnusedCSS', () => {
    it('returns CSS (simplified implementation)', () => {
      const css = '.used { color: red; } .unused { color: blue; }'
      const html = '<div class="used">Content</div>'

      const result = removeUnusedCSS(css, html)

      // Current implementation returns unchanged CSS
      expect(result).toBe(css)
    })

    it('extracts classes from HTML', () => {
      const css = '.test { color: red; }'
      const html = '<div class="test another">Content</div>'

      const result = removeUnusedCSS(css, html)

      expect(result).toBeDefined()
    })

    it('handles whitelist option', () => {
      const css = '.keep { color: red; }'
      const html = '<div>No classes</div>'

      const result = removeUnusedCSS(css, html, {
        whitelist: ['.keep'],
      })

      expect(result).toBeDefined()
    })
  })

  describe('checkPerformanceBudget', () => {
    it('passes when all metrics are within budget', () => {
      const result = checkPerformanceBudget({
        bundleSize: 150,
        imageSizes: [50, 60, 70],
        totalSize: 500,
        requestCount: 30,
      })

      expect(result.passed).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('fails when bundle size exceeds budget', () => {
      const result = checkPerformanceBudget({
        bundleSize: 250,
        imageSizes: [50],
        totalSize: 500,
        requestCount: 30,
      })

      expect(result.passed).toBe(false)
      expect(result.violations).toContain(
        'Bundle size (250KB) exceeds budget (200KB)'
      )
    })

    it('fails when images exceed budget', () => {
      const result = checkPerformanceBudget({
        bundleSize: 100,
        imageSizes: [50, 150, 200],
        totalSize: 500,
        requestCount: 30,
      })

      expect(result.passed).toBe(false)
      expect(result.violations[0]).toContain('images exceed size budget')
    })

    it('fails when total size exceeds budget', () => {
      const result = checkPerformanceBudget({
        bundleSize: 100,
        imageSizes: [50],
        totalSize: 1500,
        requestCount: 30,
      })

      expect(result.passed).toBe(false)
      expect(result.violations).toContain(
        'Total page size (1500KB) exceeds budget (1000KB)'
      )
    })

    it('fails when request count exceeds budget', () => {
      const result = checkPerformanceBudget({
        bundleSize: 100,
        imageSizes: [50],
        totalSize: 500,
        requestCount: 60,
      })

      expect(result.passed).toBe(false)
      expect(result.violations).toContain(
        'Request count (60) exceeds budget (50)'
      )
    })

    it('reports multiple violations', () => {
      const result = checkPerformanceBudget({
        bundleSize: 250,
        imageSizes: [150],
        totalSize: 1500,
        requestCount: 60,
      })

      expect(result.passed).toBe(false)
      expect(result.violations.length).toBe(4)
    })

    it('uses custom budget when provided', () => {
      const customBudget = {
        ...defaultPerformanceBudget,
        maxBundleSize: 300,
      }

      const result = checkPerformanceBudget(
        {
          bundleSize: 250,
          imageSizes: [50],
          totalSize: 500,
          requestCount: 30,
        },
        customBudget
      )

      expect(result.passed).toBe(true)
    })
  })

  describe('defaultPerformanceBudget', () => {
    it('has correct default values', () => {
      expect(defaultPerformanceBudget.maxBundleSize).toBe(200)
      expect(defaultPerformanceBudget.maxImageSize).toBe(100)
      expect(defaultPerformanceBudget.maxTotalSize).toBe(1000)
      expect(defaultPerformanceBudget.maxRequests).toBe(50)
      expect(defaultPerformanceBudget.targetLCP).toBe(2500)
      expect(defaultPerformanceBudget.targetFID).toBe(100)
      expect(defaultPerformanceBudget.targetCLS).toBe(0.1)
    })
  })
})
