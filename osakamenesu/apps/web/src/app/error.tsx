'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // Log error to Sentry if configured
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: { digest: error.digest },
      })
    }
    console.error('[Global Error]', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-4 text-6xl">😵</div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">
          予期しないエラーが発生しました
        </h2>
        <p className="mb-6 text-gray-600">
          ページの読み込み中に問題が発生しました。しばらく経ってからもう一度お試しください。
          {error.digest && (
            <span className="mt-2 block text-xs text-gray-400">
              エラーID: {error.digest}
            </span>
          )}
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={reset}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            再試行
          </button>
          <Link
            href="/"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            トップへ戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
