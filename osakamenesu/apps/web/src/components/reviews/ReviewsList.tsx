'use client'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ASPECT_LABELS, normaliseAspectEntries, formatVisitedLabel } from '@/features/reviews'
import type { ReviewDisplay } from '@/features/reviews'

type Props = {
  reviews: ReviewDisplay[]
  isLoading: boolean
  hasMore: boolean
  onLoadMore: () => void
}

export function ReviewsList({ reviews, isLoading, hasMore, onLoadMore }: Props) {
  if (!reviews.length) {
    if (isLoading) {
      return (
        <Card className="p-4 text-sm text-neutral-textMuted">口コミを読み込み中です…</Card>
      )
    }
    return (
      <Card className="p-4 text-sm text-neutral-textMuted">
        まだ口コミはありません。最初のレビューを投稿してみませんか？
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => {
        const aspects = normaliseAspectEntries(review.aspects)
        const visited = formatVisitedLabel(review.visitedAt)
        return (
          <Card key={review.key} className="space-y-3 p-4" data-testid="review-item">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="success">{review.score}★</Badge>
                  {review.title ? (
                    <span className="text-sm font-semibold text-neutral-text">
                      {review.title}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-neutral-textMuted whitespace-pre-line">
                  {review.body}
                </p>
              </div>
              <div className="text-right text-xs text-neutral-textMuted">
                {review.author || visited ? (
                  <div className="space-y-1">
                    {review.author ? <div>{review.author}</div> : null}
                    {visited ? <div>来店日: {visited}</div> : null}
                  </div>
                ) : null}
              </div>
            </div>
            {aspects.length ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {aspects.map((aspect) => (
                  <span
                    key={`${review.key}-${aspect.key}`}
                    className="inline-flex items-center gap-1 rounded-badge bg-brand-primary/10 px-2 py-1 text-brand-primaryDark"
                  >
                    <span>{ASPECT_LABELS[aspect.key].label}</span>
                    <span className="font-semibold">{aspect.score}★</span>
                    {aspect.note ? (
                      <span className="text-neutral-textMuted">({aspect.note})</span>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null}
            {review.status === 'pending' ? (
              <p className="text-xs text-amber-600">
                店舗での確認後に掲載されます。反映まで少し時間がかかる場合があります。
              </p>
            ) : null}
          </Card>
        )
      })}

      {hasMore ? (
        <button
          type="button"
          className="w-full rounded-badge border border-brand-primary/30 bg-white px-4 py-2 text-sm font-semibold text-brand-primaryDark hover:bg-brand-primary/5 disabled:opacity-60"
          onClick={onLoadMore}
          disabled={isLoading}
        >
          {isLoading ? '読み込み中…' : 'さらに口コミを読み込む'}
        </button>
      ) : null}
    </div>
  )
}
