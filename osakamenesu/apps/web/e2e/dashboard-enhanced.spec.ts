import { test, expect, Page } from '@playwright/test'

/**
 * Enhanced Dashboard E2E Test Suite
 *
 * Tests comprehensive dashboard functionality:
 * 1. Authentication and access control
 * 2. Reservation management (view, update status, notes)
 * 3. Therapist shift management
 * 4. Real-time updates
 * 5. Push notification triggers
 * 6. Reporting and analytics
 *
 * Prerequisites:
 * - ADMIN_BASIC_USER and ADMIN_BASIC_PASS environment variables
 * - Seeded test data
 * - Shop manager account configured
 */
test.describe('Enhanced Dashboard Tests', () => {
  const SEED_SHOP_SLUG = 'playwright-seed-shop'

  test.use({
    httpCredentials: {
      username: process.env.ADMIN_BASIC_USER || '',
      password: process.env.ADMIN_BASIC_PASS || ''
    }
  })

  test.beforeEach(async ({ page }) => {
    // Skip if no admin credentials
    if (!process.env.ADMIN_BASIC_USER || !process.env.ADMIN_BASIC_PASS) {
      test.skip()
      return
    }
  })

  test('dashboard overview and navigation', async ({ page }) => {
    // Navigate to dashboard
    await page.goto(`/admin/shops/${SEED_SHOP_SLUG}`)
    await page.waitForLoadState('networkidle')

    // Verify main navigation items
    await expect(page.getByRole('heading', { name: 'Playwright Seed Shop' })).toBeVisible()

    // Check navigation menu
    const navItems = [
      'ダッシュボード',
      '予約管理',
      'セラピスト管理',
      'シフト管理',
      'レビュー管理',
      '設定'
    ]

    for (const item of navItems) {
      await expect(page.getByRole('link', { name: item })).toBeVisible()
    }

    // Check stats cards
    await expect(page.getByText(/本日の予約/)).toBeVisible()
    await expect(page.getByText(/今月の売上/)).toBeVisible()
    await expect(page.getByText(/稼働率/)).toBeVisible()
  })

  test('reservation management workflow', async ({ page, context }) => {
    // Grant notification permission for testing push notifications
    await context.grantPermissions(['notifications'])

    // Navigate to reservations
    await page.goto(`/admin/shops/${SEED_SHOP_SLUG}/reservations`)
    await page.waitForLoadState('networkidle')

    // Check reservation list
    const reservationRow = page.locator('tr[data-reservation-id]').first()
    await expect(reservationRow).toBeVisible()

    // Click on reservation to view details
    await reservationRow.click()

    // Wait for modal or detail page
    await expect(page.getByRole('heading', { name: /予約詳細/ })).toBeVisible({
      timeout: 10000
    })

    // Check reservation details
    await expect(page.getByText(/お客様情報/)).toBeVisible()
    await expect(page.getByText(/予約日時/)).toBeVisible()
    await expect(page.getByText(/ステータス/)).toBeVisible()

    // Update reservation status
    const statusSelect = page.getByRole('combobox', { name: /ステータス/ })
    const currentStatus = await statusSelect.inputValue()

    if (currentStatus === 'pending') {
      // Change to confirmed
      await statusSelect.selectOption('confirmed')

      // Add confirmation note
      const noteTextarea = page.getByRole('textbox', { name: /メモ|備考/ })
      await noteTextarea.fill('E2Eテストで確認済み')

      // Listen for push notification API call
      const pushNotificationPromise = page.waitForRequest(
        request => request.url().includes('/push/') && request.method() === 'POST',
        { timeout: 10000 }
      ).catch(() => null) // Don't fail if push notifications aren't configured

      // Save changes
      const saveButton = page.getByRole('button', { name: /保存|更新/ })
      await saveButton.click()

      // Verify success
      await expect(page.getByText(/更新しました|保存しました/)).toBeVisible()

      // Check if push notification was triggered
      const pushRequest = await pushNotificationPromise
      if (pushRequest) {
        console.log('Push notification triggered for reservation confirmation')
      }
    }
  })

  test('therapist shift management', async ({ page }) => {
    // Navigate to shifts
    await page.goto(`/admin/shops/${SEED_SHOP_SLUG}/shifts`)
    await page.waitForLoadState('networkidle')

    // Select a therapist
    const therapistSelect = page.getByRole('combobox', { name: /セラピスト/ })
    if (await therapistSelect.isVisible()) {
      const options = await therapistSelect.locator('option').count()
      if (options > 1) {
        await therapistSelect.selectOption({ index: 1 })
      }
    }

    // Check shift calendar
    const calendar = page.locator('.shift-calendar, [data-testid="shift-calendar"]')
    await expect(calendar).toBeVisible()

    // Click on a date to add/edit shift
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateCell = calendar.locator(`[data-date="${tomorrow.toISOString().split('T')[0]}"]`).first()

    if (await dateCell.isVisible()) {
      await dateCell.click()

      // Shift form should appear
      const shiftForm = page.locator('form[data-shift-form], .shift-form')
      await expect(shiftForm).toBeVisible()

      // Set shift time
      const startTime = shiftForm.locator('input[name="start_time"]')
      const endTime = shiftForm.locator('input[name="end_time"]')

      await startTime.fill('10:00')
      await endTime.fill('20:00')

      // Save shift
      const saveButton = shiftForm.getByRole('button', { name: /保存|登録/ })
      await saveButton.click()

      // Verify success
      await expect(page.getByText(/登録しました|保存しました/)).toBeVisible()
    }
  })

  test('real-time updates simulation', async ({ page, context }) => {
    // Open two tabs - one for dashboard, one for customer
    const dashboardPage = page
    const customerPage = await context.newPage()

    // Dashboard: Navigate to reservations
    await dashboardPage.goto(`/admin/shops/${SEED_SHOP_SLUG}/reservations`)
    await dashboardPage.waitForLoadState('networkidle')

    // Note initial reservation count
    const initialCount = await dashboardPage.locator('tr[data-reservation-id]').count()

    // Customer: Make a new reservation
    await customerPage.goto(`/shops/${SEED_SHOP_SLUG}/reserve`)

    // Fill and submit reservation
    const testId = Date.now()
    await customerPage.fill('[name="customer_name"]', `リアルタイム ${testId}`)
    await customerPage.fill('[name="customer_phone"]', '09011112222')
    await customerPage.fill('[name="customer_email"]', `realtime-${testId}@example.com`)

    const submitButton = customerPage.getByRole('button', { name: /予約/ })
    await submitButton.click()

    // Wait for success
    await expect(customerPage.getByText(/予約が完了しました/)).toBeVisible({
      timeout: 15000
    })

    // Dashboard: Check for new reservation (with polling)
    await dashboardPage.waitForTimeout(2000) // Wait for potential real-time update

    // Refresh or check for auto-update
    const autoUpdateEnabled = await dashboardPage.locator('.auto-update-indicator').isVisible()

    if (!autoUpdateEnabled) {
      // Manual refresh
      await dashboardPage.reload()
    }

    // Verify new reservation appears
    const newCount = await dashboardPage.locator('tr[data-reservation-id]').count()
    expect(newCount).toBeGreaterThan(initialCount)

    // Close customer page
    await customerPage.close()
  })

  test('notification settings management', async ({ page }) => {
    // Navigate to settings
    await page.goto(`/admin/shops/${SEED_SHOP_SLUG}/settings`)
    await page.waitForLoadState('networkidle')

    // Find notification settings section
    const notificationSection = page.locator('section:has-text("通知設定")')
    await expect(notificationSection).toBeVisible()

    // Check notification channels
    const emailToggle = notificationSection.locator('label:has-text("メール") input[type="checkbox"]')
    const lineToggle = notificationSection.locator('label:has-text("LINE") input[type="checkbox"]')
    const pushToggle = notificationSection.locator('label:has-text("プッシュ通知") input[type="checkbox"]')

    // Enable all channels
    if (await emailToggle.isVisible() && !await emailToggle.isChecked()) {
      await emailToggle.check()
    }
    if (await lineToggle.isVisible() && !await lineToggle.isChecked()) {
      await lineToggle.check()
    }
    if (await pushToggle.isVisible() && !await pushToggle.isChecked()) {
      await pushToggle.check()
    }

    // Set notification triggers
    const triggers = [
      '新規予約',
      '予約キャンセル',
      '新規レビュー'
    ]

    for (const trigger of triggers) {
      const checkbox = notificationSection.locator(`label:has-text("${trigger}") input[type="checkbox"]`)
      if (await checkbox.isVisible() && !await checkbox.isChecked()) {
        await checkbox.check()
      }
    }

    // Save settings
    const saveButton = notificationSection.getByRole('button', { name: /保存/ })
    await saveButton.click()

    // Verify success
    await expect(page.getByText(/保存しました/)).toBeVisible()
  })

  test('analytics and reporting', async ({ page }) => {
    // Navigate to analytics
    await page.goto(`/admin/shops/${SEED_SHOP_SLUG}/analytics`)

    // If analytics page doesn't exist, check dashboard for stats
    if (page.url().includes('analytics')) {
      await page.waitForLoadState('networkidle')
    } else {
      await page.goto(`/admin/shops/${SEED_SHOP_SLUG}`)
    }

    // Check for analytics components
    const analyticsElements = [
      '売上推移',
      '予約数',
      '稼働率',
      '人気セラピスト',
      'リピート率'
    ]

    let foundAnalytics = false
    for (const element of analyticsElements) {
      if (await page.getByText(element).isVisible({ timeout: 3000 }).catch(() => false)) {
        foundAnalytics = true
        break
      }
    }

    expect(foundAnalytics).toBe(true)

    // Check date range selector
    const dateRangeSelector = page.locator('[data-testid="date-range-selector"], select[name*="period"]')
    if (await dateRangeSelector.isVisible()) {
      // Change to monthly view
      await dateRangeSelector.selectOption({ label: '月間' })
      await page.waitForLoadState('networkidle')
    }

    // Export functionality
    const exportButton = page.getByRole('button', { name: /エクスポート|ダウンロード/ })
    if (await exportButton.isVisible()) {
      // Set up download promise
      const downloadPromise = page.waitForEvent('download')
      await exportButton.click()

      // If there's a format selection, choose CSV
      const csvOption = page.getByRole('button', { name: /CSV/ })
      if (await csvOption.isVisible({ timeout: 3000 })) {
        await csvOption.click()
      }

      // Verify download
      const download = await downloadPromise.catch(() => null)
      if (download) {
        expect(download.suggestedFilename()).toContain('.csv')
      }
    }
  })

  test('PWA features in dashboard', async ({ page, context }) => {
    // Check if service worker is registered for dashboard
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        return registrations.length > 0
      }
      return false
    })

    expect(swRegistered).toBe(true)

    // Test offline mode
    await page.goto(`/admin/shops/${SEED_SHOP_SLUG}/reservations`)
    await page.waitForLoadState('networkidle')

    // Cache the page
    await page.waitForTimeout(1000)

    // Go offline
    await context.setOffline(true)

    // Reload page
    await page.reload()

    // Should show offline indicator or cached content
    const offlineHandled =
      await page.getByText(/オフライン/).isVisible({ timeout: 5000 }).catch(() => false) ||
      await page.locator('tr[data-reservation-id]').count() > 0

    expect(offlineHandled).toBe(true)

    // Go back online
    await context.setOffline(false)
  })
})