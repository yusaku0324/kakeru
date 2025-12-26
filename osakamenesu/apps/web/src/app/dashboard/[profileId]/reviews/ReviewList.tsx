'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import clsx from 'clsx'

import type { ReviewItem, ReviewStatus } from '@/features/reviews'
import { updateDashboardReviewStatus } from '@/features/reviews'

type Props = {
  profileId: string
  reviews: ReviewItem[]
  total: number
  currentPage: number
  currentStatus?: ReviewStatus
}

const STATUS_CONFIG: Record<ReviewStatus, { label: string; icon: string; color: string; bgColor: string }> = {
  pending: {
    label: '承認待ち',
    icon: '⏳',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
  },
  published: {
    label: '公開中',
    icon: '✅',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200',
  },
  rejected: {
    label: '非公開',
    icon: '🚫',
    color: 'text-neutral-600',
    bgColor: 'bg-neutral-50 border-neutral-200',
  },
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
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={clsx(
            'h-5 w-5 transition-colors',
            star <= score ? 'text-amber-400' : 'text-neutral-200'
          )}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1.5 text-sm font-semibold text-neutral-700">{score}.0</span>
    </div>
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
  const status = STATUS_CONFIG[review.status]

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
    <div
      className={clsx(
        'group overflow-hidden rounded-2xl border bg-white transition-all hover:shadow-lg',
        status.bgColor
      )}
    >
      {/* Header */}
      <div className="border-b border-neutral-100/50 bg-white/50 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 text-lg font-semibold text-brand-primary">
              {review.author_alias?.charAt(0) || '匿'}
            </div>
            <div>
              <div className="font-medium text-neutral-900">
                {review.author_alias || '匿名'}
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span>投稿: {formatDate(review.created_at)}</span>
                {review.visited_at && (
                  <>
                    <span className="text-neutral-300">|</span>
                    <span>来店: {formatDate(review.visited_at)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status badge */}
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
              status.color,
              status.bgColor
            )}
          >
            <span>{status.icon}</span>
            {status.label}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="mb-3 flex items-center gap-3">
          <StarRating score={review.score} />
        </div>

        {review.title && (
          <h3 className="mb-2 text-lg font-semibold text-neutral-900">{review.title}</h3>
        )}

        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
          {review.body}
        </p>
      </div>

      {/* Actions */}
      <div className="border-t border-neutral-100/50 bg-white/50 px-5 py-3">
        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {review.status !== 'published' && (
            <button
              onClick={() => handleStatusChange('published')}
              disabled={isPending}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all',
                'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
                'hover:shadow-lg hover:shadow-emerald-500/25',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {isPending ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span>承認して公開</span>
            </button>
          )}
          {review.status !== 'rejected' && (
            <button
              onClick={() => handleStatusChange('rejected')}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-all hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span>非公開にする</span>
            </button>
          )}
          {review.status === 'rejected' && (
            <button
              onClick={() => handleStatusChange('pending')}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-all hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>承認待ちに戻す</span>
            </button>
          )}
        </div>
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

  // Calculate stats
  const stats = {
    pending: initialReviews.filter((r) => r.status === 'pending').length,
    published: initialReviews.filter((r) => r.status === 'published').length,
    rejected: initialReviews.filter((r) => r.status === 'rejected').length,
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">口コミ管理</h2>
        <p className="text-sm text-neutral-500">お客様からの口コミを確認・管理します</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <div
            key={key}
            className={clsx(
              'rounded-2xl border p-4 transition-all hover:shadow-md',
              config.bgColor
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{config.icon}</span>
              <div>
                <div className="text-2xl font-bold text-neutral-900">
                  {stats[key as keyof typeof stats]}
                </div>
                <div className={clsx('text-sm font-medium', config.color)}>
                  {config.label}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white px-6 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            フィルター
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 p-4">
          <Link
            href={buildUrl({})}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all',
              !currentStatus
                ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-lg shadow-brand-primary/25'
                : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
            )}
          >
            すべて
          </Link>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <Link
              key={key}
              href={buildUrl({ status: key })}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all',
                currentStatus === key
                  ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-lg shadow-brand-primary/25'
                  : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
              )}
            >
              <span>{config.icon}</span>
              {config.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      {reviews.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-200">
            <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-neutral-700">
            {currentStatus
              ? `${STATUS_CONFIG[currentStatus].label}の口コミはありません`
              : '口コミがありません'}
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            お客様からの口コミが投稿されるとここに表示されます
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={buildUrl({ status: currentStatus, page: currentPage - 1 })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-all hover:bg-neutral-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              前へ
            </Link>
          )}

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }

              return (
                <Link
                  key={pageNum}
                  href={buildUrl({ status: currentStatus, page: pageNum })}
                  className={clsx(
                    'flex h-10 w-10 items-center justify-center rounded-xl text-sm font-medium transition-all',
                    currentPage === pageNum
                      ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-lg shadow-brand-primary/25'
                      : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  )}
                >
                  {pageNum}
                </Link>
              )
            })}
          </div>

          {currentPage < totalPages && (
            <Link
              href={buildUrl({ status: currentStatus, page: currentPage + 1 })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-all hover:bg-neutral-50"
            >
              次へ
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      )}

      {/* Page info */}
      <p className="text-center text-sm text-neutral-500">
        全 {total} 件中 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, total)} 件を表示
      </p>
    </section>
  )
}
