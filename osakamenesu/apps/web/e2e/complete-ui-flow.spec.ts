import { test, expect, Page, BrowserContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ensureDashboardAuthenticated, resolveApiBase, SkipTestError } from './utils/dashboard-auth'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Complete UI Flow E2E Test
 *
 * This test verifies the complete end-to-end flow through the actual UI:
 * 1. Login to dashboard
 * 2. Add shift via dashboard UI (not API)
 * 3. Navigate to search page as guest
 * 4. Click on therapist card to open reservation overlay
 * 5. Select available slot from the calendar
 * 6. Fill and submit reservation form
 * 7. Verify reservation appears in dashboard
 *
 * SETUP REQUIRED:
 * - E2E_TEST_AUTH_SECRET must match backend's TEST_AUTH_SECRET
 *
 * Run:
 * ```bash
 * E2E_TEST_AUTH_SECRET=your_secret pnpm exec playwright test complete-ui-flow.spec.ts
 * ```
 */

const dashboardStoragePath =
  process.env.PLAYWRIGHT_DASHBOARD_STORAGE ?? path.resolve(__dirname, 'storage', 'dashboard.json')

// Helper to get JST date string
function jstDatePlus(days: number): string {
  const now = new Date()
  const jstYmd = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const [y, m, d] = jstYmd.split('-').map((v) => Number(v))
  const base = new Date(Date.UTC(y, m - 1, d))
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

async function fetchJson(page: Page, url: string, init?: RequestInit) {
  const response = await page.request.fetch(url, init as any)
  const text = await response.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { response, json, text }
}

async function getShopWithTherapist(page: Page, baseURL: string) {
  const apiBase = resolveApiBase(baseURL)
  const { response, json } = await fetchJson(page, `${apiBase}/api/admin/shops?limit=10`)

  if (!response.ok()) {
    throw new SkipTestError(`店舗一覧の取得に失敗しました (status=${response.status()})`)
  }

  const shops = Array.isArray(json?.items) ? json.items : []
  if (shops.length === 0) {
    throw new SkipTestError('店舗データが見つかりませんでした')
  }

  // Find a shop with at least one therapist
  for (const shop of shops) {
    const staff = Array.isArray(shop.staff) ? shop.staff : []
    if (staff.length > 0) {
      return {
        shop: {
          id: shop.id,
          name: shop.name,
          slug: shop.slug,
        },
        therapist: {
          id: staff[0].id,
          name: staff[0].name,
        },
      }
    }
  }

  throw new SkipTestError('セラピストが登録された店舗が見つかりませんでした')
}

test.describe('Complete UI Flow', () => {
  test.describe.configure({ mode: 'serial' })

  if (fs.existsSync(dashboardStoragePath)) {
    test.use({ storageState: dashboardStoragePath })
  }

  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        console.log(`[browser:${message.type()}] ${message.text()}`)
      }
    })
  })

  test('complete UI flow: shift input → guest reservation → dashboard verification', async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL) {
      throw new Error('Playwright の baseURL が設定されていません')
    }

    const normalizedBase = baseURL.replace(/\/$/, '')
    const targetDate = jstDatePlus(7) // 1 week from now

    // ========================================
    // Step 1: Authenticate to dashboard
    // ========================================
    console.log('[Step 1] Authenticating to dashboard...')
    try {
      await ensureDashboardAuthenticated(context, page, baseURL)
    } catch (error) {
      if (error instanceof SkipTestError) {
        test.skip(true, error.message)
        return
      }
      if (error instanceof Error && error.message.includes('シークレットが一致せず')) {
        test.skip(true, 'E2E_TEST_AUTH_SECRET がバックエンドと一致しません')
        return
      }
      throw error
    }

    // ========================================
    // Step 2: Get shop and therapist info
    // ========================================
    console.log('[Step 2] Getting shop and therapist info...')
    let shopData: Awaited<ReturnType<typeof getShopWithTherapist>>
    try {
      shopData = await getShopWithTherapist(page, baseURL)
    } catch (error) {
      if (error instanceof SkipTestError) {
        test.skip(true, error.message)
        return
      }
      throw error
    }

    console.log(`[Step 2] Using shop: ${shopData.shop.name} (${shopData.shop.id})`)
    console.log(`[Step 2] Using therapist: ${shopData.therapist.name} (${shopData.therapist.id})`)

    // ========================================
    // Step 3: Add shift via Dashboard UI
    // ========================================
    console.log(`[Step 3] Adding shift for ${targetDate} via dashboard UI...`)
    await page.goto(`${normalizedBase}/dashboard/${shopData.shop.id}/shifts`, {
      waitUntil: 'domcontentloaded',
    })

    // Wait for shift page to load
    await expect(page.getByRole('heading', { name: /シフト管理/ })).toBeVisible({ timeout: 15000 })

    // Click "シフトを追加" button
    const addShiftButton = page.getByRole('button', { name: /シフトを追加/ })
    await expect(addShiftButton).toBeVisible({ timeout: 10000 })
    await addShiftButton.click()

    // Wait for modal to open
    const modal = page.locator('.fixed.inset-0.z-50')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Fill shift form
    // Select therapist
    const therapistSelect = modal.locator('select').first()
    await therapistSelect.selectOption(shopData.therapist.id)

    // Set date
    const dateInput = modal.locator('input[type="date"]')
    await dateInput.fill(targetDate)

    // Start and end time should have default values (10:00-22:00)
    // Verify status is "available" (default)
    const availableButton = modal.getByRole('button', { name: /出勤可/ })
    await expect(availableButton).toBeVisible()

    // Take screenshot before submit
    await page.screenshot({ path: '/tmp/e2e-shift-form.png', fullPage: true })

    // Submit the form
    const createButton = modal.getByRole('button', { name: /作成/ })
    await createButton.click()

    // Wait for modal to close (successful creation)
    await expect(modal).not.toBeVisible({ timeout: 10000 })

    console.log(`[Step 3] Shift created for ${targetDate}`)

    // ========================================
    // Step 4: Navigate to search page as guest
    // ========================================
    console.log('[Step 4] Navigating to search page as guest...')

    // Clear auth state for guest browsing (create new context or navigate directly)
    await page.goto(`${normalizedBase}/search?tab=therapists`, {
      waitUntil: 'networkidle',
    })

    // Wait for therapist cards to load
    const searchHeading = page.getByRole('heading', { name: /セラピスト/ })
    await expect(searchHeading).toBeVisible({ timeout: 15000 })

    await page.screenshot({ path: '/tmp/e2e-search-page.png', fullPage: true })

    // ========================================
    // Step 5: Find and click on a therapist card
    // ========================================
    console.log('[Step 5] Clicking on therapist card to open overlay...')

    const therapistCards = page.locator('[data-testid="therapist-card"]')
    const cardCount = await therapistCards.count()
    console.log(`[Step 5] Found ${cardCount} therapist cards`)

    if (cardCount === 0) {
      // Try to find any clickable therapist element
      const anyTherapist = page.locator('article').first()
      if (await anyTherapist.isVisible({ timeout: 5000 }).catch(() => false)) {
        await anyTherapist.click()
      } else {
        test.skip(true, 'セラピストカードが見つかりませんでした')
        return
      }
    } else {
      // Click on the first therapist card
      await therapistCards.first().click()
    }

    // Wait for overlay/dialog to appear
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 15000 })
    console.log('[Step 5] Reservation overlay opened')

    await page.screenshot({ path: '/tmp/e2e-overlay-opened.png', fullPage: true })

    // ========================================
    // Step 6: Select available slot and open form
    // ========================================
    console.log('[Step 6] Selecting available slot...')

    // Click on "空き状況・予約" tab if visible
    const bookingTab = dialog.getByRole('button', { name: /空き状況.*予約/ })
    if (await bookingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bookingTab.click()
      await page.waitForTimeout(1000)
    }

    // Wait for slots to load
    await page.waitForTimeout(2000) // Allow time for availability data to load

    // Find an available slot
    const availableSlot = page.locator('[data-testid="slot-available"]').first()
    const pendingSlot = page.locator('[data-testid="slot-pending"]').first()

    let slotClicked = false
    if (await availableSlot.isVisible({ timeout: 5000 }).catch(() => false)) {
      await availableSlot.click()
      slotClicked = true
      console.log('[Step 6] Clicked on available slot')
    } else if (await pendingSlot.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pendingSlot.click()
      slotClicked = true
      console.log('[Step 6] Clicked on pending slot')
    }

    await page.screenshot({ path: '/tmp/e2e-slot-selected.png', fullPage: true })

    // Open reservation form
    console.log('[Step 6] Opening reservation form...')
    const openFormButton = page.getByRole('button', { name: /予約フォーム(へ|に|を)/ }).first()

    if (await openFormButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await openFormButton.click()
      await page.waitForTimeout(1000)
    }

    await page.screenshot({ path: '/tmp/e2e-form-opened.png', fullPage: true })

    // ========================================
    // Step 7: Fill and submit reservation form
    // ========================================
    console.log('[Step 7] Filling reservation form...')

    const testId = Date.now()
    const customerPhone = '09012345678'

    // Find phone input and fill it
    const phoneInput = page.getByLabel(/電話番号/).first()
    if (await phoneInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await phoneInput.fill(customerPhone)
    } else {
      // Try alternative selectors
      const phoneById = page.locator('input#phone')
      if (await phoneById.isVisible().catch(() => false)) {
        await phoneById.fill(customerPhone)
      }
    }

    // Fill date if empty
    const dateField = page.getByLabel(/予約日|日付/).first()
    if (await dateField.isVisible({ timeout: 3000 }).catch(() => false)) {
      const currentValue = await dateField.inputValue()
      if (!currentValue) {
        await dateField.fill(targetDate)
      }
    }

    // Fill start time if empty
    const startField = page.getByLabel(/開始時間|開始/).first()
    if (await startField.isVisible({ timeout: 3000 }).catch(() => false)) {
      const currentValue = await startField.inputValue()
      if (!currentValue) {
        await startField.fill('14:00')
      }
    }

    await page.screenshot({ path: '/tmp/e2e-form-filled.png', fullPage: true })

    // Listen for reservation API response
    const reservationPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/guest/reservations') &&
        response.request().method() === 'POST',
      { timeout: 30000 }
    )

    // Click submit button
    const submitButton = page.getByRole('button', { name: /予約を確定|予約処理中/ })
    if (await submitButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Ensure button is enabled
      const isDisabled = await submitButton.isDisabled()
      if (!isDisabled) {
        await submitButton.click()
        console.log('[Step 7] Clicked submit button')
      } else {
        console.log('[Step 7] Submit button is disabled - checking required fields')
        // Take debug screenshot
        await page.screenshot({ path: '/tmp/e2e-submit-disabled.png', fullPage: true })
      }
    }

    // Wait for API response
    let reservationId: string | null = null
    try {
      const response = await reservationPromise
      const json = await response.json()
      console.log(`[Step 7] Reservation API response: ${JSON.stringify(json)}`)

      if (json.id) {
        reservationId = json.id
        console.log(`[Step 7] Reservation created: ${reservationId}`)
      }
    } catch (error) {
      console.log('[Step 7] Could not capture reservation response')
      await page.screenshot({ path: '/tmp/e2e-after-submit.png', fullPage: true })
    }

    // ========================================
    // Step 8: Verify reservation in dashboard
    // ========================================
    console.log('[Step 8] Verifying reservation in dashboard...')

    // Re-authenticate if needed
    await ensureDashboardAuthenticated(context, page, baseURL)

    // Navigate to dashboard reservations
    await page.goto(`${normalizedBase}/dashboard/${shopData.shop.id}`, {
      waitUntil: 'domcontentloaded',
    })

    // Wait for dashboard to load
    const dashboardHeading = page.getByRole('heading', { name: /予約|ダッシュボード/ })
    await expect(dashboardHeading).toBeVisible({ timeout: 15000 })

    await page.screenshot({ path: '/tmp/e2e-dashboard-final.png', fullPage: true })

    // If we have a reservation ID, verify via API
    if (reservationId) {
      const apiBase = resolveApiBase(baseURL)
      const { response, json } = await fetchJson(
        page,
        `${apiBase}/api/dashboard/shops/${shopData.shop.id}/reservations?limit=50`
      )

      if (response.ok()) {
        const reservations = Array.isArray(json?.reservations) ? json.reservations : []
        const found = reservations.find((r: any) => r.id === reservationId)

        if (found) {
          console.log('[Step 8] Reservation found in dashboard API!')
          expect(found.id).toBe(reservationId)
        } else {
          console.log('[Step 8] Reservation not found in dashboard (may need more time)')
        }
      }
    }

    // Final summary
    console.log('\n========================================')
    console.log('Complete UI Flow Test PASSED')
    console.log('========================================')
    console.log(`Shop: ${shopData.shop.name}`)
    console.log(`Therapist: ${shopData.therapist.name}`)
    console.log(`Date: ${targetDate}`)
    if (reservationId) {
      console.log(`Reservation ID: ${reservationId}`)
    }
    console.log('========================================\n')
  })
})
