/**
 * Reviews Feature Module
 *
 * 垂直スライスアーキテクチャ: 口コミ機能
 *
 * Usage:
 * ```ts
 * import {
 *   ReviewItem,
 *   ReviewStatus,
 *   ASPECT_LABELS,
 *   starLabel,
 *   fetchDashboardReviews,
 * } from '@/features/reviews'
 * ```
 */

// =============================================================================
// Domain Types
// =============================================================================

export type {
  // Core Types
  ReviewStatus,
  ReviewAspectKey,
  ReviewAspect,
  ReviewAspects,
  // Review Item Types
  ReviewItem,
  HighlightedReview,
  ReviewDisplay,
  // Summary & Stats Types
  ReviewSummary,
  ReviewStats,
  ReviewListResponse,
  // Form Types
  ReviewFormState,
  AuthState,
  // Dashboard API Types
  DashboardReviewsRequestOptions,
  DashboardReviewsSuccess,
  DashboardReviewsUnauthenticated,
  DashboardReviewsForbidden,
  DashboardReviewsNotFound,
  DashboardReviewsError,
  DashboardReviewsListResult,
  DashboardReviewsStatsResult,
  DashboardReviewsItemResult,
} from './domain/types'

// =============================================================================
// Utilities
// =============================================================================

export {
  // Constants
  ASPECT_LABELS,
  STAR_SYMBOL_FULL,
  STAR_SYMBOL_EMPTY,
  UUID_PATTERN,
  // Formatters
  toDisplayKey,
  formatVisitedLabel,
  starLabel,
  // Data Transformers
  normaliseAspectEntries,
  transformReviewItem,
  transformHighlight,
  // Form Helpers
  buildInitialForm,
} from './lib/utils'

// =============================================================================
// Dashboard API
// =============================================================================

export {
  fetchDashboardReviews,
  fetchDashboardReviewStats,
  updateDashboardReviewStatus,
} from './api/dashboard'
