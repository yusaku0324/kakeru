/**
 * Font optimization utilities
 *
 * Implements font loading strategies for better performance:
 * - Font subsetting
 * - Preloading critical fonts
 * - FOIT/FOUT prevention
 * - Variable fonts support
 */

// Font face observer for controlled font loading
class FontFaceObserverLight {
  private family: string
  private weight?: string | number
  private style?: string

  constructor(
    family: string,
    descriptors?: { weight?: string | number; style?: string }
  ) {
    this.family = family
    this.weight = descriptors?.weight
    this.style = descriptors?.style
  }

  async load(timeout = 3000): Promise<void> {
    // Use native Font Loading API if available (widely supported)
    if ('fonts' in document) {
      const fontString = `${this.style || 'normal'} ${this.weight || 'normal'} 16px "${this.family}"`
      try {
        await Promise.race([
          document.fonts.load(fontString),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Font loading timeout: ${this.family}`)), timeout)
          ),
        ])
        return
      } catch {
        // Font loading failed or timed out - gracefully resolve
        // The fallback font will be used instead
        return
      }
    }

    // Fallback for older browsers
    const startTime = Date.now()

    // Create a test element
    const testString = 'BESbswy' // Characters with distinct widths
    const doc = globalThis.document as Document
    const testElement = doc.createElement('span')
    testElement.innerHTML = testString
    testElement.style.position = 'absolute'
    testElement.style.left = '-9999px'
    testElement.style.fontSize = '100px'
    testElement.style.fontFamily = `"${this.family}", serif`

    if (this.weight) {
      testElement.style.fontWeight = String(this.weight)
    }
    if (this.style) {
      testElement.style.fontStyle = this.style
    }

    doc.body.appendChild(testElement)

    // Get initial width
    const initialWidth = testElement.offsetWidth

    // Check if font has loaded
    return new Promise((resolve) => {
      const checkInterval = 50

      const check = () => {
        if (Date.now() - startTime > timeout) {
          doc.body.removeChild(testElement)
          // Gracefully resolve instead of rejecting - fallback font will be used
          resolve()
          return
        }

        if (testElement.offsetWidth !== initialWidth) {
          doc.body.removeChild(testElement)
          resolve()
          return
        }

        setTimeout(check, checkInterval)
      }

      check()
    })
  }
}

/**
 * Optimized font loading with fallbacks
 */
export async function loadFonts(
  fonts: Array<{
    family: string
    src: string | string[]
    weight?: string | number
    style?: string
    display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional'
    unicodeRange?: string
    preload?: boolean
  }>,
  options?: {
    timeout?: number
    onFontLoad?: (font: string) => void
    onError?: (error: Error) => void
  }
): Promise<void> {
  const { timeout = 3000, onFontLoad, onError } = options || {}

  // Preload critical fonts
  fonts.filter(font => font.preload).forEach(font => {
    const sources = Array.isArray(font.src) ? font.src : [font.src]
    sources.forEach(src => {
      if (src.endsWith('.woff2')) {
        const link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'font'
        link.type = 'font/woff2'
        link.href = src
        link.crossOrigin = 'anonymous'
        document.head.appendChild(link)
      }
    })
  })

  // Create @font-face rules
  const fontFaceRules = fonts.map(font => {
    const sources = Array.isArray(font.src) ? font.src : [font.src]
    const srcDeclarations = sources
      .map(src => {
        if (src.endsWith('.woff2')) return `url('${src}') format('woff2')`
        if (src.endsWith('.woff')) return `url('${src}') format('woff')`
        if (src.endsWith('.ttf')) return `url('${src}') format('truetype')`
        if (src.endsWith('.otf')) return `url('${src}') format('opentype')`
        return `url('${src}')`
      })
      .join(', ')

    return `
      @font-face {
        font-family: '${font.family}';
        src: ${srcDeclarations};
        font-weight: ${font.weight || 'normal'};
        font-style: ${font.style || 'normal'};
        font-display: ${font.display || 'swap'};
        ${font.unicodeRange ? `unicode-range: ${font.unicodeRange};` : ''}
      }
    `
  }).join('\n')

  // Inject font-face rules
  const style = document.createElement('style')
  style.textContent = fontFaceRules
  document.head.appendChild(style)

  // Load fonts with observer
  const loadPromises = fonts.map(async font => {
    try {
      const observer = new FontFaceObserverLight(font.family, {
        weight: font.weight,
        style: font.style,
      })

      await observer.load(timeout)

      // Add loaded class for CSS hooks (replace spaces with hyphens for valid class names)
      document.documentElement.classList.add(`font-${font.family.toLowerCase().replace(/\s+/g, '-')}-loaded`)

      onFontLoad?.(font.family)
    } catch (error) {
      // Silently handle font loading failures - fallback font will be used
      // Only call onError callback if provided, don't log to console
      onError?.(error as Error)

      // Add fallback class (replace spaces with hyphens for valid class names)
      document.documentElement.classList.add(`font-${font.family.toLowerCase().replace(/\s+/g, '-')}-fallback`)
    }
  })

  await Promise.all(loadPromises)
}

/**
 * Japanese font optimization
 * Uses font subsetting for better performance
 */
export function getJapaneseFontSubsets(): {
  hiragana: string
  katakana: string
  basicKanji: string
  punctuation: string
} {
  return {
    // Hiragana
    hiragana: 'U+3040-309F',
    // Katakana
    katakana: 'U+30A0-30FF',
    // Basic Kanji (JIS Level 1)
    basicKanji: 'U+4E00-9FAF',
    // Japanese punctuation
    punctuation: 'U+3000-303F',
  }
}

/**
 * Generate optimized font-face declarations for Japanese
 */
export function generateJapaneseFontFace(options: {
  family: string
  baseUrl: string
  weights?: Array<100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900>
}): string {
  const { family, baseUrl, weights = [400, 700] } = options
  const subsets = getJapaneseFontSubsets()

  return weights
    .map(
      weight => `
    @font-face {
      font-family: '${family}';
      font-weight: ${weight};
      font-display: swap;
      src: url('${baseUrl}/${weight}-hiragana.woff2') format('woff2');
      unicode-range: ${subsets.hiragana};
    }
    @font-face {
      font-family: '${family}';
      font-weight: ${weight};
      font-display: swap;
      src: url('${baseUrl}/${weight}-katakana.woff2') format('woff2');
      unicode-range: ${subsets.katakana};
    }
    @font-face {
      font-family: '${family}';
      font-weight: ${weight};
      font-display: swap;
      src: url('${baseUrl}/${weight}-kanji.woff2') format('woff2');
      unicode-range: ${subsets.basicKanji};
    }
  `
    )
    .join('\n')
}

/**
 * Variable font loader
 */
export function loadVariableFont(options: {
  family: string
  src: string
  weights?: { min: number; max: number }
  preload?: boolean
}): void {
  const { family, src, weights = { min: 100, max: 900 }, preload } = options

  // Preload if needed
  if (preload) {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'font'
    link.type = 'font/woff2'
    link.href = src
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  }

  // Create variable font face
  const fontFace = `
    @font-face {
      font-family: '${family}';
      src: url('${src}') format('woff2-variations');
      font-weight: ${weights.min} ${weights.max};
      font-display: swap;
    }
  `

  const style = document.createElement('style')
  style.textContent = fontFace
  document.head.appendChild(style)
}

/**
 * System font stack for fastest loading
 */
export const systemFontStack = {
  sansSerif: [
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    '"Noto Sans"',
    'sans-serif',
    '"Apple Color Emoji"',
    '"Segoe UI Emoji"',
    '"Segoe UI Symbol"',
    '"Noto Color Emoji"',
  ].join(', '),

  serif: [
    'Georgia',
    'Cambria',
    '"Times New Roman"',
    'Times',
    'serif',
  ].join(', '),

  monospace: [
    'Menlo',
    'Monaco',
    'Consolas',
    '"Liberation Mono"',
    '"Courier New"',
    'monospace',
  ].join(', '),

  // Japanese-optimized stack
  japanese: [
    '"Hiragino Sans"',
    '"Hiragino Kaku Gothic ProN"',
    '"Yu Gothic"',
    'YuGothic',
    '"Meiryo"',
    '"MS PGothic"',
    'sans-serif',
  ].join(', '),
}

/**
 * Font loading strategy based on connection speed
 */
export async function adaptiveFontLoading(): Promise<void> {
  if (!('connection' in navigator)) {
    // Load all fonts if API not available
    return
  }

  const connection = (navigator as any).connection
  const effectiveType = connection.effectiveType
  const saveData = connection.saveData

  // Skip custom fonts on slow connections or save data mode
  if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
    document.documentElement.classList.add('system-fonts-only')
    return
  }

  // Load subset fonts on 3G
  if (effectiveType === '3g') {
    document.documentElement.classList.add('subset-fonts')
    // Load only essential font weights
    await loadFonts([
      {
        family: 'Noto Sans JP',
        src: '/fonts/NotoSansJP-400.woff2',
        weight: 400,
        preload: true,
      },
    ])
    return
  }

  // Load all fonts on 4G or better
  document.documentElement.classList.add('all-fonts')
  await loadFonts([
    {
      family: 'Noto Sans JP',
      src: '/fonts/NotoSansJP-400.woff2',
      weight: 400,
      preload: true,
    },
    {
      family: 'Noto Sans JP',
      src: '/fonts/NotoSansJP-700.woff2',
      weight: 700,
      preload: false,
    },
  ])
}

/**
 * CSS for font loading states
 */
export const fontLoadingCSS = `
  /* Default state - use system fonts */
  body {
    font-family: ${systemFontStack.sansSerif};
  }

  /* When custom font loads */
  .font-noto-sans-jp-loaded body {
    font-family: 'Noto Sans JP', ${systemFontStack.sansSerif};
  }

  /* Japanese text optimization */
  :lang(ja) {
    font-family: ${systemFontStack.japanese};
    font-feature-settings: 'palt' 1; /* Proportional alternate widths */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Prevent FOIT (Flash of Invisible Text) */
  .font-loading {
    visibility: visible !important;
  }

  /* System fonts only mode (slow connection) */
  .system-fonts-only {
    font-family: ${systemFontStack.sansSerif} !important;
  }

  /* Variable font support */
  @supports (font-variation-settings: normal) {
    .variable-font {
      font-family: 'VariableFont', ${systemFontStack.sansSerif};
      font-variation-settings: 'wght' var(--font-weight, 400);
    }
  }
`
