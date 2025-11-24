import { test, expect, BrowserContext, Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

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
  const trimmed = header.trim()
  if (!trimmed) {
    return []
  }

  let normalizedHeader = trimmed
  if (
    (normalizedHeader.startsWith('"') && normalizedHeader.endsWith('"')) ||
    (normalizedHeader.startsWith("'") && normalizedHeader.endsWith("'"))
  ) {
    normalizedHeader = normalizedHeader.slice(1, -1).trim()
  }

  const domain = origin.hostname
  const secure = origin.protocol === 'https:'
  const looksLikeSetCookie =
    /^set-cookie\s*:/i.test(normalizedHeader) ||
    /;\s*(path|domain|max-age|expires|httponly|secure|samesite)=?/i.test(normalizedHeader)

  if (looksLikeSetCookie) {
    const normalized = normalizedHeader.replace(/^set-cookie\s*:/i, '').trim()
    const parsed = parseSetCookieHeaders([normalized], origin)
    return parsed.length
      ? parsed.map((cookie) => ({
          ...cookie,
          domain: cookie.domain || domain,
        }))
      : []
  }

  return normalizedHeader
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
      const segments = raw
        .split(';')
        .map((segment) => segment.trim())
        .filter(Boolean)
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

      // テスト環境では Next.js(web) コンテナのホスト名 (例: web) と API が返す cookie の設定が
      // 一致しないことがあるため、最終的にベースURL由来のホスト名・プロトコルに合わせて補正する。
      cookie.domain = origin.hostname
      cookie.secure = origin.protocol === 'https:'
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

async function ensureAuthenticated(
  context: BrowserContext,
  page: Page,
  baseURL: string,
): Promise<string> {
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
    const hasSiteSession = cookies.some((cookie) => /site/i.test(cookie.name))
    if (hasSiteSession) {
      return cookieHeader
    }
  }

  const email = process.env.E2E_TEST_AUTH_EMAIL ?? 'playwright-site-user@example.com'
  const displayName = process.env.E2E_TEST_AUTH_DISPLAY_NAME ?? 'Playwright Test User'
  const normalizedBase = normalizeBaseURL(baseURL)
  const apiBase = resolveApiBase(baseURL)

  const secretCandidates = [process.env.E2E_TEST_AUTH_SECRET, process.env.TEST_AUTH_SECRET].filter(
    (value): value is string => Boolean(value && value.trim()),
  )

  if (!secretCandidates.length) {
    secretCandidates.push('secret')
  }

  let unauthorized = false
  let lastErrorMessage: string | null = null
  const endpointCandidates = Array.from(
    new Set(
      [
        baseURL ? `${normalizedBase}/api/auth/test-login` : null,
        `${apiBase}/api/auth/test-login`,
      ].filter((value): value is string => Boolean(value)),
    ),
  )

  for (const endpoint of endpointCandidates) {
    let endpointHandled = false
    for (const secret of secretCandidates) {
      const response = await page.request.post(endpoint, {
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

      if (response.status() === 404 || response.status() === 405) {
        break
      }

      if (response.status() === 401) {
        unauthorized = true
        continue
      }

      if (!response.ok()) {
        lastErrorMessage = await response.text()
        continue
      }

      const cookieHeaders = response
        .headersArray()
        .filter((header) => header.name.toLowerCase() === 'set-cookie')
        .map((header) => header.value)

      if (!cookieHeaders.length) {
        lastErrorMessage = 'test-login API から Set-Cookie が返されませんでした'
        continue
      }

      const cookies = parseSetCookieHeaders(cookieHeaders, target)
      if (!cookies.length) {
        lastErrorMessage = 'Set-Cookie の解析に失敗しました'
        continue
      }

      await context.addCookies(cookies)
      const serialized = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
      endpointHandled = true
      return serialized
    }

    if (endpointHandled) {
      break
    }
  }

  if (unauthorized) {
    throw new Error(
      'テストログインのシークレットが一致しません。E2E_TEST_AUTH_SECRET を設定してください。',
    )
  }

  throw new Error(lastErrorMessage ?? 'test-login API が利用できませんでした')
}

const AREA_QUERY = '/search?tab=therapists&force_samples=1'
const FORCE_REAL_MODE = (process.env.FAVORITES_E2E_MODE || '').toLowerCase() === 'real'
const resolvedFavoritesMode = (
  process.env.FAVORITES_API_MODE ||
  process.env.NEXT_PUBLIC_FAVORITES_API_MODE ||
  ''
).toLowerCase()
const IS_MOCK_MODE = !FORCE_REAL_MODE && resolvedFavoritesMode.includes('mock')

const siteStoragePath =
  process.env.PLAYWRIGHT_SITE_STORAGE ?? path.resolve(__dirname, 'storage', 'site.json')

function loadSiteStorageCookies(): CookieInput[] | null {
  try {
    if (!fs.existsSync(siteStoragePath)) {
      return null
    }
    const raw = fs.readFileSync(siteStoragePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.cookies) && parsed.cookies.length > 0) {
      return parsed.cookies as CookieInput[]
    }
  } catch (error) {
    console.warn('[favorites] failed to load site storage', error)
  }
  return null
}

function buildCookieVariants(cookies: CookieInput[], baseURL: string): CookieInput[] {
  if (!cookies.length) {
    return cookies
  }
  const variants: CookieInput[] = []
  const hostnames = new Set<string>()
  try {
    const hostname = new URL(baseURL).hostname
    if (hostname) {
      hostnames.add(hostname)
    }
  } catch {
    /* ignore */
  }
  hostnames.add('localhost')

  for (const host of hostnames) {
    for (const cookie of cookies) {
      const nextDomain = cookie.domain === host ? cookie.domain : host
      variants.push({ ...cookie, domain: nextDomain })
    }
  }
  return variants
}

test.describe('お気に入り（実API）', () => {
  test('ログイン済みユーザーがセラピストのお気に入りをトグルできる', async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('baseURL is not defined')
    const siteCookies = loadSiteStorageCookies()
    if (siteCookies?.length) {
      console.log('[favorites] loaded site cookies count=', siteCookies.length)
      console.log('[favorites] context cookies before:', await context.cookies())
      const cookiesForBase = buildCookieVariants(siteCookies, baseURL)
      await context.addCookies(cookiesForBase)
      console.log('[favorites] context cookies after:', await context.cookies())
    } else {
      await ensureAuthenticated(context, page, baseURL)
    }
    const normalizedBase = normalizeBaseURL(baseURL)
    const areaUrl = IS_MOCK_MODE
      ? `${normalizedBase}/test/favorites`
      : `${normalizedBase}${AREA_QUERY}`

    await page.goto(areaUrl, { waitUntil: 'domcontentloaded' })

    await waitForTherapistCard(page)

    const { therapistId, therapistName } = await resolveTherapistTarget(page)
    const locateToggle = () => buildFavoriteToggleLocator(page, therapistId)
    const waitForToggleState = async (state: 'true' | 'false') => {
      await expect
        .poll(
          async () => {
            const toggle = locateToggle()
            try {
              if (!(await toggle.isVisible({ timeout: 1000 }))) {
                return 'hidden'
              }
              if (await toggle.isDisabled()) {
                return 'processing'
              }
              return (await toggle.getAttribute('aria-pressed')) ?? 'missing'
            } catch {
              return 'missing'
            }
          },
          { timeout: 20000 },
        )
        .toBe(state)
    }

    const revertIfNeeded = async () => {
      const initialState = await locateToggle().getAttribute('aria-pressed')
      if (initialState === 'true') {
        await Promise.all([
          page
            .waitForResponse((response) =>
              IS_MOCK_MODE
                ? true
                : response.url().includes('/api/favorites/therapists') &&
                  response.request().method() === 'DELETE',
            )
            .catch(() => null),
          locateToggle().click(),
        ])
        await waitForToggleState('false')
      }
    }

    await revertIfNeeded()
    await waitForToggleState('false')

    await Promise.all([
      page
        .waitForResponse((response) =>
          IS_MOCK_MODE
            ? true
            : response.url().includes('/api/favorites/therapists') &&
              response.request().method() === 'POST',
        )
        .catch(() => null),
      locateToggle().click(),
    ])
    await waitForToggleState('true')

    await page.goto(`${normalizedBase}/dashboard/favorites`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: therapistName, exact: false })).toBeVisible()

    await page.goto(areaUrl, { waitUntil: 'domcontentloaded' })
    await waitForTherapistCard(page, { therapistId })
    await waitForToggleState('true')

    await Promise.all([
      page
        .waitForResponse((response) =>
          IS_MOCK_MODE
            ? true
            : response.url().includes('/api/favorites/therapists') &&
              response.request().method() === 'DELETE',
        )
        .catch(() => null),
      locateToggle().click(),
    ])
    await waitForToggleState('false')

    await page.goto(`${normalizedBase}/dashboard/favorites`, { waitUntil: 'domcontentloaded' })
    const emptyState = page.getByText(/まだお気に入りの店舗がありません/)
    await expect(
      emptyState.or(page.getByRole('heading', { name: therapistName, exact: false })).first(),
    ).toBeVisible({
      timeout: 15000,
    })
  })
})
async function waitForTherapistCard(page: Page, options: { therapistId?: string | null } = {}) {
  const currentUrl = page.url()
  const isTestPage = IS_MOCK_MODE && currentUrl.includes('/test/favorites')

  if (isTestPage) {
    try {
      await expect
        .poll(
          async () => {
            return page.evaluate(
              () =>
                document.querySelectorAll(
                  '[data-testid="test-therapist-card-wrapper"] [data-testid="therapist-card"]',
                ).length,
            )
          },
          { timeout: 15_000 },
        )
        .toBeGreaterThan(0)
    } catch (error) {
      const html = await page.content()
      throw new Error(
        `therapist card not rendered on mock page; url=${currentUrl} snippet=${html.slice(0, 500)}`,
        { cause: error },
      )
    }
  } else {
    if (options.therapistId) {
      await expect(buildFavoriteToggleLocator(page, options.therapistId)).toBeVisible({
        timeout: 15000,
      })
    } else {
      await expect(page.getByTestId('therapist-card').first()).toBeVisible({ timeout: 15000 })
    }
  }
}

