/**
 * Dashboard Reviews API (Re-export)
 *
 * @deprecated Use `@/features/reviews` instead
 *
 * This file is kept for backward compatibility.
 * All functionality has been moved to the vertical slice module.
 */

// Types
export type {
  ReviewStatus,
  ReviewItem,
  ReviewListResponse,
  ReviewStats,
  DashboardReviewsRequestOptions,
  DashboardReviewsSuccess,
  DashboardReviewsUnauthenticated,
  DashboardReviewsForbidden,
  DashboardReviewsNotFound,
  DashboardReviewsError,
  DashboardReviewsListResult,
  DashboardReviewsStatsResult,
  DashboardReviewsItemResult,
} from '@/features/reviews'

// API Functions
export {
  fetchDashboardReviews,
  fetchDashboardReviewStats,
  updateDashboardReviewStatus,
} from '@/features/reviews'
