import type { BrowserContext, Page } from '@playwright/test'

export class SkipTestError extends Error {}

type CookieInput = {
  name: string
  value: string
  domain: string
  path: string
  httpOnly: boolean
  secure: boolean
  expires?: number
  sameSite?: 'Strict' | 'Lax' | 'None'
}

function resolveWebBase(baseURL?: string): string {
  const candidates = [baseURL, process.env.E2E_BASE_URL, process.env.NEXT_PUBLIC_SITE_URL]
  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return candidate.replace(/\/$/, '')
    }
  }
  return 'http://127.0.0.1:3000'
}

export function resolveApiBase(baseURL?: string): string {
  const envBase =
    process.env.OSAKAMENESU_API_INTERNAL_BASE ||
    process.env.API_INTERNAL_BASE ||
    process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.E2E_API_BASE
  if (envBase && envBase.trim()) {
    return envBase.replace(/\/$/, '')
  }
  if (baseURL && baseURL.trim()) {
    return baseURL.replace(/\/$/, '')
  }
  return 'http://127.0.0.1:8000'
}

function parseSetCookieHeaders(setCookieValues: string[], origin: URL): CookieInput[] {
  const nowSeconds = Math.floor(Date.now() / 1000)
  return setCookieValues
    .map((raw) => {
      const segments = raw.split(';').map((segment) => segment.trim()).filter(Boolean)
      if (!segments.length) return null
      const [nameValue, ...attributes] = segments
      const separatorIndex = nameValue.indexOf('=')
      if (separatorIndex <= 0) return null
      const name = nameValue.slice(0, separatorIndex).trim()
      const value = nameValue.slice(separatorIndex + 1).trim()
      if (!name) return null

      const cookie: CookieInput = {
        name,
        value,
        domain: origin.hostname,
        path: '/',
        httpOnly: false,
        secure: origin.protocol === 'https:',
      }

      for (const attribute of attributes) {
        const [attrNameRaw, ...attrValueParts] = attribute.split('=')
        const attrName = attrNameRaw.trim().toLowerCase()
        const attrValue = attrValueParts.join('=').trim()

        switch (attrName) {
          case 'domain':
            if (attrValue) {
              cookie.domain = attrValue.toLowerCase()
            }
            break
          case 'path':
            if (attrValue) {
              cookie.path = attrValue
            }
            break
          case 'secure':
            cookie.secure = true
            break
          case 'httponly':
            cookie.httpOnly = true
            break
          case 'samesite':
            if (attrValue) {
              const normalized = attrValue.charAt(0).toUpperCase() + attrValue.slice(1).toLowerCase()
              if (normalized === 'Lax' || normalized === 'Strict' || normalized === 'None') {
                cookie.sameSite = normalized
              }
            }
            break
          case 'expires':
            if (attrValue) {
              const parsed = Date.parse(attrValue)
              if (!Number.isNaN(parsed)) {
                cookie.expires = Math.floor(parsed / 1000)
              }
            }
            break
          case 'max-age':
            if (attrValue) {
              const parsed = Number.parseInt(attrValue, 10)
              if (!Number.isNaN(parsed)) {
                cookie.expires = nowSeconds + parsed
              }
            }
            break
          default:
            break
        }
      }

      return cookie
    })
    .filter((cookie): cookie is CookieInput => Boolean(cookie))
}

async function syncSessionWithNextApp(context: BrowserContext, baseURL: string, cookies: CookieInput[]) {
  const sessionCookie = cookies.find((cookie) => cookie.name === 'osakamenesu_session')
  if (!sessionCookie) {
    return
  }

  const url = new URL(baseURL)
  const csrfToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

  await context.addCookies([
    {
      name: 'osakamenesu_csrf',
      value: csrfToken,
      domain: sessionCookie.domain || url.hostname,
      path: '/',
      httpOnly: false,
      secure: sessionCookie.secure,
    },
  ])
}

export async function ensureDashboardAuthenticated(
  context: BrowserContext,
  page: Page,
  baseURL?: string,
): Promise<void> {
  const resolvedWebBase = resolveWebBase(baseURL)
  const resolvedApiBase = resolveApiBase(baseURL)
  const secretCandidates = [process.env.E2E_TEST_AUTH_SECRET, process.env.TEST_AUTH_SECRET]
    .filter((value): value is string => Boolean(value && value.trim()))

  if (!secretCandidates.length) {
    throw new SkipTestError('E2E_TEST_AUTH_SECRET もしくは TEST_AUTH_SECRET が設定されていません')
  }

  const email = process.env.E2E_TEST_DASHBOARD_EMAIL ?? 'playwright-dashboard@example.com'
  const displayName = process.env.E2E_TEST_DASHBOARD_NAME ?? 'Playwright Dashboard User'

  for (const secret of secretCandidates) {
    const response = await page.request.post(`${resolvedApiBase}/api/auth/test-login`, {
      data: {
        email,
        display_name: displayName,
        scope: 'dashboard',
      },
      headers: {
        'X-Test-Auth-Secret': secret,
      },
    })

    if (response.status() === 503) {
      throw new SkipTestError('dashboard 向け test-login API が無効化されています')
    }

    if (response.status() === 401) {
      continue
    }

    if (!response.ok()) {
      throw new Error(`test-login API が失敗しました (${response.status()})`)
    }

    const cookieHeaders = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === 'set-cookie')
      .map((header) => header.value)

    if (!cookieHeaders.length) {
      throw new Error('test-login API の応答に Set-Cookie が含まれていません')
    }

    const cookies = parseSetCookieHeaders(cookieHeaders, new URL(resolvedWebBase))
    if (!cookies.length) {
      throw new Error('Set-Cookie ヘッダーの解析に失敗しました')
    }

    await context.addCookies(cookies)
    await syncSessionWithNextApp(context, resolvedWebBase, cookies)
    return
  }

  throw new Error('テスト用シークレットが一致せずログインできませんでした')
}
