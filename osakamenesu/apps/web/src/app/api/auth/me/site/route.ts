import { NextRequest, NextResponse } from 'next/server'

const API_BASE =
  process.env.OSAKAMENESU_API_INTERNAL_BASE ||
  process.env.API_INTERNAL_BASE ||
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE

function ensureApiBase(): string {
  if (!API_BASE) {
    throw new Error('API base URL is not configured for auth proxy')
  }
  return API_BASE.replace(/\/+$/, '')
}

function buildBackendUrl(path: string): string {
  const base = ensureApiBase()
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

const PUBLIC_AUTH_PATHS = new Set(['/dashboard/login', '/api/auth/me/site', '/api/auth/request-link', '/api/auth/test-login'])

function stripAdminHeaders(headers: Headers): Headers {
  const sanitized = new Headers(headers)
  sanitized.delete('authorization')
  sanitized.delete('Authorization')
  sanitized.delete('x-admin-key')
  sanitized.delete('X-Admin-Key')
  return sanitized
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const headers = stripAdminHeaders(request.headers)
  const backendResponse = await fetch(buildBackendUrl('/api/auth/me/site'), {
    method: 'GET',
    headers: {
      cookie: headers.get('cookie') ?? '',
      accept: headers.get('accept') ?? 'application/json',
    },
    redirect: 'manual',
    cache: 'no-store',
  })

  const responseHeaders = new Headers(backendResponse.headers)
  const status = backendResponse.status
  const body = await backendResponse.arrayBuffer()

  return new NextResponse(body, {
    status,
    headers: responseHeaders,
  })
}
