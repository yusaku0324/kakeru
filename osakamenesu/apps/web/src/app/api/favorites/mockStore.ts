/**
 * Favorites Mock Store (Re-export)
 *
 * @deprecated Use `@/features/favorites` instead
 *
 * This file is kept for backward compatibility.
 * All functionality has been moved to the vertical slice module.
 */

export {
  readMockFavorites,
  writeMockFavorites,
  addMockFavorite,
  removeMockFavorite,
  isMockFavoritesMode,
  COOKIE_NAME,
} from '@/features/favorites'

export type { FavoriteRecord } from '@/features/favorites'
