'use client'

/**
 * Skip links for keyboard accessibility.
 * These links are visually hidden but appear on focus,
 * allowing keyboard users to skip directly to main content.
 */
export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only focus-within:fixed focus-within:left-4 focus-within:top-4 focus-within:z-50">
      <a
        href="#main-content"
        className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
        メインコンテンツへスキップ
      </a>
    </div>
  )
}

export default SkipLinks
