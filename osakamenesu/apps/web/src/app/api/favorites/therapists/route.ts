import { NextRequest, NextResponse } from 'next/server'

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
  return forwardRequest(req, '/api/favorites/therapists', { method: 'GET' })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text()
  return forwardRequest(req, '/api/favorites/therapists', {
    method: 'POST',
    body,
  })
}
