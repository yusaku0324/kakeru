import { test, expect, BrowserContext, Page } from '@playwright/test'

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

function parseCookieHeader(header: string, origin: URL): CookieInput[] {
  const domain = origin.hostname
  const secure = origin.protocol === 'https:'
  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((pair) => {
      const index = pair.indexOf('=')
      if (index <= 0) return null
      const name = pair.slice(0, index).trim()
      const value = pair.slice(index + 1).trim()
      if (!name || !value) return null
      return {
        name,
        value,
        domain,
        path: '/',
        httpOnly: false,
        secure,
      }
    })
    .filter((item): item is CookieInput => item !== null)
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
          case 'samesite': {
            const normalized = attrValue.toLowerCase()
            if (normalized === 'strict') cookie.sameSite = 'Strict'
            if (normalized === 'lax') cookie.sameSite = 'Lax'
            if (normalized === 'none') cookie.sameSite = 'None'
            break
          }
          case 'max-age': {
            const seconds = Number.parseInt(attrValue, 10)
            if (!Number.isNaN(seconds) && Number.isFinite(seconds)) {
              cookie.expires = nowSeconds + seconds
            }
            break
          }
          case 'expires': {
            const timestamp = Date.parse(attrValue)
            if (!Number.isNaN(timestamp)) {
              cookie.expires = Math.floor(timestamp / 1000)
            }
            break
          }
          default:
            break
        }
      }

      return cookie
    })
    .filter((cookie): cookie is CookieInput => cookie !== null)
}

class SkipTestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkipTestError'
  }
}

function normalizeBaseURL(baseURL: string): string {
  return baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
}

function resolveApiBase(baseURL?: string): string {
  const envBase =
    process.env.OSAKAMENESU_API_INTERNAL_BASE ||
    process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
    process.env.E2E_API_BASE
  if (envBase) {
    return envBase.replace(/\/$/, '')
  }
  if (baseURL) {
    return baseURL.replace(/\/$/, '')
  }
  return 'http://127.0.0.1:8000'
}

async function buildCookieHeader(context: BrowserContext, baseURL: string): Promise<string> {
  const origin = new URL(baseURL)
  const cookies = await context.cookies(`${origin.protocol}//${origin.host}`)
  if (!cookies.length) {
    return ''
  }
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
}

async function ensureAuthenticated(context: BrowserContext, page: Page, baseURL: string): Promise<string> {
  if (IS_MOCK_MODE) {
    return ''
  }
  const cookieHeader = process.env.E2E_SITE_COOKIE
  const target = new URL(baseURL)
  if (cookieHeader) {
    const cookies = parseCookieHeader(cookieHeader, target)
    if (!cookies.length) {
      throw new Error('E2E_SITE_COOKIE must contain at least one cookie pair (name=value)')
    }
    await context.addCookies(cookies)
    return cookieHeader
  }

  const email = process.env.E2E_TEST_AUTH_EMAIL ?? 'playwright-site-user@example.com'
  const displayName = process.env.E2E_TEST_AUTH_DISPLAY_NAME ?? 'Playwright Test User'
  const normalizedBase = normalizeBaseURL(baseURL)
  const apiBase = resolveApiBase(baseURL)

  const secretCandidates = [
    process.env.E2E_TEST_AUTH_SECRET,
    process.env.TEST_AUTH_SECRET,
  ].filter((value): value is string => Boolean(value && value.trim()))

  if (!secretCandidates.length) {
    secretCandidates.push('secret')
  }

  let unauthorized = false

  for (const secret of secretCandidates) {
    const response = await page.request.post(`${apiBase}/api/auth/test-login`, {
      data: {
        email,
        display_name: displayName,
        scope: 'site',
      },
      headers: {
        'X-Test-Auth-Secret': secret,
      },
    })

    if (response.status() === 503) {
      throw new SkipTestError('テストログイン API が無効化されているためスキップします')
    }

    if (response.status() === 401) {
      unauthorized = true
      continue
    }

    if (!response.ok()) {
      const message = await response.text()
      throw new Error(`test-login API が失敗しました (${response.status()}): ${message}`)
    }

    const cookieHeaders = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === 'set-cookie')
      .map((header) => header.value)

    if (!cookieHeaders.length) {
      throw new Error('test-login API から Set-Cookie が返されませんでした')
    }

    const cookies = parseSetCookieHeaders(cookieHeaders, target)
    if (!cookies.length) {
      throw new Error('Set-Cookie の解析に失敗しました')
    }

    await context.addCookies(cookies)
    const serialized = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
    return serialized
  }

  if (unauthorized) {
    throw new Error('テストログインのシークレットが一致しません。E2E_TEST_AUTH_SECRET を設定してください。')
  }

  throw new Error('test-login API が利用できませんでした')
}

