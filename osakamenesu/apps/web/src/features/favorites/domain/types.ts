/**
 * Favorites Domain Types
 *
 * 垂直スライスアーキテクチャ: お気に入り機能の型定義
 */

/**
 * セラピストお気に入りレコード
 */
export type TherapistFavoriteRecord = {
  therapistId: string
  shopId: string
  createdAt: string
}

/**
 * 店舗お気に入りレコード
 */
export type ShopFavoriteRecord = {
  shopId: string
  createdAt: string
}

/**
 * お気に入りトグル操作のペイロード
 */
export type ToggleFavoritePayload = {
  therapistId: string
  shopId: string
}

/**
 * お気に入りコンテキストの共通値
 */
export type FavoritesContextValue<T> = {
  favorites: Map<string, T>
  isAuthenticated: boolean | null
  loading: boolean
  isFavorite: (id: string) => boolean
  isProcessing: (id: string) => boolean
}

/**
 * セラピストお気に入りコンテキスト値
 */
export type TherapistFavoritesContextValue = FavoritesContextValue<TherapistFavoriteRecord> & {
  toggleFavorite: (payload: ToggleFavoritePayload) => Promise<void>
}

/**
 * 店舗お気に入りコンテキスト値
 */
export type ShopFavoritesContextValue = FavoritesContextValue<ShopFavoriteRecord> & {
  toggleFavorite: (shopId: string) => Promise<void>
}

/**
 * APIレスポンスの型（snake_case）
 */
export type TherapistFavoriteApiResponse = {
  therapist_id?: string
  shop_id?: string
  created_at?: string
}

export type ShopFavoriteApiResponse = {
  shop_id?: string
  created_at?: string
}

/**
 * Mock用のレコード型（API Route用）
 */
export type FavoriteRecord = {
  therapistId: string
  shopId: string
  createdAt: string
}
