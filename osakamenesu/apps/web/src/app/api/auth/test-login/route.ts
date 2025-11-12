import { NextRequest, NextResponse } from 'next/server'

import { CSRF_HEADER_NAME } from '@/lib/csrf'
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf.server'
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/session'

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

function extractSessionCookie(headerValue: string | null): string | null {
  if (!headerValue) {
    return null
  }
  const marker = `${SESSION_COOKIE_NAME}=`
  const start = headerValue.indexOf(marker)
  if (start === -1) {
    return null
  }
  const afterMarker = headerValue.slice(start + marker.length)
  const end = afterMarker.indexOf(';')
  const rawValue = end >= 0 ? afterMarker.slice(0, end) : afterMarker
  return rawValue || null
}

function stripAdminHeaders(headers: Headers): Headers {
  const sanitized = new Headers(headers)
  sanitized.delete('authorization')
  sanitized.delete('Authorization')
  sanitized.delete('x-admin-key')
  sanitized.delete('X-Admin-Key')
  return sanitized
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text()
  const incomingHeaders = stripAdminHeaders(request.headers)
  const secret = incomingHeaders.get('x-test-auth-secret')
  if (!secret) {
    return NextResponse.json({ detail: 'missing_test_auth_secret' }, { status: 400 })
  }

  const headers = new Headers()
  headers.set('x-test-auth-secret', secret)
  if (incomingHeaders.get('content-type')) {
    headers.set('content-type', incomingHeaders.get('content-type') as string)
  }
  const authHeader = incomingHeaders.get('authorization')
  if (authHeader) {
    headers.set('authorization', authHeader)
  }

  const backendResponse = await fetch(buildBackendUrl('/api/auth/test-login'), {
    method: 'POST',
    body,
    headers,
    cache: 'no-store',
    redirect: 'manual',
  })

  if (!backendResponse.ok) {
    const errorBody = await backendResponse.arrayBuffer()
    return new NextResponse(errorBody, {
      status: backendResponse.status,
      headers: {
        'content-type': backendResponse.headers.get('content-type') ?? 'application/json',
      },
    })
  }

  const sessionToken = extractSessionCookie(backendResponse.headers.get('set-cookie'))
  if (!sessionToken) {
    const fallbackBody = await backendResponse.text().catch(() => '')
    return NextResponse.json(
      { detail: 'missing_session_cookie', body: fallbackBody || undefined },
      { status: 502 },
    )
  }

  const payload = await backendResponse.json().catch(() => ({}))
  const response = NextResponse.json(payload, { status: 200 })
  const cookieOptions = sessionCookieOptions()
  if (request.nextUrl.protocol === 'http:') {
    cookieOptions.secure = false
    cookieOptions.sameSite = 'lax'
    cookieOptions.domain = request.nextUrl.hostname
  }
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionToken,
    ...cookieOptions,
  })
  const csrfToken = generateCsrfToken()
  setCsrfCookie(response, csrfToken)
  response.headers.set(CSRF_HEADER_NAME, csrfToken)
  return response
}