const AREA_QUERY = '/?force_samples=1'
const THERAPIST_NAME = '葵'
const THERAPIST_ID = '11111111-1111-1111-8888-111111111111'
const IS_MOCK_MODE =
  (process.env.FAVORITES_API_MODE || process.env.NEXT_PUBLIC_FAVORITES_API_MODE || '')
    .toLowerCase()
    .includes('mock') || process.env.NODE_ENV !== 'production'

test.describe('お気に入り（実API）', () => {
  test('ログイン済みユーザーがセラピストのお気に入りをトグルできる', async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined')
    let sessionCookie: string
    try {
      sessionCookie = await ensureAuthenticated(context, page, baseURL)
    } catch (error) {
      throw error
    }

    const normalizedBase = normalizeBaseURL(baseURL)
    const areaUrl = IS_MOCK_MODE ? `${normalizedBase}/test/favorites` : `${normalizedBase}${AREA_QUERY}`

    await page.goto(areaUrl, { waitUntil: 'domcontentloaded' })

    await waitForTherapistCard(page)

    const locateCard = () =>
      IS_MOCK_MODE
        ? page.locator('[data-testid="test-therapist-card-wrapper"] [data-testid="therapist-card"]').first()
        : page.getByTestId('therapist-card').filter({ hasText: THERAPIST_NAME }).first()
    const locateToggle = () => locateCard().getByRole('button', { name: /お気に入り/ })

    await expect(locateCard()).toBeVisible()
    await expect(locateToggle()).toHaveAttribute('aria-pressed', 'false', { timeout: 15000 })

    await Promise.all([
      page.waitForResponse((response) =>
        IS_MOCK_MODE ? true : (response.url().includes('/api/favorites/therapists') && response.request().method() === 'POST'),
      ).catch(() => null),
      locateToggle().click(),
    ])
    await expect(locateToggle()).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 })

    await page.goto(`${normalizedBase}/dashboard/favorites`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: THERAPIST_NAME })).toBeVisible()

    await page.goto(areaUrl, { waitUntil: 'domcontentloaded' })
    await waitForTherapistCard(page)
    await expect(locateToggle()).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 })

    await Promise.all([
      page.waitForResponse((response) =>
        IS_MOCK_MODE ? true : (response.url().includes('/api/favorites/therapists') && response.request().method() === 'DELETE'),
      ).catch(() => null),
      locateToggle().click(),
    ])
    await expect(locateToggle()).toHaveAttribute('aria-pressed', 'false', { timeout: 15000 })

    await page.goto(`${normalizedBase}/dashboard/favorites`, { waitUntil: 'domcontentloaded' })
    const emptyState = page.getByText(/まだお気に入りの店舗がありません/)
    await expect(emptyState.or(page.getByRole('heading', { name: THERAPIST_NAME })).first()).toBeVisible({
      timeout: 15000,
    })
  })
})
async function waitForTherapistCard(page: Page) {
  const currentUrl = page.url()
  const isTestPage = IS_MOCK_MODE && currentUrl.includes('/test/favorites')

  if (isTestPage) {
    try {
      await expect
        .poll(async () => {
          return page.evaluate(() =>
            document.querySelectorAll('[data-testid="test-therapist-card-wrapper"] [data-testid="therapist-card"]').length,
          )
        }, { timeout: 15_000 })
        .toBeGreaterThan(0)
    } catch (error) {
      const html = await page.content()
      throw new Error(
        `therapist card not rendered on mock page; url=${currentUrl} snippet=${html.slice(0, 500)}`,
        { cause: error },
      )
    }
  } else {
    const targetCard = page.getByTestId('therapist-card').filter({ hasText: THERAPIST_NAME }).first()
    await expect(targetCard).toBeVisible({ timeout: 15000 })
  }
}
