import { NextRequest, NextResponse } from 'next/server'

import {
  CSRF_HEADER_NAME,
  isCsrfProtectedMethod,
  shouldBypassCsrf,
  validateCsrfToken,
} from '@/lib/csrf'
import { resolveInternalApiBase } from '@/lib/server-config'
import { SESSION_COOKIE_NAME } from '@/lib/session'

const BASIC_REALM = 'Admin'

// 認証情報は環境変数から取得（ハードコード禁止）
const ADMIN_BASIC_USER = process.env.ADMIN_BASIC_USER
const ADMIN_BASIC_PASS = process.env.ADMIN_BASIC_PASS

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 30
// E2E テスト時のみ明示的にレート制限を無効化（開発環境でも有効に）
const DISABLE_RATE_LIMIT = process.env.E2E_DISABLE_RATE_LIMIT === '1'
type RateLimitRecord = {
  windowStart: number
  count: number
}
const rateLimitBuckets = new Map<string, RateLimitRecord>()

const FASTAPI_BASE =
  process.env.E2E_INTERNAL_API_BASE ||
  process.env.E2E_SEED_API_BASE ||
  resolveInternalApiBase()

const NORMALIZED_FASTAPI_BASE = FASTAPI_BASE.replace(/\/$/, '')
const HMAC_SECRET = process.env.API_PROXY_HMAC_SECRET || process.env.PROXY_SHARED_SECRET || null
const SIGNATURE_HEADER = 'x-osakamenesu-signature'
const TIMESTAMP_HEADER = 'x-osakamenesu-signature-ts'
const PROXIED_PREFIXES = ['/api/line/', '/api/async/']
const PROXIED_EXACT = PROXIED_PREFIXES.map((prefix) =>
  prefix.endsWith('/') ? prefix.slice(0, -1) : prefix,
)

const encoder = new TextEncoder()
let cachedHmacKey: Promise<CryptoKey> | null = null

function unauthorized(message: string) {
  return applySecurityHeaders(
    new NextResponse(message, {
      status: 401,
      headers: {
        'WWW-Authenticate': `Basic realm="${BASIC_REALM}", charset="UTF-8"`,
      },
    }),
  )
}

function requiresAdminAuth(pathname: string) {
  if (pathname.startsWith('/api/admin')) {
    return false
  }
  return pathname.startsWith('/admin')
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data: https:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https: http://localhost:8000 http://127.0.0.1:8000",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export function applySecurityHeaders(response: NextResponse) {
  response.headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Permissions-Policy', 'interest-cohort=()')
  return response
}

