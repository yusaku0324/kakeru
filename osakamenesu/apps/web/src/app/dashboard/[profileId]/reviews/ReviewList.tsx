'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import type { ReviewItem, ReviewStatus } from '@/lib/dashboard-reviews'
import { updateDashboardReviewStatus } from '@/lib/dashboard-reviews'

type Props = {
  profileId: string
  reviews: ReviewItem[]
  total: number
  currentPage: number
  currentStatus?: ReviewStatus
}

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: '承認待ち',
  published: '公開中',
  rejected: '非公開',
}

const STATUS_COLORS: Record<ReviewStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  published: 'bg-green-100 text-green-800',
  rejected: 'bg-neutral-100 text-neutral-600',
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function StarRating({ score }: { score: number }) {
  return (
    <span className="text-yellow-500">
      {'★'.repeat(score)}
      {'☆'.repeat(5 - score)}
    </span>
  )
}

function ReviewCard({
  review,
  profileId,
  onStatusChange,
}: {
  review: ReviewItem
  profileId: string
  onStatusChange: (reviewId: string, newStatus: ReviewStatus) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleStatusChange = (newStatus: ReviewStatus) => {
    setError(null)
    startTransition(async () => {
      const result = await updateDashboardReviewStatus(profileId, review.id, newStatus)
      if (result.status === 'success') {
        onStatusChange(review.id, newStatus)
      } else if (result.status === 'error') {
        setError(result.message)
      } else {
        setError('ステータスの更新に失敗しました')
      }
    })
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StarRating score={review.score} />
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[review.status]}`}
            >
              {STATUS_LABELS[review.status]}
            </span>
          </div>
          {review.title && (
            <h3 className="font-medium text-neutral-900">{review.title}</h3>
          )}
          <p className="whitespace-pre-wrap text-sm text-neutral-700">{review.body}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
            <span>{review.author_alias || '匿名'}</span>
            <span>投稿日: {formatDate(review.created_at)}</span>
            {review.visited_at && <span>来店日: {formatDate(review.visited_at)}</span>}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
        {review.status !== 'published' && (
          <button
            onClick={() => handleStatusChange('published')}
            disabled={isPending}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? '処理中...' : '承認して公開'}
          </button>
        )}
        {review.status !== 'rejected' && (
          <button
            onClick={() => handleStatusChange('rejected')}
            disabled={isPending}
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {isPending ? '処理中...' : '非公開にする'}
          </button>
        )}
        {review.status === 'rejected' && (
          <button
            onClick={() => handleStatusChange('pending')}
            disabled={isPending}
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {isPending ? '処理中...' : '承認待ちに戻す'}
          </button>
        )}
      </div>
    </div>
  )
}

export function ReviewList({
  profileId,
  reviews: initialReviews,
  total,
  currentPage,
  currentStatus,
}: Props) {
  const router = useRouter()
  const [reviews, setReviews] = useState(initialReviews)
  const pageSize = 20
  const totalPages = Math.ceil(total / pageSize)

  const handleStatusChange = (reviewId: string, newStatus: ReviewStatus) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, status: newStatus } : r)),
    )
  }

  const buildUrl = (params: { status?: string; page?: number }) => {
    const searchParams = new URLSearchParams()
    if (params.status) searchParams.set('status', params.status)
    if (params.page && params.page > 1) searchParams.set('page', String(params.page))
    const query = searchParams.toString()
    return `/dashboard/${profileId}/reviews${query ? `?${query}` : ''}`
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-600">フィルター:</span>
        <Link
          href={buildUrl({})}
          className={`rounded-full px-3 py-1 text-sm ${
            !currentStatus
              ? 'bg-neutral-900 text-white'
              : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          すべて
        </Link>
        {(['pending', 'published', 'rejected'] as const).map((status) => (
          <Link
            key={status}
            href={buildUrl({ status })}
            className={`rounded-full px-3 py-1 text-sm ${
              currentStatus === status
                ? 'bg-neutral-900 text-white'
                : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {STATUS_LABELS[status]}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-neutral-600">
          {currentStatus
            ? `${STATUS_LABELS[currentStatus]}の口コミはありません。`
            : '口コミはまだありません。'}
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              profileId={profileId}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {currentPage > 1 && (
            <Link
              href={buildUrl({ status: currentStatus, page: currentPage - 1 })}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              前へ
            </Link>
          )}
          <span className="text-sm text-neutral-600">
            {currentPage} / {totalPages} ページ
          </span>
          {currentPage < totalPages && (
            <Link
              href={buildUrl({ status: currentStatus, page: currentPage + 1 })}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              次へ
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
