/**
 * ShopReviews Utilities (Re-export)
 *
 * @deprecated Use `@/features/reviews` instead
 *
 * This file is kept for backward compatibility.
 * All utilities have been moved to the vertical slice module.
 */

export {
  ASPECT_LABELS,
  STAR_SYMBOL_FULL,
  STAR_SYMBOL_EMPTY,
  UUID_PATTERN,
  toDisplayKey,
  formatVisitedLabel,
  starLabel,
  normaliseAspectEntries,
  transformReviewItem,
  transformHighlight,
  buildInitialForm,
} from '@/features/reviews'
