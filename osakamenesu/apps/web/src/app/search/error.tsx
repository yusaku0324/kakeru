'use client'

import Link from 'next/link'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function SearchError({ error, reset }: Props) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-4 text-5xl">🔍</div>
        <h2 className="mb-2 text-xl font-bold text-neutral-text">
          検索中にエラーが発生しました
        </h2>
        <p className="mb-6 text-neutral-textMuted">
          検索結果の取得に失敗しました。しばらく経ってからもう一度お試しください。
          {error.digest && (
            <span className="mt-2 block text-xs text-neutral-400">
              エラーID: {error.digest}
            </span>
          )}
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={reset}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 transition"
          >
            再試行
          </button>
          <Link
            href="/"
            className="rounded-lg border border-neutral-borderLight bg-white px-4 py-2 text-sm font-medium text-neutral-text hover:bg-neutral-50 transition"
          >
            トップへ戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
