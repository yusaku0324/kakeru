import './globals.css'
import type { ReactNode } from 'react'
import Script from 'next/script'
import localFont from 'next/font/local'

import SiteHeaderNav from '@/components/SiteHeaderNav'

export const metadata = {
  title: '大阪メンエス.com',
  description: '探しやすい・誤解しない・速い',
}

const brandFont = localFont({
  src: [
    { path: '../../public/fonts/NotoSansJP-400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/NotoSansJP-500.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/NotoSansJP-600.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/NotoSansJP-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
  fallback: ['Hiragino Kaku Gothic ProN', 'Meiryo', 'sans-serif'],
})

export default function RootLayout({ children }: { children: ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  return (
    <html lang="ja">
      <head>
        {gaId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script
              id="ga-init"
              strategy="afterInteractive"
            >{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', { anonymize_ip: true });
            `}</Script>
          </>
        ) : null}
      </head>
      <body className={`${brandFont.variable} min-h-screen bg-neutral-surfaceAlt text-neutral-text font-sans`}>
        <header className="sticky top-0 z-30 border-b border-neutral-borderLight bg-neutral-surface/90 backdrop-blur supports-[backdrop-filter]:bg-neutral-surface/70">
          <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4">
            <a href="/" className="font-bold text-lg tracking-tight text-neutral-text">大阪メンエス.com</a>
            <SiteHeaderNav />
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}
