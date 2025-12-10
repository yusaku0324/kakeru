import { NextRequest, NextResponse } from 'next/server'

import { resolveInternalApiBase } from '@/lib/server-config'

const API_BASE = resolveInternalApiBase().replace(/\/+$/, '')

function buildBackendUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${normalized}`
}

const PUBLIC_AUTH_PATHS = new Set([
  '/dashboard/login',
  '/api/auth/me/site',
  '/api/auth/request-link',
  '/api/auth/test-login',
])

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
      'accept-encoding': 'gzip, deflate, br',
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
