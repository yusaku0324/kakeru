import { test, expect } from '@playwright/test'

import { ensureDashboardAuthenticated, SkipTestError } from './utils/dashboard-auth'
import { resolveAdminExtraHeaders } from './utils/admin-headers'

/**
 * Minimal admin smoke suite intended to be stable in CI.
 * Assumptions:
 * - ADMIN_BASIC_USER / ADMIN_BASIC_PASS and TEST_AUTH_SECRET (or E2E_TEST_AUTH_SECRET)
 *   are available via the admin-e2e compose stack.
 * - Admin web/API containers are healthy before the runner starts.
 */

const adminHeaders = resolveAdminExtraHeaders()

test.describe('admin smoke', () => {
  if (adminHeaders) {
    test.use({ extraHTTPHeaders: adminHeaders })
  }
  test.beforeEach(async ({ page, context, baseURL }) => {
    const resolvedBase = baseURL ?? 'http://127.0.0.1:3000'
    try {
      await ensureDashboardAuthenticated(context, page, resolvedBase)
    } catch (error) {
      if (error instanceof SkipTestError) {
        test.skip(true, error.message)
      }
      throw error
    }
  })

  test('renders shops dashboard', async ({ page }) => {
    await page.goto('/admin/shops', { waitUntil: 'domcontentloaded' })
    await page.waitForURL('**/admin/shops')
    const title = page.getByTestId('admin-title')
    await expect(title).toBeVisible({ timeout: 30_000 })
    await expect(title).toHaveText(/店舗管理/)
  })

  test('renders reservations dashboard', async ({ page }) => {
    await page.goto('/admin/reservations', { waitUntil: 'domcontentloaded' })
    await page.waitForURL('**/admin/reservations')
    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByLabel('ステータス')).toBeVisible({ timeout: 30_000 })
  })
})
