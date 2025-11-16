import { NextRequest, NextResponse } from 'next/server'
import { readMockFavorites, removeMockFavorite, isMockFavoritesMode, writeMockFavorites } from '../../mockStore'

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

async function forwardDelete(
  req: NextRequest,
  therapistId: string,
): Promise<NextResponse> {
  const url = buildBackendUrl(`/api/favorites/therapists/${encodeURIComponent(therapistId)}`)
  const headers = new Headers()

  if (req.headers.get('cookie')) {
    headers.set('cookie', req.headers.get('cookie') as string)
  }

  const response = await fetch(url, {
    method: 'DELETE',
    headers,
    redirect: 'manual',
    cache: 'no-store',
  })

  const responseHeaders = new Headers(response.headers)
  const status = response.status
  let nextResponse: NextResponse
  if (status === 204) {
    nextResponse = new NextResponse(null, {
      status,
      headers: responseHeaders,
    })
  } else {
    const body = await response.arrayBuffer()
    nextResponse = new NextResponse(body, {
      status,
      headers: responseHeaders,
    })
  }

  const setCookie = responseHeaders.get('set-cookie')
  if (setCookie) {
    nextResponse.headers.set('set-cookie', setCookie)
  }

  return nextResponse
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ therapistId: string }> },
): Promise<NextResponse> {
  const { therapistId } = await context.params
  if (isMockFavoritesMode()) {
    const favorites = readMockFavorites(req)
    removeMockFavorite(favorites, therapistId)
    const response = new NextResponse(null, { status: 204 })
    writeMockFavorites(response, favorites)
    return response
  }

  const shouldFallbackForStatus = (status: number): boolean => {
    return status >= 500 || status === 401 || status === 403 || status === 404
  }

  try {
    const response = await forwardDelete(req, therapistId)
    if (shouldFallbackForStatus(response.status)) {
      return response
    }
    return response
  } catch (error) {
    throw error
  }
}
