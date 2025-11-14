import { NextRequest, NextResponse } from 'next/server'
import {
  addMockFavorite,
  readMockFavorites,
  isMockFavoritesMode,
  writeMockFavorites,
} from '../mockStore'

const API_BASE =
  process.env.OSAKAMENESU_API_INTERNAL_BASE ||
  process.env.API_INTERNAL_BASE ||
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE

function ensureApiBase(): string {
  if (!API_BASE) {
    throw new Error('API base URL is not configured for favorites proxy')
  }
  return API_BASE.replace(/\/+$/, '')
}

function buildBackendUrl(path: string): string {
  const base = ensureApiBase()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}

async function forwardRequest(
  req: NextRequest,
  path: string,
  init: RequestInit,
): Promise<NextResponse> {
  const url = buildBackendUrl(path)
  const headers = new Headers(init.headers ?? {})

  if (req.headers.get('cookie')) {
    headers.set('cookie', req.headers.get('cookie') as string)
  }

  if (!headers.has('content-type') && req.headers.get('content-type')) {
    headers.set('content-type', req.headers.get('content-type') as string)
  }

  headers.set('accept', req.headers.get('accept') ?? 'application/json')

  const response = await fetch(url, {
    ...init,
    headers,
    redirect: 'manual',
    cache: 'no-store',
  })

  const responseHeaders = new Headers(response.headers)
  const body = await response.arrayBuffer()
  const nextResponse = new NextResponse(body, {
    status: response.status,
    headers: responseHeaders,
  })

  const setCookie = responseHeaders.get('set-cookie')
  if (setCookie) {
    nextResponse.headers.set('set-cookie', setCookie)
  }

  return nextResponse
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (isMockFavoritesMode()) {
    const favorites = readMockFavorites(req)
    const entries = Array.from(favorites.values()).map((item) => ({
      therapist_id: item.therapistId,
      shop_id: item.shopId,
      created_at: item.createdAt,
    }))
    const response = NextResponse.json(entries, { status: 200 })
    writeMockFavorites(response, favorites)
    return response
  }

  const shouldFallbackForStatus = (status: number): boolean => {
    return status >= 500 || status === 401 || status === 403 || status === 404
  }

  try {
    const response = await forwardRequest(req, '/api/favorites/therapists', { method: 'GET' })
    if (shouldFallbackForStatus(response.status)) {
      return response
    }
    return response
  } catch (error) {
    throw error
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text()
  if (isMockFavoritesMode()) {
    let payload: unknown
    try {
      payload = body ? JSON.parse(body) : {}
    } catch {
      return NextResponse.json({ detail: 'invalid_json' }, { status: 400 })
    }
    const therapistId = (payload as Record<string, unknown>)['therapist_id']
    if (typeof therapistId !== 'string' || !therapistId.trim()) {
      return NextResponse.json({ detail: 'therapist_id_required' }, { status: 400 })
    }
    const favorites = readMockFavorites(req)
    const record = addMockFavorite(favorites, therapistId.trim())
    const response = NextResponse.json(
      {
        therapist_id: record.therapistId,
        shop_id: record.shopId,
        created_at: record.createdAt,
      },
      { status: 201 },
    )
    writeMockFavorites(response, favorites)
    return response
  }

  const shouldFallbackForStatus = (status: number): boolean => {
    return status >= 500 || status === 401 || status === 403 || status === 404
  }

  try {
    const response = await forwardRequest(req, '/api/favorites/therapists', {
      method: 'POST',
      body,
    })
    if (shouldFallbackForStatus(response.status)) {
      return response
    }
    return response
  } catch (error) {
    throw error
  }
}
