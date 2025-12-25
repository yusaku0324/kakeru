import { test, expect, Page } from '@playwright/test'

/**
 * Enhanced Reservation Flow E2E Test
 *
 * This test covers the complete reservation journey including:
 * 1. Shop search and selection
 * 2. Therapist selection with availability checking
 * 3. Reservation form submission
 * 4. Confirmation with push notification
 * 5. Dashboard verification
 *
 * Prerequisites:
 * - Seeded test data via seed_admin_test_data.py
 * - Test user account configured
 * - Push notification support
 */
test.describe('Enhanced Reservation Flow', () => {
  const SEED_SHOP_SLUG = 'playwright-seed-shop'
  const testRunId = Date.now()

  // Helper function to login
  async function loginAsTestUser(page: Page) {
    const testAuthSecret = process.env.E2E_TEST_AUTH_SECRET
    if (!testAuthSecret) {
      console.log('Skipping login: E2E_TEST_AUTH_SECRET not set')
      return false
    }

    await page.goto('/auth/test-login')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="secret"]', testAuthSecret)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })
    return true
  }

  test('complete reservation journey with notifications', async ({ page, context }) => {
    // Grant notification permission for push notifications
    await context.grantPermissions(['notifications'])

    // Login first
    const isLoggedIn = await loginAsTestUser(page)

    // Step 1: Search for shop
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Search for seeded shop
    const searchInput = page.getByPlaceholder('エリア・店名で検索')
    await searchInput.fill(SEED_SHOP_SLUG)
    await searchInput.press('Enter')

    // Wait for search results
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000) // Wait for search to complete

    // Click on the shop card
    const shopCard = page.locator(`[data-testid="shop-card-${SEED_SHOP_SLUG}"]`).first()
    if (!await shopCard.isVisible()) {
      // Fallback: click any shop card with the name
      await page.getByText('Playwright Seed Shop').first().click()
    } else {
      await shopCard.click()
    }

    // Step 2: Shop detail page
    await page.waitForURL(`**/shops/${SEED_SHOP_SLUG}`)
    await expect(page.getByRole('heading', { name: 'Playwright Seed Shop' })).toBeVisible()

    // Check therapist availability
    const therapistCard = page.locator('[data-testid^="therapist-card"]').first()
    await expect(therapistCard).toBeVisible()

    // Check for available time slots
    const availableSlot = therapistCard.locator('.availability-slot.available').first()
    if (await availableSlot.count() > 0) {
      await availableSlot.click()
    } else {
      // Click on therapist card to see more availability
      await therapistCard.click()
    }

    // Step 3: Reservation form
    await expect(page.getByRole('heading', { name: /予約/ })).toBeVisible({
      timeout: 15000
    })

    // Fill customer information
    const nameInput = page.getByLabel('お名前')
    const phoneInput = page.getByLabel('電話番号')
    const emailInput = page.getByLabel('メールアドレス')

    await nameInput.fill(`E2Eテスト ${testRunId}`)
    await phoneInput.fill('09012345678')
    await emailInput.fill(`e2e-${testRunId}@example.com`)

    // Select course if available
    const courseSelect = page.getByLabel('コース')
    if (await courseSelect.isVisible()) {
      const options = await courseSelect.locator('option').count()
      if (options > 1) {
        await courseSelect.selectOption({ index: 1 })
      }
    }

    // Add notes
    const notesTextarea = page.getByLabel('ご要望・備考')
    if (await notesTextarea.isVisible()) {
      await notesTextarea.fill('E2Eテスト予約です')
    }

    // Listen for API response
    const reservationResponsePromise = page.waitForResponse(
      response => response.url().includes('/api') &&
                  response.url().includes('reservation') &&
                  response.request().method() === 'POST',
      { timeout: 30000 }
    )

    // Submit reservation
    const submitButton = page.getByRole('button', { name: /予約を確定/ })
    await submitButton.click()

    // Wait for response
    const reservationResponse = await reservationResponsePromise
    const responseData = await reservationResponse.json()

    // Verify response
    expect(reservationResponse.status()).toBe(200)
    expect(responseData).toHaveProperty('id')

    // Step 4: Check confirmation page
    await expect(page.getByText(/予約が完了しました|予約を受け付けました/)).toBeVisible({
      timeout: 15000
    })

    // If logged in, check for push notification setup
    if (isLoggedIn) {
      // Check if notification prompt appears
      const notificationPrompt = page.getByText(/通知を受け取る/)
      if (await notificationPrompt.isVisible({ timeout: 5000 })) {
        await notificationPrompt.click()
      }
    }

    // Store reservation ID for later verification
    const reservationId = responseData.id

    // Step 5: Verify in dashboard (if admin credentials available)
    if (process.env.ADMIN_BASIC_USER && process.env.ADMIN_BASIC_PASS) {
      // Open new tab for admin
      const adminPage = await context.newPage()

      // Set basic auth
      await adminPage.setExtraHTTPHeaders({
        'Authorization': 'Basic ' + Buffer.from(
          `${process.env.ADMIN_BASIC_USER}:${process.env.ADMIN_BASIC_PASS}`
        ).toString('base64')
      })

      // Navigate to admin reservations
      await adminPage.goto(`/admin/shops/${SEED_SHOP_SLUG}/reservations`)
      await adminPage.waitForLoadState('networkidle')

      // Search for the reservation
      const searchBox = adminPage.getByPlaceholder('名前・電話番号で検索')
      await searchBox.fill(`E2Eテスト ${testRunId}`)
      await searchBox.press('Enter')

      // Verify reservation appears
      await expect(adminPage.getByText(`E2Eテスト ${testRunId}`)).toBeVisible({
        timeout: 10000
      })

      await adminPage.close()
    }
  })

  test('reservation with offline mode', async ({ page, context }) => {
    // Enable offline mode after loading the page
    await page.goto(`/shops/${SEED_SHOP_SLUG}`)
    await page.waitForLoadState('networkidle')

    // Go offline
    await context.setOffline(true)

    // Verify offline indicator appears
    await expect(page.getByText(/オフライン|接続されていません/)).toBeVisible({
      timeout: 5000
    })

    // Try to make a reservation
    const therapistCard = page.locator('[data-testid^="therapist-card"]').first()
    await therapistCard.click()

    // Should show offline message or cached data
    const offlineMessage = page.getByText(/オフライン中|後で同期/)
    const cachedForm = page.getByRole('heading', { name: /予約/ })

    // Either offline message or cached form should be visible
    const hasOfflineHandling =
      await offlineMessage.isVisible({ timeout: 5000 }).catch(() => false) ||
      await cachedForm.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasOfflineHandling).toBe(true)

    // Go back online
    await context.setOffline(false)

    // Verify reconnection
    await expect(page.getByText(/オフライン|接続されていません/)).not.toBeVisible({
      timeout: 10000
    })
  })

  test('reservation cancellation flow', async ({ page }) => {
    // First create a reservation
    await page.goto(`/shops/${SEED_SHOP_SLUG}/reserve`)

    // Quick reservation form
    await page.fill('[name="customer_name"]', `キャンセルテスト ${testRunId}`)
    await page.fill('[name="customer_phone"]', '09087654321')
    await page.fill('[name="customer_email"]', `cancel-${testRunId}@example.com`)

    // Submit
    const submitResponse = page.waitForResponse(
      response => response.url().includes('reservation') && response.status() === 200
    )

    await page.click('button[type="submit"]')
    const response = await submitResponse
    const { id: reservationId } = await response.json()

    // Navigate to reservation detail
    await page.goto(`/reservations/${reservationId}`)

    // Cancel reservation
    const cancelButton = page.getByRole('button', { name: /キャンセル/ })
    await expect(cancelButton).toBeVisible()

    // Confirm cancellation
    await cancelButton.click()

    const confirmButton = page.getByRole('button', { name: /確定|はい/ })
    await confirmButton.click()

    // Verify cancellation
    await expect(page.getByText(/キャンセルされました|取り消されました/)).toBeVisible({
      timeout: 10000
    })
  })

  test('favorite shop reservation flow', async ({ page }) => {
    const isLoggedIn = await loginAsTestUser(page)
    if (!isLoggedIn) {
      test.skip()
      return
    }

    // Add shop to favorites
    await page.goto(`/shops/${SEED_SHOP_SLUG}`)

    const favoriteButton = page.locator('[aria-label*="お気に入り"]').first()
    const isFavorited = await favoriteButton.getAttribute('data-favorited') === 'true'

    if (!isFavorited) {
      await favoriteButton.click()
      await expect(page.getByText(/お気に入りに追加/)).toBeVisible()
    }

    // Go to favorites page
    await page.goto('/favorites')
    await expect(page.getByText('Playwright Seed Shop')).toBeVisible()

    // Make reservation from favorites
    const reserveButton = page.getByRole('button', { name: /予約する/ }).first()
    await reserveButton.click()

    // Should navigate to reservation page
    await expect(page).toHaveURL(/reserve/)
  })
})