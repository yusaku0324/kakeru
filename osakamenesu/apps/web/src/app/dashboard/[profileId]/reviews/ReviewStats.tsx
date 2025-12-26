'use client'

import type { ReviewStats as ReviewStatsType } from '@/features/reviews'

type Props = {
  stats: ReviewStatsType
}

export function ReviewStats({ stats }: Props) {
  return (
    <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 text-center">
        <p className="text-2xl font-semibold text-neutral-900">{stats.total}</p>
        <p className="text-sm text-neutral-500">全口コミ</p>
      </div>
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
        <p className="text-2xl font-semibold text-yellow-700">{stats.pending}</p>
        <p className="text-sm text-yellow-600">承認待ち</p>
      </div>
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
        <p className="text-2xl font-semibold text-green-700">{stats.published}</p>
        <p className="text-sm text-green-600">公開中</p>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-center">
        <p className="text-2xl font-semibold text-neutral-700">
          {stats.average_score?.toFixed(1) ?? '-'}
        </p>
        <p className="text-sm text-neutral-500">平均評価</p>
      </div>
    </section>
  )
}
