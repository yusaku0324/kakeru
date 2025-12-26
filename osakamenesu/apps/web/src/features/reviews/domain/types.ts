/**
 * Reviews Domain Types
 *
 * 垂直スライスアーキテクチャ: 口コミ機能の型定義
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * レビューのステータス
 */
export type ReviewStatus = 'pending' | 'published' | 'rejected'

/**
 * レビュー観点のキー
 */
export type ReviewAspectKey = 'therapist_service' | 'staff_response' | 'room_cleanliness'

/**
 * レビュー観点のスコアとメモ
 */
export type ReviewAspect = {
  score: number
  note?: string | null
}

/**
 * レビュー観点のマップ
 */
export type ReviewAspects = Partial<Record<ReviewAspectKey, ReviewAspect>>

// =============================================================================
// Review Item Types
// =============================================================================

/**
 * レビューアイテム（API レスポンス形式）
 */
export type ReviewItem = {
  id: string
  profile_id: string
  status: ReviewStatus
  score: number
  title?: string | null
  body: string
  author_alias?: string | null
  visited_at?: string | null
  created_at: string
  updated_at: string
  aspects?: ReviewAspects | null
}

/**
 * ハイライトされたレビュー
 */
export type HighlightedReview = {
  review_id?: string | null
  title: string
  body: string
  score: number
  visited_at?: string | null
  author_alias?: string | null
  aspects?: ReviewAspects | null
}

/**
 * レビュー表示用（UIコンポーネント向け）
 */
export type ReviewDisplay = {
  key: string
  title?: string | null
  body: string
  score: number
  author?: string | null
  visitedAt?: string | null
  status?: ReviewStatus | 'highlight'
  submittedAt?: string | null
  aspects?: ReviewAspects | null
}

// =============================================================================
// Summary & Stats Types
// =============================================================================

/**
 * レビューサマリー（店舗詳細等で使用）
 */
export type ReviewSummary = {
  average_score?: number | null
  review_count?: number | null
  highlighted?: HighlightedReview[] | null
  aspect_averages?: Partial<Record<ReviewAspectKey, number>> | null
  aspect_counts?: Partial<Record<ReviewAspectKey, number>> | null
}

/**
 * レビュー統計（ダッシュボード用）
 */
export type ReviewStats = {
  total: number
  pending: number
  published: number
  rejected: number
  average_score: number | null
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * レビューリストAPIレスポンス
 */
export type ReviewListResponse = {
  total: number
  items: ReviewItem[]
  aspect_averages?: Partial<Record<ReviewAspectKey, number>>
  aspect_counts?: Partial<Record<ReviewAspectKey, number>>
}

// =============================================================================
// Form Types
// =============================================================================

/**
 * レビューフォームの状態
 */
export type ReviewFormState = {
  score: number
  title: string
  body: string
  authorAlias: string
  visitedAt: string
  aspects: Record<ReviewAspectKey, { score: number | null; note: string }>
}

/**
 * 認証状態
 */
export type AuthState = 'checking' | 'guest' | 'authenticated'

// =============================================================================
// Dashboard API Types
// =============================================================================

/**
 * ダッシュボードAPIリクエストオプション
 */
export type DashboardReviewsRequestOptions = {
  cookieHeader?: string
  signal?: AbortSignal
  cache?: RequestCache
}

/**
 * ダッシュボードAPI結果: 成功
 */
export type DashboardReviewsSuccess<T> = {
  status: 'success'
  data: T
}

/**
 * ダッシュボードAPI結果: 未認証
 */
export type DashboardReviewsUnauthenticated = {
  status: 'unauthorized'
}

/**
 * ダッシュボードAPI結果: 権限なし
 */
export type DashboardReviewsForbidden = {
  status: 'forbidden'
  detail: string
}

/**
 * ダッシュボードAPI結果: 見つからない
 */
export type DashboardReviewsNotFound = {
  status: 'not_found'
}

/**
 * ダッシュボードAPI結果: エラー
 */
export type DashboardReviewsError = {
  status: 'error'
  message: string
}

/**
 * ダッシュボードAPI結果: リスト取得
 */
export type DashboardReviewsListResult =
  | DashboardReviewsSuccess<ReviewListResponse>
  | DashboardReviewsUnauthenticated
  | DashboardReviewsForbidden
  | DashboardReviewsNotFound
  | DashboardReviewsError

/**
 * ダッシュボードAPI結果: 統計取得
 */
export type DashboardReviewsStatsResult =
  | DashboardReviewsSuccess<ReviewStats>
  | DashboardReviewsUnauthenticated
  | DashboardReviewsForbidden
  | DashboardReviewsNotFound
  | DashboardReviewsError

/**
 * ダッシュボードAPI結果: アイテム操作
 */
export type DashboardReviewsItemResult =
  | DashboardReviewsSuccess<ReviewItem>
  | DashboardReviewsUnauthenticated
  | DashboardReviewsForbidden
  | DashboardReviewsNotFound
  | DashboardReviewsError
