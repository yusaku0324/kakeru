import { NextRequest, NextResponse } from 'next/server'
import {
  addMockFavorite,
  readMockFavorites,
  removeMockFavorite,
  isMockFavoritesMode,
  writeMockFavorites,
} from '../../../favorites/mockStore'

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isMockFavoritesMode()) {
    return NextResponse.json({ detail: 'test favorites API not enabled' }, { status: 403 })
  }
  const favorites = readMockFavorites(req)
  const entries = Array.from(favorites.values())
  const response = NextResponse.json(entries, { status: 200 })
  writeMockFavorites(response, favorites)
  return response
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isMockFavoritesMode()) {
    return NextResponse.json({ detail: 'test favorites API not enabled' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const therapistId = typeof body?.therapist_id === 'string' ? body.therapist_id.trim() : ''
  const shopId = typeof body?.shop_id === 'string' ? body.shop_id.trim() : undefined
  if (!therapistId) {
    return NextResponse.json({ detail: 'therapist_id_required' }, { status: 400 })
  }
  const favorites = readMockFavorites(req)
  const record = addMockFavorite(favorites, therapistId, shopId)
  const response = NextResponse.json(record, { status: 201 })
  writeMockFavorites(response, favorites)
  return response
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!isMockFavoritesMode()) {
    return NextResponse.json({ detail: 'test favorites API not enabled' }, { status: 403 })
  }
  const url = new URL(req.url)
  const therapistId = url.searchParams.get('therapist_id')
  if (!therapistId) {
    return NextResponse.json({ detail: 'therapist_id_required' }, { status: 400 })
  }
  const favorites = readMockFavorites(req)
  removeMockFavorite(favorites, therapistId)
  const response = new NextResponse(null, { status: 204 })
  writeMockFavorites(response, favorites)
  return response
}
