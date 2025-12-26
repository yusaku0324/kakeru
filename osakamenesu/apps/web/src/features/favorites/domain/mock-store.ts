/**
 * Favorites Mock Store
 *
 * Cookie-based mock storage for favorites (development/testing)
 */

import { NextRequest, NextResponse } from 'next/server'
import type { FavoriteRecord } from './types'
import {
  normalizeId,
  isMockMode,
  FAVORITES_MOCK_COOKIE_NAME,
  DEFAULT_SHOP_ID,
} from '../lib/utils'

/**
 * Cookieから保存されたお気に入りをデコード
 */
function decodeCookieValue(raw: string | undefined): FavoriteRecord[] {
  if (!raw) return []
  try {
    const decoded = decodeURIComponent(raw)
    const parsed = JSON.parse(decoded)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((entry) => {
        const record = entry as Record<string, unknown>
        const therapistId = normalizeId(record['therapistId'] as string | null | undefined)
        const shopId = normalizeId(record['shopId'] as string | null | undefined) ?? DEFAULT_SHOP_ID
        const createdAt =
          typeof record['createdAt'] === 'string'
            ? String(record['createdAt'])
            : new Date().toISOString()
        if (!therapistId) return null
        return { therapistId, shopId, createdAt }
      })
      .filter((item): item is FavoriteRecord => item !== null)
  } catch {
    return []
  }
}

/**
 * リクエストからモックお気に入りを読み取り
 */
export function readMockFavorites(req: NextRequest): Map<string, FavoriteRecord> {
  const raw = req.cookies.get(FAVORITES_MOCK_COOKIE_NAME)?.value
  const favorites = decodeCookieValue(raw)
  return new Map(favorites.map((item) => [item.therapistId, item]))
}

/**
 * お気に入りをCookieにエンコード
 */
function encodeFavorites(favorites: Map<string, FavoriteRecord>): string {
  const payload = JSON.stringify(
    Array.from(favorites.values()).map((item) => ({
      therapistId: item.therapistId,
      shopId: item.shopId,
      createdAt: item.createdAt,
    })),
  )
  return encodeURIComponent(payload)
}

/**
 * モックお気に入りをレスポンスに書き込み
 */
export function writeMockFavorites(
  response: NextResponse,
  favorites: Map<string, FavoriteRecord>,
): void {
  response.cookies.set({
    name: FAVORITES_MOCK_COOKIE_NAME,
    value: encodeFavorites(favorites),
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  })
}

/**
 * モックお気に入りを追加
 */
export function addMockFavorite(
  favorites: Map<string, FavoriteRecord>,
  therapistId: string,
  shopId: string = DEFAULT_SHOP_ID,
): FavoriteRecord {
  const record: FavoriteRecord = {
    therapistId,
    shopId,
    createdAt: new Date().toISOString(),
  }
  favorites.set(therapistId, record)
  return record
}

/**
 * モックお気に入りを削除
 */
export function removeMockFavorite(
  favorites: Map<string, FavoriteRecord>,
  therapistId: string,
): boolean {
  return favorites.delete(therapistId)
}

/**
 * モックモード判定（再エクスポート）
 */
export { isMockMode as isMockFavoritesMode }

/**
 * Cookie名をエクスポート
 */
export { FAVORITES_MOCK_COOKIE_NAME as COOKIE_NAME }
