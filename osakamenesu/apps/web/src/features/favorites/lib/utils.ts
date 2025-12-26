/**
 * Favorites Utilities
 *
 * お気に入り機能の共有ユーティリティ
 */

/**
 * IDの正規化（トリム、空文字チェック）
 */
export function normalizeId(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed || null
}

/**
 * モックモードかどうかを判定
 */
export function isMockMode(): boolean {
  const forced = (process.env.FAVORITES_E2E_MODE || '').toLowerCase()
  if (forced === 'real') return false
  if (forced === 'mock') return true

  const mode = (
    process.env.FAVORITES_API_MODE ||
    process.env.NEXT_PUBLIC_FAVORITES_API_MODE ||
    ''
  ).toLowerCase()
  return mode === 'mock'
}

/**
 * クライアントサイドでモックモードかどうかを判定
 */
export function isClientMockMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_FAVORITES_API_MODE ||
    process.env.FAVORITES_API_MODE ||
    ''
  ).toLowerCase().includes('mock')
}

/**
 * Cookie名定数
 */
export const FAVORITES_MOCK_COOKIE_NAME = 'osakamenesu_favorites_mock'
export const SHOP_FAVORITES_MOCK_COOKIE_NAME = 'osakamenesu_shop_favorites_mock'
export const DEFAULT_SHOP_ID = '00000001-0000-0000-0000-000000000001'
