/**
 * Utilities for ShopReviews component.
 */

import { getJaFormatter } from '@/utils/date'
import type {
  ReviewAspectKey,
  ReviewAspects,
  ReviewItem,
  ReviewDisplay,
  HighlightedReview,
  ReviewFormState,
} from './shopReviewsTypes'

export const ASPECT_LABELS: Record<ReviewAspectKey, { label: string; help: string }> = {
  therapist_service: {
    label: 'セラピストの接客',
    help: '施術の丁寧さや気配りなど',
  },
  staff_response: {
    label: 'スタッフ・受付の対応',
    help: '予約〜受付の説明や案内の印象',
  },
  room_cleanliness: {
    label: 'ルームの清潔さ',
    help: 'シャワーや備品の整頓・衛生面',
  },
}

export const STAR_SYMBOL_FULL = '★'
export const STAR_SYMBOL_EMPTY = '☆'
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const visitedDateFormatter = getJaFormatter('dateNumeric')

export function toDisplayKey(prefix: string, unique?: string | null, fallback?: number) {
  if (unique && unique.length > 0) return `${prefix}-${unique}`
  return `${prefix}-fallback-${fallback ?? Date.now()}`
}

export function formatVisitedLabel(input?: string | null) {
  if (!input) return null
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  return visitedDateFormatter.format(date)
}

export function starLabel(score: number) {
  const safe = Math.min(5, Math.max(0, Math.round(score)))
  return `${STAR_SYMBOL_FULL.repeat(safe)}${STAR_SYMBOL_EMPTY.repeat(5 - safe)}`
}

export function normaliseAspectEntries(aspects?: ReviewAspects | null) {
  if (!aspects) return []
  return (Object.keys(aspects) as ReviewAspectKey[])
    .filter((key) => aspects[key]?.score)
    .map((key) => ({
      key,
      score: aspects[key]?.score ?? 0,
      note: aspects[key]?.note ?? null,
    }))
}

export function transformReviewItem(item: ReviewItem): ReviewDisplay {
  return {
    key: toDisplayKey('item', item.id),
    title: item.title,
    body: item.body,
    score: item.score,
    author: item.author_alias ?? null,
    visitedAt: item.visited_at ?? null,
    status: item.status,
    submittedAt: item.created_at,
    aspects: item.aspects ?? null,
  }
}

export function transformHighlight(item: HighlightedReview, index: number): ReviewDisplay {
  return {
    key: toDisplayKey('highlight', item.review_id ?? undefined, index),
    title: item.title,
    body: item.body,
    score: item.score,
    author: item.author_alias ?? null,
    visitedAt: item.visited_at ?? null,
    status: 'highlight',
    aspects: item.aspects ?? null,
  }
}

export function buildInitialForm(): ReviewFormState {
  return {
    score: 5,
    title: '',
    body: '',
    authorAlias: '',
    visitedAt: '',
    aspects: {
      therapist_service: { score: null, note: '' },
      staff_response: { score: null, note: '' },
      room_cleanliness: { score: null, note: '' },
    },
  }
}
