import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'osakamenesu_favorites_mock'
const DEFAULT_SHOP_ID = 'sample-namba-resort'

type FavoriteRecord = {
  therapistId: string
  shopId: string
  createdAt: string
}

function normalizeId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function decodeCookieValue(raw: string | undefined): FavoriteRecord[] {
  if (!raw) return []
  try {
    const decoded = decodeURIComponent(raw)
    const parsed = JSON.parse(decoded)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((entry) => {
        const therapistId = normalizeId((entry as Record<string, unknown>)['therapistId'])
        const shopId = normalizeId((entry as Record<string, unknown>)['shopId']) ?? DEFAULT_SHOP_ID
        const createdAt =
          typeof (entry as Record<string, unknown>)['createdAt'] === 'string'
            ? String((entry as Record<string, unknown>)['createdAt'])
            : new Date().toISOString()
        if (!therapistId) return null
        return {
          therapistId,
          shopId,
          createdAt,
        }
      })
      .filter((item): item is FavoriteRecord => item !== null)
  } catch {
    return []
  }
}

export function readMockFavorites(req: NextRequest): Map<string, FavoriteRecord> {
  const raw = req.cookies.get(COOKIE_NAME)?.value
  const favorites = decodeCookieValue(raw)
  return new Map(favorites.map((item) => [item.therapistId, item]))
}

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

export function writeMockFavorites(
  response: NextResponse,
  favorites: Map<string, FavoriteRecord>,
): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: encodeFavorites(favorites),
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  })
}

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

export function removeMockFavorite(
  favorites: Map<string, FavoriteRecord>,
  therapistId: string,
): boolean {
  return favorites.delete(therapistId)
}

export function isMockFavoritesMode(): boolean {
  const forced = (process.env.FAVORITES_E2E_MODE || '').toLowerCase()
  if (forced === 'real') {
    return false
  }
  if (forced === 'mock') {
    return true
  }
  const mode = (
    process.env.FAVORITES_API_MODE ||
    process.env.NEXT_PUBLIC_FAVORITES_API_MODE ||
    ''
  ).toLowerCase()
  return mode === 'mock'
}

export type { FavoriteRecord }
export { COOKIE_NAME }
