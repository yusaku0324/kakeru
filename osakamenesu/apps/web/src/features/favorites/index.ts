/**
 * Favorites Feature Module
 *
 * 垂直スライスアーキテクチャ: お気に入り機能
 *
 * Usage:
 * ```ts
 * import {
 *   TherapistFavoriteRecord,
 *   normalizeId,
 *   isMockMode,
 * } from '@/features/favorites'
 * ```
 */

// Domain Types
export type {
  TherapistFavoriteRecord,
  ShopFavoriteRecord,
  ToggleFavoritePayload,
  FavoritesContextValue,
  TherapistFavoritesContextValue,
  ShopFavoritesContextValue,
  TherapistFavoriteApiResponse,
  ShopFavoriteApiResponse,
  FavoriteRecord,
} from './domain/types'

// Utilities
export {
  normalizeId,
  isMockMode,
  isClientMockMode,
  FAVORITES_MOCK_COOKIE_NAME,
  SHOP_FAVORITES_MOCK_COOKIE_NAME,
  DEFAULT_SHOP_ID,
} from './lib/utils'

// Mock Store (for API routes)
export {
  readMockFavorites,
  writeMockFavorites,
  addMockFavorite,
  removeMockFavorite,
  isMockFavoritesMode,
  COOKIE_NAME,
} from './domain/mock-store'
