/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  loadFonts,
  getJapaneseFontSubsets,
  generateJapaneseFontFace,
  loadVariableFont,
  systemFontStack,
  adaptiveFontLoading,
  fontLoadingCSS,
} from '../font-optimization'

describe('font-optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear any added styles or links
    document.head.innerHTML = ''
    document.documentElement.className = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getJapaneseFontSubsets', () => {
    it('returns correct unicode ranges', () => {
      const subsets = getJapaneseFontSubsets()

      expect(subsets.hiragana).toBe('U+3040-309F')
      expect(subsets.katakana).toBe('U+30A0-30FF')
      expect(subsets.basicKanji).toBe('U+4E00-9FAF')
      expect(subsets.punctuation).toBe('U+3000-303F')
    })

    it('returns all four subset categories', () => {
      const subsets = getJapaneseFontSubsets()

      expect(Object.keys(subsets)).toHaveLength(4)
      expect(subsets).toHaveProperty('hiragana')
      expect(subsets).toHaveProperty('katakana')
      expect(subsets).toHaveProperty('basicKanji')
      expect(subsets).toHaveProperty('punctuation')
    })
  })

  describe('generateJapaneseFontFace', () => {
    it('generates font-face rules with default weights', () => {
      const result = generateJapaneseFontFace({
        family: 'NotoSansJP',
        baseUrl: '/fonts/noto-sans-jp',
      })

      expect(result).toContain("font-family: 'NotoSansJP'")
      expect(result).toContain('font-weight: 400')
      expect(result).toContain('font-weight: 700')
      expect(result).toContain('/fonts/noto-sans-jp/400-hiragana.woff2')
      expect(result).toContain('/fonts/noto-sans-jp/700-kanji.woff2')
    })

    it('generates font-face rules with custom weights', () => {
      const result = generateJapaneseFontFace({
        family: 'CustomFont',
        baseUrl: '/fonts/custom',
        weights: [300, 500, 900],
      })

      expect(result).toContain('font-weight: 300')
      expect(result).toContain('font-weight: 500')
      expect(result).toContain('font-weight: 900')
      expect(result).not.toContain('font-weight: 400')
    })

    it('includes unicode-range for each subset', () => {
      const result = generateJapaneseFontFace({
        family: 'TestFont',
        baseUrl: '/fonts/test',
        weights: [400],
      })

      expect(result).toContain('unicode-range: U+3040-309F') // hiragana
      expect(result).toContain('unicode-range: U+30A0-30FF') // katakana
      expect(result).toContain('unicode-range: U+4E00-9FAF') // kanji
    })

    it('uses font-display: swap', () => {
      const result = generateJapaneseFontFace({
        family: 'TestFont',
        baseUrl: '/fonts/test',
      })

      expect(result).toContain('font-display: swap')
    })
  })

  describe('loadVariableFont', () => {
    it('creates font-face rule in document head', () => {
      loadVariableFont({
        family: 'Inter',
        src: '/fonts/inter-variable.woff2',
      })

      const styles = document.querySelectorAll('head > style')
      expect(styles.length).toBe(1)
      expect(styles[0].textContent).toContain("font-family: 'Inter'")
      expect(styles[0].textContent).toContain('woff2-variations')
    })

    it('uses custom weight range', () => {
      loadVariableFont({
        family: 'Variable',
        src: '/fonts/variable.woff2',
        weights: { min: 200, max: 800 },
      })

      const style = document.querySelector('head > style')
      expect(style?.textContent).toContain('font-weight: 200 800')
    })

    it('uses default weight range 100-900', () => {
      loadVariableFont({
        family: 'DefaultRange',
        src: '/fonts/default.woff2',
      })

      const style = document.querySelector('head > style')
      expect(style?.textContent).toContain('font-weight: 100 900')
    })

    it('adds preload link when preload option is true', () => {
      loadVariableFont({
        family: 'Preloaded',
        src: '/fonts/preloaded.woff2',
        preload: true,
      })

      const link = document.querySelector('head > link[rel="preload"]')
      expect(link).not.toBeNull()
      expect(link?.getAttribute('href')).toBe('/fonts/preloaded.woff2')
      // Note: jsdom doesn't fully support preload link attributes, so we check the element exists
      // and has the correct href
    })

    it('does not add preload link when preload is false', () => {
      loadVariableFont({
        family: 'NoPreload',
        src: '/fonts/nopreload.woff2',
        preload: false,
      })

      const link = document.querySelector('head > link[rel="preload"]')
      expect(link).toBeNull()
    })
  })

  describe('systemFontStack', () => {
    it('has sansSerif stack', () => {
      expect(systemFontStack.sansSerif).toBeDefined()
      expect(systemFontStack.sansSerif).toContain('-apple-system')
      expect(systemFontStack.sansSerif).toContain('sans-serif')
    })

    it('has serif stack', () => {
      expect(systemFontStack.serif).toBeDefined()
      expect(systemFontStack.serif).toContain('Georgia')
      expect(systemFontStack.serif).toContain('serif')
    })

    it('has monospace stack', () => {
      expect(systemFontStack.monospace).toBeDefined()
      expect(systemFontStack.monospace).toContain('Menlo')
      expect(systemFontStack.monospace).toContain('monospace')
    })

    it('has japanese stack', () => {
      expect(systemFontStack.japanese).toBeDefined()
      expect(systemFontStack.japanese).toContain('Hiragino Sans')
      expect(systemFontStack.japanese).toContain('Meiryo')
    })
  })

  describe('fontLoadingCSS', () => {
    it('contains base body font styles', () => {
      expect(fontLoadingCSS).toContain('body')
      expect(fontLoadingCSS).toContain('font-family:')
    })

    it('contains loaded font class', () => {
      expect(fontLoadingCSS).toContain('.font-customfont-loaded')
    })

    it('contains Japanese language styles', () => {
      expect(fontLoadingCSS).toContain(':lang(ja)')
      expect(fontLoadingCSS).toContain("font-feature-settings: 'palt' 1")
    })

    it('contains system fonts only mode', () => {
      expect(fontLoadingCSS).toContain('.system-fonts-only')
    })

    it('contains variable font support', () => {
      expect(fontLoadingCSS).toContain('@supports (font-variation-settings: normal)')
      expect(fontLoadingCSS).toContain('.variable-font')
    })
  })

  describe('adaptiveFontLoading', () => {
    it('returns early if connection API not available', async () => {
      // connection is not in navigator by default in jsdom
      await adaptiveFontLoading()

      // Should not add any classes
      expect(document.documentElement.classList.length).toBe(0)
    })

    it('adds system-fonts-only class on slow connection', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '2g',
          saveData: false,
        },
        configurable: true,
      })

      await adaptiveFontLoading()

      expect(document.documentElement.classList.contains('system-fonts-only')).toBe(true)
    })

    it('adds system-fonts-only class when saveData is true', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '4g',
          saveData: true,
        },
        configurable: true,
      })

      await adaptiveFontLoading()

      expect(document.documentElement.classList.contains('system-fonts-only')).toBe(true)
    })

    // Note: 3g and 4g tests are skipped because they call loadFonts internally
    // which uses FontFaceObserverLight with a 3000ms timeout that cannot be easily mocked
    // The class addition happens before loadFonts is called, so we test that behavior
    it('adds subset-fonts class on 3g connection before loading', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '3g',
          saveData: false,
        },
        configurable: true,
      })

      // Don't await - just trigger and check class is added synchronously
      const promise = adaptiveFontLoading()
      expect(document.documentElement.classList.contains('subset-fonts')).toBe(true)

      // Silence the promise rejection from font loading timeout
      promise.catch(() => {})
    })

    it('adds all-fonts class on 4g connection before loading', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '4g',
          saveData: false,
        },
        configurable: true,
      })

      // Don't await - just trigger and check class is added synchronously
      const promise = adaptiveFontLoading()
      expect(document.documentElement.classList.contains('all-fonts')).toBe(true)

      // Silence the promise rejection from font loading timeout
      promise.catch(() => {})
    })
  })

  describe('loadFonts', () => {
    it('creates style element with font-face rules', () => {
      // Start loading - don't await as it will timeout in jsdom
      const promise = loadFonts([
        {
          family: 'TestFont',
          src: '/fonts/test.woff2',
          weight: 400,
        },
      ])

      // Style should be added synchronously
      const styles = document.querySelectorAll('head > style')
      expect(styles.length).toBeGreaterThan(0)
      expect(styles[0].textContent).toContain("font-family: 'TestFont'")

      // Silence the promise rejection from font loading timeout
      promise.catch(() => {})
    })

    it('adds preload links for fonts with preload option', () => {
      const promise = loadFonts([
        {
          family: 'PreloadFont',
          src: '/fonts/preload.woff2',
          weight: 400,
          preload: true,
        },
      ])

      const link = document.querySelector('head > link[rel="preload"]')
      expect(link).not.toBeNull()
      expect(link?.getAttribute('href')).toBe('/fonts/preload.woff2')

      promise.catch(() => {})
    })

    it('handles multiple font sources', () => {
      const promise = loadFonts([
        {
          family: 'MultiSource',
          src: ['/fonts/font.woff2', '/fonts/font.woff', '/fonts/font.ttf'],
          weight: 400,
        },
      ])

      const style = document.querySelector('head > style')
      expect(style?.textContent).toContain("format('woff2')")
      expect(style?.textContent).toContain("format('woff')")
      expect(style?.textContent).toContain("format('truetype')")

      promise.catch(() => {})
    })

    it('uses default font-display swap', () => {
      const promise = loadFonts([
        {
          family: 'SwapFont',
          src: '/fonts/swap.woff2',
        },
      ])

      const style = document.querySelector('head > style')
      expect(style?.textContent).toContain('font-display: swap')

      promise.catch(() => {})
    })

    it('uses custom font-display', () => {
      const promise = loadFonts([
        {
          family: 'OptionalFont',
          src: '/fonts/optional.woff2',
          display: 'optional',
        },
      ])

      const style = document.querySelector('head > style')
      expect(style?.textContent).toContain('font-display: optional')

      promise.catch(() => {})
    })

    it('includes unicode-range when provided', () => {
      const promise = loadFonts([
        {
          family: 'SubsetFont',
          src: '/fonts/subset.woff2',
          unicodeRange: 'U+0000-00FF',
        },
      ])

      const style = document.querySelector('head > style')
      expect(style?.textContent).toContain('unicode-range: U+0000-00FF')

      promise.catch(() => {})
    })
  })
})
