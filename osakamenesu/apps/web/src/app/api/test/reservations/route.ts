import { NextRequest, NextResponse } from 'next/server'

const API_BASE =
  process.env.OSAKAMENESU_API_INTERNAL_BASE ||
  process.env.API_INTERNAL_BASE ||
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE

function ensureApiBase(): string {
  if (!API_BASE) {
    throw new Error('API base URL is not configured for test proxy')
  }
  return API_BASE.replace(/\/+$/, '')
}

function buildBackendUrl(path: string): string {
  const base = ensureApiBase()
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text()
  const headers = new Headers()
  if (request.headers.get('content-type')) {
    headers.set('content-type', request.headers.get('content-type') as string)
  }
  if (request.headers.get('cookie')) {
    headers.set('cookie', request.headers.get('cookie') as string)
  }
  if (request.headers.get('x-test-auth-secret')) {
    headers.set('x-test-auth-secret', request.headers.get('x-test-auth-secret') as string)
  }
  headers.set('accept', request.headers.get('accept') ?? 'application/json')

  const backendResponse = await fetch(buildBackendUrl('/api/test/reservations'), {
    method: 'POST',
    body,
    headers,
    cache: 'no-store',
    redirect: 'manual',
  })

  const responseHeaders = new Headers(backendResponse.headers)
  const buffer = await backendResponse.arrayBuffer()

  return new NextResponse(buffer, {
    status: backendResponse.status,
    headers: responseHeaders,
  })
}
