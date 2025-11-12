import { NextResponse } from 'next/server'

import { clearCsrfCookie } from '@/lib/csrf.server'
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/session'
import { withErrorReporting } from '@/lib/monitoring'

async function postHandler() {
  const response = NextResponse.json({ ok: true })

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    ...sessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  })

  clearCsrfCookie(response)

  return response
}

export const POST = withErrorReporting(postHandler, { route: 'api/auth/logout', method: 'POST' })

export function GET() {
  return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 })
}
