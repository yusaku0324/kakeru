import { test, expect } from '@playwright/test'

/**
 * Push Notification E2E Test Suite
 *
 * Tests the complete push notification flow:
 * 1. User login
 * 2. Navigate to notification settings
 * 3. Enable push notifications
 * 4. Test notification delivery
 * 5. Verify notification interaction
 *
 * Prerequisites:
 * - User account with E2E_TEST_AUTH_SECRET configured
 * - HTTPS enabled (required for Service Worker)
 * - VAPID keys configured in backend
 */
test.describe('Push Notifications', () => {
  // Skip in CI environment where push notifications may not be supported
  test.skip(!!process.env.CI, 'Push notifications require user interaction')

  test.beforeEach(async ({ page, context }) => {
    // Grant notification permission at browser level
    await context.grantPermissions(['notifications'])

    // Login as test user
    const testAuthSecret = process.env.E2E_TEST_AUTH_SECRET
    if (testAuthSecret) {
      await page.goto('/auth/test-login', {
        waitUntil: 'networkidle'
      })

      await page.fill('input[name="email"]', 'test@example.com')
      await page.fill('input[name="secret"]', testAuthSecret)
      await page.click('button[type="submit"]')

      // Wait for redirect after login
      await page.waitForURL('/', { timeout: 10000 })
    }
  })

  test('user can enable push notifications', async ({ page }) => {
    // Navigate to account settings
    await page.goto('/account/settings')
    await page.waitForLoadState('networkidle')

    // Find push notification settings section
    const pushSection = page.locator('section:has-text("プッシュ通知")')
    await expect(pushSection).toBeVisible()

    // Check if already subscribed
    const toggleSwitch = pushSection.locator('button[role="switch"]')
    const isSubscribed = await toggleSwitch.getAttribute('aria-checked') === 'true'

    if (!isSubscribed) {
      // Click to enable
      await toggleSwitch.click()

      // Wait for subscription to complete
      await expect(toggleSwitch).toHaveAttribute('aria-checked', 'true', {
        timeout: 10000
      })

      // Verify success message
      await expect(page.getByText('プッシュ通知を有効にしました')).toBeVisible()
    }

    // Test notification button should be visible
    const testButton = pushSection.getByRole('button', { name: /テスト通知を送信/ })
    await expect(testButton).toBeVisible()
  })

  test('user can receive test notification', async ({ page, context }) => {
    // Navigate to settings
    await page.goto('/account/settings')
    await page.waitForLoadState('networkidle')

    const pushSection = page.locator('section:has-text("プッシュ通知")')

    // Ensure notifications are enabled
    const toggleSwitch = pushSection.locator('button[role="switch"]')
    const isSubscribed = await toggleSwitch.getAttribute('aria-checked') === 'true'

    if (!isSubscribed) {
      await toggleSwitch.click()
      await expect(toggleSwitch).toHaveAttribute('aria-checked', 'true')
    }

    // Listen for notification
    const notificationPromise = page.evaluateHandle(() => {
      return new Promise(resolve => {
        const originalShowNotification = ServiceWorkerRegistration.prototype.showNotification
        ServiceWorkerRegistration.prototype.showNotification = function(title, options) {
          resolve({ title, options })
          return originalShowNotification.call(this, title, options)
        }
      })
    })

    // Send test notification
    const testButton = pushSection.getByRole('button', { name: /テスト通知を送信/ })
    await testButton.click()

    // Wait for notification
    const notification = await notificationPromise.jsonValue()
    expect(notification.title).toContain('テスト通知')
  })

  test('user can disable push notifications', async ({ page }) => {
    await page.goto('/account/settings')
    await page.waitForLoadState('networkidle')

    const pushSection = page.locator('section:has-text("プッシュ通知")')
    const toggleSwitch = pushSection.locator('button[role="switch"]')

    // Enable first if disabled
    const isSubscribed = await toggleSwitch.getAttribute('aria-checked') === 'true'
    if (!isSubscribed) {
      await toggleSwitch.click()
      await expect(toggleSwitch).toHaveAttribute('aria-checked', 'true')
    }

    // Now disable
    await toggleSwitch.click()
    await expect(toggleSwitch).toHaveAttribute('aria-checked', 'false', {
      timeout: 10000
    })

    // Verify success message
    await expect(page.getByText('プッシュ通知を無効にしました')).toBeVisible()
  })

  test('notification permission denied state', async ({ page, context }) => {
    // Deny notification permission
    await context.clearPermissions()

    await page.goto('/account/settings')
    await page.waitForLoadState('networkidle')

    const pushSection = page.locator('section:has-text("プッシュ通知")')

    // Toggle should be disabled
    const toggleSwitch = pushSection.locator('button[role="switch"]')
    await expect(toggleSwitch).toBeDisabled()

    // Warning message should be shown
    await expect(pushSection.getByText('ブラウザの設定で通知がブロックされています')).toBeVisible()
  })

  test('service worker registration', async ({ page }) => {
    await page.goto('/')

    // Check if service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        return registrations.length > 0
      }
      return false
    })

    expect(swRegistered).toBe(true)

    // Check if push manager is available
    const pushSupported = await page.evaluate(() => {
      return 'PushManager' in window
    })

    expect(pushSupported).toBe(true)
  })

  test('offline notification queuing', async ({ page, context }) => {
    await page.goto('/account/settings')

    // Enable notifications
    const pushSection = page.locator('section:has-text("プッシュ通知")')
    const toggleSwitch = pushSection.locator('button[role="switch"]')

    const isSubscribed = await toggleSwitch.getAttribute('aria-checked') === 'true'
    if (!isSubscribed) {
      await toggleSwitch.click()
      await expect(toggleSwitch).toHaveAttribute('aria-checked', 'true')
    }

    // Go offline
    await context.setOffline(true)

    // Try to send test notification
    const testButton = pushSection.getByRole('button', { name: /テスト通知を送信/ })
    await testButton.click()

    // Should show offline indicator or handle gracefully
    // The exact behavior depends on implementation

    // Go back online
    await context.setOffline(false)

    // Verify sync happens (implementation specific)
  })
})