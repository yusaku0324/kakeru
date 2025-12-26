import { NextResponse } from 'next/server'

import { clearCsrfCookie } from '@/lib/csrf.server'
import { DASHBOARD_SESSION_COOKIE_NAME, SITE_SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/session'
import { withErrorReporting } from '@/lib/monitoring'

async function postHandler() {
  const response = NextResponse.json({ ok: true })

  // Clear both dashboard and site session cookies
  const cookieOptions = {
    ...sessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  }

  response.cookies.set({
    name: DASHBOARD_SESSION_COOKIE_NAME,
    value: '',
    ...cookieOptions,
  })

  response.cookies.set({
    name: SITE_SESSION_COOKIE_NAME,
    value: '',
    ...cookieOptions,
  })

  clearCsrfCookie(response)

  return response
}

export const POST = withErrorReporting(postHandler, { route: 'api/auth/logout', method: 'POST' })

export function GET() {
  return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 })
}
