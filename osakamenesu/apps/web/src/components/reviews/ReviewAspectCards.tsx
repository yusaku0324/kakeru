'use client'

import { Card } from '@/components/ui/Card'
import { ASPECT_LABELS, starLabel } from '@/features/reviews'
import type { ReviewAspectKey } from '@/features/reviews'

type AspectEntry = {
  key: ReviewAspectKey
  label: string
  help: string
  average: number | null
  count: number | null
}

type Props = {
  aspectAverages?: Partial<Record<ReviewAspectKey, number>>
  aspectCounts?: Partial<Record<ReviewAspectKey, number>>
}

export function ReviewAspectCards({ aspectAverages, aspectCounts }: Props) {
  const aspectEntries: AspectEntry[] = (Object.keys(ASPECT_LABELS) as ReviewAspectKey[])
    .map((key) => ({
      key,
      label: ASPECT_LABELS[key].label,
      help: ASPECT_LABELS[key].help,
      average: aspectAverages?.[key] ?? null,
      count: aspectCounts?.[key] ?? null,
    }))
    .filter((item) => item.average != null || item.count != null)

  if (!aspectEntries.length) return null

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {aspectEntries.map((item) => (
        <Card key={item.key} className="space-y-2 p-4" data-testid="review-aspect-card">
          <div className="text-sm font-semibold text-neutral-text">{item.label}</div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-semibold text-brand-primaryDark">
              {item.average != null ? item.average.toFixed(1) : '-'}
            </div>
            {item.average != null ? (
              <span className="text-sm text-neutral-textMuted">{starLabel(item.average)}</span>
            ) : null}
          </div>
          <div className="text-xs text-neutral-textMuted">
            {item.count ? `${item.count}件の評価` : 'まだ評価がありません'}
          </div>
          <p className="text-xs text-neutral-textMuted">{item.help}</p>
        </Card>
      ))}
    </div>
  )
}