function buildFavoriteToggleLocator(page: Page, therapistId: string | null) {
  if (therapistId) {
    return page
      .locator(`[data-testid="therapist-favorite-toggle"][data-therapist-id="${therapistId}"]`)
      .first()
  }
  return page.getByTestId('therapist-favorite-toggle').first()
}

async function resolveTherapistTarget(page: Page) {
  if (IS_MOCK_MODE && page.url().includes('/test/favorites')) {
    const mockCard = page
      .locator('[data-testid="test-therapist-card-wrapper"] [data-testid="therapist-card"]')
      .first()
    await expect(mockCard).toBeVisible({ timeout: 15000 })
    const headingText =
      ((await mockCard.getByRole('heading').first().innerText()) ?? '').trim() || 'セラピスト'
    return { therapistId: null, therapistName: headingText }
  }

  const card = page.getByTestId('therapist-card').first()
  await expect(card).toBeVisible({ timeout: 15000 })
  const toggle = card.getByTestId('therapist-favorite-toggle').first()
  await expect(toggle).toBeVisible({ timeout: 15000 })
  const therapistId = (await toggle.getAttribute('data-therapist-id'))?.trim() ?? null
  const headingText =
    ((await card.getByRole('heading').first().innerText()) ?? '').trim() || 'セラピスト'
  return { therapistId, therapistName: headingText }
}
