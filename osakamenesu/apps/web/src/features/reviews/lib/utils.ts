/**
 * Reviews Utilities
 *
 * 垂直スライスアーキテクチャ: 口コミ機能のユーティリティ
 */

import { getJaFormatter } from '@/utils/date'
import type {
  ReviewAspectKey,
  ReviewAspects,
  ReviewItem,
  ReviewDisplay,
  HighlightedReview,
  ReviewFormState,
} from '../domain/types'

// =============================================================================
// Constants
// =============================================================================

/**
 * レビュー観点のラベルとヘルプテキスト
 */
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

// =============================================================================
// Formatters
// =============================================================================

const visitedDateFormatter = getJaFormatter('dateNumeric')

/**
 * 表示用キーを生成
 */
export function toDisplayKey(prefix: string, unique?: string | null, fallback?: number): string {
  if (unique && unique.length > 0) return `${prefix}-${unique}`
  return `${prefix}-fallback-${fallback ?? Date.now()}`
}

/**
 * 訪問日を表示用にフォーマット
 */
export function formatVisitedLabel(input?: string | null): string | null {
  if (!input) return null
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  return visitedDateFormatter.format(date)
}

/**
 * スコアを星マークに変換
 */
export function starLabel(score: number): string {
  const safe = Math.min(5, Math.max(0, Math.round(score)))
  return `${STAR_SYMBOL_FULL.repeat(safe)}${STAR_SYMBOL_EMPTY.repeat(5 - safe)}`
}

// =============================================================================
// Data Transformers
// =============================================================================

/**
 * レビュー観点を正規化して配列に変換
 */
export function normaliseAspectEntries(
  aspects?: ReviewAspects | null,
): Array<{ key: ReviewAspectKey; score: number; note: string | null }> {
  if (!aspects) return []
  return (Object.keys(aspects) as ReviewAspectKey[])
    .filter((key) => aspects[key]?.score)
    .map((key) => ({
      key,
      score: aspects[key]?.score ?? 0,
      note: aspects[key]?.note ?? null,
    }))
}

/**
 * ReviewItem を ReviewDisplay に変換
 */
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

/**
 * HighlightedReview を ReviewDisplay に変換
 */
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

// =============================================================================
// Form Helpers
// =============================================================================

/**
 * レビューフォームの初期状態を生成
 */
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
