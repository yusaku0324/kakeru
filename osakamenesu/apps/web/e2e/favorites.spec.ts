import { test, expect } from '@playwright/test'

type CookieInput = {
  name: string
  value: string
  domain: string
  path: string
  httpOnly: boolean
  secure: boolean
}

function parseCookieHeader(header: string, domain: string): CookieInput[] {
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
        secure: domain !== '127.0.0.1',
      }
    })
    .filter((item): item is CookieInput => item !== null)
}

function normalizeBaseURL(baseURL: string): string {
  return baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
}

const AREA_QUERY = '/?area=京橋&page=1&force_samples=1'
const THERAPIST_NAME = '葵'

test.describe('お気に入り（実API）', () => {
  test.skip(!process.env.E2E_SITE_COOKIE, 'E2E_SITE_COOKIE is required for favorites E2E test')

  test('ログイン済みユーザーがセラピストのお気に入りをトグルできる', async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined')
    const cookieHeader = process.env.E2E_SITE_COOKIE as string
    const target = new URL(baseURL)
    const cookies = parseCookieHeader(cookieHeader, target.hostname)
    if (!cookies.length) {
      throw new Error('E2E_SITE_COOKIE must contain at least one cookie pair (name=value)')
    }

    await context.addCookies(cookies)

    const normalizedBase = normalizeBaseURL(baseURL)
    const areaUrl = `${normalizedBase}${AREA_QUERY}`

    await page.goto(areaUrl, { waitUntil: 'networkidle' })

    const therapistCard = page.getByTestId('therapist-card').filter({ hasText: THERAPIST_NAME }).first()
    await expect(therapistCard).toBeVisible()

    const toggleButton = therapistCard.getByRole('button', { name: /お気に入り/ })

    // Ensure deterministic starting state
    if ((await toggleButton.getAttribute('aria-pressed')) === 'true') {
      await toggleButton.click()
      await expect(toggleButton).toHaveAttribute('aria-pressed', 'false')
    }

    await toggleButton.click()
    await expect(toggleButton).toHaveAttribute('aria-pressed', 'true')

    await page.goto(`${normalizedBase}/dashboard/favorites`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: THERAPIST_NAME })).toBeVisible()

    await page.goto(areaUrl, { waitUntil: 'networkidle' })
    await expect(therapistCard).toBeVisible()
    const removeButton = therapistCard.getByRole('button', { name: /お気に入りから削除/ })
    await removeButton.click()
    await expect(removeButton).toHaveAttribute('aria-pressed', 'false')

    await page.goto(`${normalizedBase}/dashboard/favorites`, { waitUntil: 'networkidle' })
    const emptyState = page.getByText('お気に入りに登録した店舗はまだありません。')
    await expect(emptyState.or(page.getByRole('heading', { name: THERAPIST_NAME })).first()).toBeVisible()
  })
})
