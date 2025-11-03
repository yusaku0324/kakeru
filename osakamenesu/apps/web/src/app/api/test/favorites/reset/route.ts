import { NextRequest, NextResponse } from 'next/server'
import { readMockFavorites, writeMockFavorites, isMockFavoritesMode } from '../../../favorites/mockStore'

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isMockFavoritesMode()) {
    return NextResponse.json({ detail: 'test favorites API not enabled' }, { status: 403 })
  }
  const favorites = readMockFavorites(req)
  favorites.clear()
  const response = NextResponse.json({ ok: true })
  writeMockFavorites(response, favorites)
  return response
}
