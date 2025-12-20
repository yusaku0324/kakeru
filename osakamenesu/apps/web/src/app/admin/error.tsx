'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AdminError({ error, reset }: Props) {
  useEffect(() => {
    // Log error to Sentry if configured
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { section: 'admin' },
        extra: { digest: error.digest },
      })
    }
    // Also log to console for debugging
    console.error('[Admin Error]', error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-4 text-6xl">⚠️</div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">
          エラーが発生しました
        </h2>
        <p className="mb-6 text-gray-600">
          管理画面の読み込み中に問題が発生しました。
          {error.digest && (
            <span className="mt-2 block text-xs text-gray-400">
              エラーID: {error.digest}
            </span>
          )}
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={reset}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            再試行
          </button>
          <a
            href="/admin"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            ダッシュボードへ戻る
          </a>
        </div>
      </div>
    </div>
  )
}
