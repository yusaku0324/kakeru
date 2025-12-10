import { cookies } from 'next/headers'

/** Cookie name for dashboard (shop staff) sessions */
export const DASHBOARD_SESSION_COOKIE_NAME = 'osakamenesu_dashboard_session'
/** Cookie name for site (guest/user) sessions */
export const SITE_SESSION_COOKIE_NAME = 'osakamenesu_site_session'
/** @deprecated Use DASHBOARD_SESSION_COOKIE_NAME or SITE_SESSION_COOKIE_NAME */
export const SESSION_COOKIE_NAME = DASHBOARD_SESSION_COOKIE_NAME

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

  // Only set domain for custom domain, not for vercel.app deployments
  // When domain is not set, cookie is scoped to the current host
  const cookieDomain = process.env.SESSION_COOKIE_DOMAIN
  if (cookieDomain) {
    base.domain = cookieDomain
  }

  return base
}

export type SessionScope = 'dashboard' | 'site'

function getCookieNameForScope(scope: SessionScope): string {
  return scope === 'dashboard' ? DASHBOARD_SESSION_COOKIE_NAME : SITE_SESSION_COOKIE_NAME
}

export async function getSession(): Promise<string | null> {
  const store = await cookies()
  // Try dashboard first for backward compatibility, then site
  return (
    store.get(DASHBOARD_SESSION_COOKIE_NAME)?.value ??
    store.get(SITE_SESSION_COOKIE_NAME)?.value ??
    null
  )
}

export async function getSessionByScope(scope: SessionScope): Promise<string | null> {
  const store = await cookies()
  const cookieName = getCookieNameForScope(scope)
  return store.get(cookieName)?.value ?? null
}

export async function setSessionCookie(value: string, scope: SessionScope = 'dashboard') {
  if (!value) {
    throw new Error('Session value must be a non-empty string.')
  }

  const store = await cookies()
  const cookieName = getCookieNameForScope(scope)
  store.set({
    name: cookieName,
    value,
    ...sessionCookieOptions(),
  })
}

export async function clearSessionCookie(scope?: SessionScope) {
  const options = sessionCookieOptions()
  const store = await cookies()

  if (scope) {
    // Clear specific scope
    const cookieName = getCookieNameForScope(scope)
    store.set({
      name: cookieName,
      value: '',
      ...options,
      maxAge: 0,
      expires: new Date(0),
    })
  } else {
    // Clear both scopes
    for (const name of [DASHBOARD_SESSION_COOKIE_NAME, SITE_SESSION_COOKIE_NAME]) {
      store.set({
        name,
        value: '',
        ...options,
        maxAge: 0,
        expires: new Date(0),
      })
    }
  }
}
