import './globals.css'
import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { Noto_Sans_JP } from 'next/font/google'

import SiteHeaderNav from '@/components/SiteHeaderNav'
import AnalyticsProvider from '@/components/AnalyticsProvider'
import ReservationOverlayRoot from '@/components/ReservationOverlayRoot'
import SkipLinks from '@/components/SkipLinks'
import PerformanceInitializer from '@/components/PerformanceInitializer'
import PWAProvider from '@/components/PWAProvider'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FF6B6B',
}

export const metadata: Metadata = {
  title: '大阪メンエス.com',
  description: '探しやすい・誤解しない・速い',
  openGraph: {
    title: '大阪メンエス.com - 大阪エリアのメンズエステ検索',
    description: '探しやすい・誤解しない・速い。大阪エリアのメンズエステ・セラピスト検索ポータルサイト',
    url: 'https://osakamenesu.com',
    siteName: '大阪メンエス.com',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '大阪メンエス.com',
    description: '探しやすい・誤解しない・速い。大阪エリアのメンズエステ検索',
  },
}

// Use Google Fonts for optimized font loading with automatic subsetting
const brandFont = Noto_Sans_JP({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
  fallback: ['Hiragino Kaku Gothic ProN', 'Meiryo', 'sans-serif'],
})

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body
        className={`${brandFont.variable} min-h-screen bg-neutral-surfaceAlt text-neutral-text font-sans`}
      >
        <SkipLinks />
        <AnalyticsProvider />
        <PerformanceInitializer />
        <PWAProvider />
        <header className="sticky top-0 z-30 border-b border-white/30 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 lg:px-6">
            <Link href="/" className="group inline-flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-lg text-white shadow-lg shadow-brand-primary/40 transition duration-300 group-hover:shadow-brand-primary/50">
                ✦
              </span>
              <span className="text-lg font-semibold tracking-tight text-transparent bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text">
                大阪メンエス.com
              </span>
            </Link>
            <SiteHeaderNav />
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <ReservationOverlayRoot />
        <footer className="relative mt-16 border-t border-white/30 bg-white/90 py-16 backdrop-blur">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#ecfeff_0%,rgba(236,254,255,0)_70%),linear-gradient(180deg,rgba(236,254,255,0.8)_0%,rgba(249,250,251,0.2)_100%)]" />
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-xl text-white shadow-lg shadow-brand-primary/40">
              ✦
            </span>
            <p className="text-2xl font-semibold tracking-tight text-transparent bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text">
              大阪メンエス.com
            </p>
            <p className="text-sm text-neutral-textMuted">
              大阪エリアのメンズエステ・セラピスト検索ポータルサイト
            </p>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/60 bg-gradient-to-r from-[#EFF6FF] to-[#ECFEFF] px-6 py-3 text-xs font-medium text-neutral-text shadow-sm shadow-brand-primary/10">
              <span aria-hidden>©</span>
              <span>{new Date().getFullYear()} 大阪メンエス.com All rights reserved.</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