function allowRequest(ip: string) {
  if (DISABLE_RATE_LIMIT) {
    return true
  }
  const now = Date.now()
  const existing = rateLimitBuckets.get(ip)
  if (!existing || now - existing.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(ip, { windowStart: now, count: 1 })
    return true
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  existing.count += 1
  return true
}

function isProxiedPath(pathname: string) {
  if (PROXIED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true
  }
  return PROXIED_EXACT.includes(pathname)
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

async function createSignature(payload: string): Promise<string | null> {
  if (!HMAC_SECRET) {
    return null
  }

  if (!cachedHmacKey) {
    cachedHmacKey = crypto.subtle.importKey(
      'raw',
      encoder.encode(HMAC_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
  }

  const key = await cachedHmacKey
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return toHex(digest)
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const candidate = forwarded.split(',')[0]?.trim()
    if (candidate) return candidate
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}

function isSitePublicApi(pathname: string) {
  return SITE_PUBLIC_API_PATHS.some((path) => pathname === path)
}

function enforceAdminBasicAuth(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname
  if (!requiresAdminAuth(pathname) || isSitePublicApi(pathname)) {
    return null
  }

  // 環境変数が設定されていない場合は認証をブロック
  if (!ADMIN_BASIC_USER || !ADMIN_BASIC_PASS) {
    console.error('[Admin Auth] ADMIN_BASIC_USER and ADMIN_BASIC_PASS must be set')
    return unauthorized('Admin authentication not configured')
  }

  const user = ADMIN_BASIC_USER
  const pass = ADMIN_BASIC_PASS
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return unauthorized('Authentication required')
  }

  try {
    const decoded = atob(authHeader.slice('Basic '.length))
    const separator = decoded.indexOf(':')
    const providedUser = separator >= 0 ? decoded.slice(0, separator) : ''
    const providedPass = separator >= 0 ? decoded.slice(separator + 1) : ''

    if (providedUser !== user || providedPass !== pass) {
      return unauthorized('Invalid credentials')
    }
  } catch (error) {
    return unauthorized('Invalid credentials')
  }

  return null
}

const DASHBOARD_PUBLIC_PATHS = ['/dashboard/login', '/dashboard/favorites', '/dashboard/new']
const SITE_PUBLIC_API_PATHS = [
  '/api/auth/me/site',
  '/api/auth/request-link',
  '/api/auth/test-login',
]

function isPublicDashboardPath(pathname: string) {
  return DASHBOARD_PUBLIC_PATHS.some(
    (publicPath) => pathname === publicPath || pathname.startsWith(`${publicPath}/`),
  )
}

async function handleProxy(request: NextRequest): Promise<NextResponse | null> {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith('/dashboard')) {
    if (request.cookies.has(SESSION_COOKIE_NAME) || isPublicDashboardPath(pathname)) {
      return applySecurityHeaders(NextResponse.next())
    }

    const loginUrl = new URL('/dashboard/login', request.url)
    const fromPath = `${pathname}${search}`
    if (fromPath && fromPath !== '/') {
      loginUrl.searchParams.set('from', fromPath)
    }

    return applySecurityHeaders(NextResponse.redirect(loginUrl))
  }

  if (!pathname.startsWith('/api')) {
    return null
  }

  if (!isProxiedPath(pathname)) {
    return applySecurityHeaders(NextResponse.next())
  }

  const clientIp = getClientIp(request)

  if (!allowRequest(clientIp)) {
    const response = NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    )
    return applySecurityHeaders(response)
  }

  if (isCsrfProtectedMethod(request.method) && !shouldBypassCsrf(pathname)) {
    const valid = validateCsrfToken(request)
    if (!valid) {
      const response = NextResponse.json(
        { error: 'Invalid CSRF token.' },
        {
          status: 403,
          headers: {
            'x-csrf-error': 'missing-or-mismatch',
            vary: CSRF_HEADER_NAME,
          },
        },
      )
      return applySecurityHeaders(response)
    }
  }

  const target = `${NORMALIZED_FASTAPI_BASE}${pathname}${search}`
  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.set('x-forwarded-host', request.headers.get('host') ?? '')
  forwardedHeaders.set(
    'x-forwarded-proto',
    request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', ''),
  )
  forwardedHeaders.set('cookie', request.headers.get('cookie') ?? '')

  if (!requiresAdminAuth(pathname) || isSitePublicApi(pathname)) {
    forwardedHeaders.delete('authorization')
    forwardedHeaders.delete('Authorization')
    forwardedHeaders.delete('x-admin-key')
    forwardedHeaders.delete('X-Admin-Key')
  }

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signaturePayload = `${timestamp}:${request.method.toUpperCase()}:${pathname}${search}`
  const signature = await createSignature(signaturePayload)
  if (signature) {
    forwardedHeaders.set(SIGNATURE_HEADER, signature)
    forwardedHeaders.set(TIMESTAMP_HEADER, timestamp)
  }

  const rewrite = NextResponse.rewrite(target, {
    request: {
      headers: forwardedHeaders,
    },
  })
  return applySecurityHeaders(rewrite)
}

export default async function proxyEntry(request: NextRequest) {
  const basicAuthResult = enforceAdminBasicAuth(request)
  if (basicAuthResult) {
    return basicAuthResult
  }

  const proxied = await handleProxy(request)
  if (proxied) {
    return proxied
  }

  return applySecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*', '/dashboard/:path*'],
}
