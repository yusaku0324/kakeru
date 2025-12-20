'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Global error boundary that catches errors in the root layout.
 * This is the last resort error handler.
 */
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { level: 'critical' },
        extra: { digest: error.digest },
      })
    }
    console.error('[Critical Error]', error)
  }, [error])

  return (
    <html lang="ja">
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚨</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              システムエラー
            </h1>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              申し訳ございません。システムエラーが発生しました。
            </p>
            <button
              onClick={reset}
              style={{
                backgroundColor: '#2563eb',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                marginRight: '0.5rem',
              }}
            >
              再試行
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error replaces entire HTML, Link unavailable */}
            <a
              href="/"
              style={{
                display: 'inline-block',
                backgroundColor: 'white',
                color: '#374151',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                textDecoration: 'none',
              }}
            >
              トップへ
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
