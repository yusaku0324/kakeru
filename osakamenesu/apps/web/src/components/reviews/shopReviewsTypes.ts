/**
 * Types for ShopReviews component.
 */

export type ReviewAspectKey = 'therapist_service' | 'staff_response' | 'room_cleanliness'

export type ReviewAspect = {
  score: number
  note?: string | null
}

export type ReviewAspects = Partial<Record<ReviewAspectKey, ReviewAspect>>

export type HighlightedReview = {
  review_id?: string | null
  title: string
  body: string
  score: number
  visited_at?: string | null
  author_alias?: string | null
  aspects?: ReviewAspects | null
}

export type ReviewSummary = {
  average_score?: number | null
  review_count?: number | null
  highlighted?: HighlightedReview[] | null
  aspect_averages?: Partial<Record<ReviewAspectKey, number>> | null
  aspect_counts?: Partial<Record<ReviewAspectKey, number>> | null
}

export type ReviewItem = {
  id: string
  profile_id: string
  status: 'pending' | 'published' | 'rejected'
  score: number
  title?: string | null
  body: string
  author_alias?: string | null
  visited_at?: string | null
  created_at: string
  updated_at: string
  aspects?: ReviewAspects | null
}

export type ReviewListResponse = {
  total: number
  items: ReviewItem[]
  aspect_averages?: Partial<Record<ReviewAspectKey, number>>
  aspect_counts?: Partial<Record<ReviewAspectKey, number>>
}

export type ReviewDisplay = {
  key: string
  title?: string | null
  body: string
  score: number
  author?: string | null
  visitedAt?: string | null
  status?: 'pending' | 'published' | 'rejected' | 'highlight'
  submittedAt?: string | null
  aspects?: ReviewAspects | null
}

export type ReviewFormState = {
  score: number
  title: string
  body: string
  authorAlias: string
  visitedAt: string
  aspects: Record<ReviewAspectKey, { score: number | null; note: string }>
}

export type AuthState = 'checking' | 'guest' | 'authenticated'
