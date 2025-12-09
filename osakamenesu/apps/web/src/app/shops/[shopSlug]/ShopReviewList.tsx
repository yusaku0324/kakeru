'use client'

import { useState, useEffect, useCallback } from 'react'

type ReviewItem = {
  id: string
  profile_id: string
  status: string
  score: number
  title: string | null
  body: string
  author_alias: string | null
  visited_at: string | null
  created_at: string
}

type ReviewListResponse = {
  total: number
  items: ReviewItem[]
}

type SortOption = 'newest' | 'highest' | 'lowest'

const SORT_LABELS: Record<SortOption, string> = {
  newest: '新着順',
  highest: '評価高い順',
  lowest: '評価低い順',
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
    <span className="text-yellow-500 text-sm">
      {'★'.repeat(score)}
      {'☆'.repeat(5 - score)}
    </span>
  )
}

type Props = {
  shopId: string
  initialReviewCount?: number
}

export function ShopReviewList({ shopId, initialReviewCount = 0 }: Props) {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [total, setTotal] = useState(initialReviewCount)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [expanded, setExpanded] = useState(false)
  const pageSize = 5

  const fetchReviews = useCallback(async (pageNum: number, sort: SortOption) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        page_size: String(pageSize),
        sort_by: sort,
      })
      const resp = await fetch(`/api/v1/shops/${shopId}/reviews?${params}`)
      if (!resp.ok) {
        throw new Error('口コミの取得に失敗しました')
      }
      const data: ReviewListResponse = await resp.json()
      setReviews(data.items)
      setTotal(data.total)
    } catch (e) {
      console.error('Failed to fetch reviews', e)
      setError('口コミの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    if (expanded) {
      fetchReviews(page, sortBy)
    }
  }, [expanded, page, sortBy, fetchReviews])

  const totalPages = Math.ceil(total / pageSize)

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort)
    setPage(1)
  }

  if (total === 0 && !expanded) {
    return null
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-text">
          口コミ ({total}件)
        </h2>
        {!expanded && total > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="text-sm text-brand-primary underline"
          >
            すべて見る
          </button>
        )}
      </div>

      {expanded && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {(['newest', 'highest', 'lowest'] as const).map((option) => (
              <button
                key={option}
                onClick={() => handleSortChange(option)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  sortBy === option
                    ? 'bg-neutral-900 text-white'
                    : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {SORT_LABELS[option]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-4 text-center text-neutral-textMuted">読み込み中...</div>
          ) : error ? (
            <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
              {error}
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-neutral-textMuted">
              口コミはまだありません
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-lg border border-neutral-borderLight bg-white p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <StarRating score={review.score} />
                    <span className="text-xs text-neutral-textMuted">
                      {formatDate(review.created_at)}
                    </span>
                  </div>
                  {review.title && (
                    <h3 className="font-medium text-neutral-text">{review.title}</h3>
                  )}
                  <p className="whitespace-pre-wrap text-sm text-neutral-textMuted">
                    {review.body}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <span>{review.author_alias || '匿名'}</span>
                    {review.visited_at && (
                      <span>来店日: {formatDate(review.visited_at)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              {page > 1 && (
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={loading}
                  className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  前へ
                </button>
              )}
              <span className="text-sm text-neutral-textMuted">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={loading}
                  className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  次へ
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => setExpanded(false)}
            className="text-sm text-neutral-textMuted hover:text-neutral-text"
          >
            閉じる
          </button>
        </>
      )}
    </section>
  )
}
