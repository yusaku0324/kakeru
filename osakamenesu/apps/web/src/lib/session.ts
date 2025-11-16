import { cookies } from 'next/headers'

export const SESSION_COOKIE_NAME = 'osakamenesu_session'
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7

export type SessionCookieOptions = {
  httpOnly: boolean
  sameSite: 'lax' | 'strict' | 'none'
  secure: boolean
  path: string
  maxAge: number
  domain?: string
}

const isProduction = process.env.NODE_ENV === 'production'

export function sessionCookieOptions(): SessionCookieOptions {
  const base: SessionCookieOptions = {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    path: '/',
    maxAge: ONE_WEEK_SECONDS,
  }

  if (isProduction) {
    base.domain = '.osakamenes.com'
  }

  return base
}

export async function getSession(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESSION_COOKIE_NAME)?.value ?? null
}

export async function setSessionCookie(value: string) {
  if (!value) {
    throw new Error('Session value must be a non-empty string.')
  }

  const store = await cookies()
  store.set({
    name: SESSION_COOKIE_NAME,
    value,
    ...sessionCookieOptions(),
  })
}

export async function clearSessionCookie() {
  const options = sessionCookieOptions()
  const store = await cookies()
  store.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    ...options,
    maxAge: 0,
    expires: new Date(0),
  })
}
