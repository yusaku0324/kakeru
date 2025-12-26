import { NextResponse } from 'next/server'

import { CSRF_HEADER_NAME } from '@/lib/csrf'
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf.server'
import { DASHBOARD_SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/session'
import { withErrorReporting } from '@/lib/monitoring'

type LoginBody = {
  token?: string
}

async function postHandler(request: Request) {
  const body = (await request.json().catch(() => ({}))) as LoginBody
  const token = typeof body.token === 'string' ? body.token.trim() : ''

  if (!token) {
    return NextResponse.json({ error: 'Missing session token.' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: DASHBOARD_SESSION_COOKIE_NAME,
    value: token,
    ...sessionCookieOptions(),
  })

  const csrfToken = generateCsrfToken()
  setCsrfCookie(response, csrfToken)

  response.headers.set(CSRF_HEADER_NAME, csrfToken)
  return response
}

export const POST = withErrorReporting(postHandler, { route: 'api/auth/login', method: 'POST' })

export function GET() {
  return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 })
}
