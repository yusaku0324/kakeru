import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

import { sessionCookieOptions } from '@/lib/session'
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  validateCsrfToken as baseValidateCsrfToken,
} from './csrf'

export function generateCsrfToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export function csrfCookieOptions() {
  const sessionOptions = sessionCookieOptions()
  return {
    sameSite: sessionOptions.sameSite,
    secure: sessionOptions.secure,
    path: '/',
    maxAge: sessionOptions.maxAge,
    domain: sessionOptions.domain,
  } as const
}

export function setCsrfCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    httpOnly: false,
    ...csrfCookieOptions(),
  })
}

export function clearCsrfCookie(response: NextResponse) {
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: '',
    httpOnly: false,
    ...csrfCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  })
}

export async function getCsrfToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(CSRF_COOKIE_NAME)?.value ?? null
}

export function validateCsrfToken(request: NextRequest): boolean {
  return baseValidateCsrfToken(request)
}
