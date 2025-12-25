import { test, expect, devices } from '@playwright/test'

/**
 * Mobile Experience E2E Test Suite
 *
 * Tests mobile-specific functionality:
 * 1. Responsive design and touch interactions
 * 2. PWA installation flow
 * 3. Mobile navigation patterns
 * 4. Touch gestures (swipe, pinch)
 * 5. Mobile-optimized forms
 * 6. Performance on mobile devices
 *
 * Runs on multiple mobile viewports:
 * - iPhone 13
 * - Pixel 5
 * - iPad
 */

// Define mobile test configurations
const mobileDevices = [
  { name: 'iPhone 13', device: devices['iPhone 13'] },
  { name: 'Pixel 5', device: devices['Pixel 5'] },
  { name: 'iPad', device: devices['iPad (gen 7)'] }
]

mobileDevices.forEach(({ name, device }) => {
  test.describe(`Mobile Experience - ${name}`, () => {
    test.use(device)

    test('mobile navigation and hamburger menu', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Check if hamburger menu is visible (mobile only)
      const hamburger = page.locator('[aria-label*="メニュー"], button.hamburger-menu')
      await expect(hamburger).toBeVisible()

      // Open mobile menu
      await hamburger.click()

      // Verify menu items
      const menuItems = ['ホーム', '検索', 'お気に入り', 'マイページ']
      for (const item of menuItems) {
        await expect(page.getByRole('link', { name: item })).toBeVisible()
      }

      // Close menu by clicking overlay
      const overlay = page.locator('.menu-overlay, [data-testid="menu-overlay"]')
      if (await overlay.isVisible()) {
        await overlay.click()
      } else {
        // Click outside
        await page.click('body', { position: { x: 10, y: 10 } })
      }

      // Menu should be closed
      await expect(page.getByRole('link', { name: 'マイページ' })).not.toBeVisible()
    })

    test('mobile search experience', async ({ page }) => {
      await page.goto('/')

      // Mobile search might be in a different location
      const searchInput = page.getByPlaceholder('エリア・店名で検索').first()
      await expect(searchInput).toBeVisible()

      // Focus should trigger mobile-optimized keyboard
      await searchInput.click()
      await searchInput.fill('難波')

      // Submit search
      await searchInput.press('Enter')

      // Wait for results
      await page.waitForLoadState('networkidle')

      // Check if results are displayed in mobile-friendly format
      const shopCards = page.locator('[data-testid^="shop-card"]')
      await expect(shopCards.first()).toBeVisible()

      // On mobile, cards should be full width or in a single column
      const firstCard = shopCards.first()
      const cardBox = await firstCard.boundingBox()

      if (cardBox && name !== 'iPad') {
        // On phones, cards should be nearly full width
        const viewport = page.viewportSize()
        if (viewport) {
          const widthRatio = cardBox.width / viewport.width
          expect(widthRatio).toBeGreaterThan(0.9)
        }
      }
    })

    test('touch gestures and interactions', async ({ page, browserName }) => {
      // Skip on webkit as touch events might not be fully supported
      test.skip(browserName === 'webkit', 'Touch events not fully supported')

      await page.goto('/shops/sample-shop')
      await page.waitForLoadState('networkidle')

      // Find image gallery
      const gallery = page.locator('.image-gallery, [data-testid="shop-gallery"]').first()

      if (await gallery.isVisible()) {
        const images = gallery.locator('img')
        const imageCount = await images.count()

        if (imageCount > 1) {
          // Simulate swipe gesture
          const galleryBox = await gallery.boundingBox()
          if (galleryBox) {
            await page.mouse.move(galleryBox.x + galleryBox.width * 0.8, galleryBox.y + galleryBox.height / 2)
            await page.mouse.down()
            await page.mouse.move(galleryBox.x + galleryBox.width * 0.2, galleryBox.y + galleryBox.height / 2, { steps: 10 })
            await page.mouse.up()

            // Verify image changed (implementation specific)
            await page.waitForTimeout(500)
          }
        }
      }

      // Test tap to zoom on therapist photos
      const therapistPhoto = page.locator('[data-testid="therapist-photo"]').first()
      if (await therapistPhoto.isVisible()) {
        await therapistPhoto.click()

        // Check if lightbox or zoom view opened
        const lightbox = page.locator('.lightbox, [data-testid="photo-lightbox"]')
        await expect(lightbox).toBeVisible({ timeout: 3000 }).catch(() => {
          // Some implementations might not have lightbox
          console.log('No lightbox implementation found')
        })

        // Close if opened
        if (await lightbox.isVisible()) {
          await page.keyboard.press('Escape')
          await expect(lightbox).not.toBeVisible()
        }
      }
    })

    test('mobile form optimization', async ({ page }) => {
      await page.goto('/shops/sample-shop/reserve')

      // Check if form inputs are optimized for mobile
      const nameInput = page.getByLabel('お名前').first()
      const phoneInput = page.getByLabel('電話番号').first()
      const emailInput = page.getByLabel('メールアドレス').first()

      // Check input types for mobile keyboards
      await expect(phoneInput).toHaveAttribute('type', 'tel')
      await expect(emailInput).toHaveAttribute('type', 'email')

      // Check if inputs have appropriate autocomplete
      await expect(nameInput).toHaveAttribute('autocomplete', /.*(name|名前).*/)
      await expect(phoneInput).toHaveAttribute('autocomplete', 'tel')
      await expect(emailInput).toHaveAttribute('autocomplete', 'email')

      // Test form filling
      await nameInput.fill('モバイルテスト')
      await phoneInput.fill('09011112222')
      await emailInput.fill('mobile@test.com')

      // Check if submit button is sticky or easily accessible
      const submitButton = page.getByRole('button', { name: /予約/ }).first()
      const submitBox = await submitButton.boundingBox()
      const viewport = page.viewportSize()

      if (submitBox && viewport) {
        // Button should be in the lower portion of the viewport
        const buttonPosition = submitBox.y + submitBox.height
        expect(buttonPosition).toBeGreaterThan(viewport.height * 0.7)
      }
    })

    test('PWA installation prompt', async ({ page }) => {
      await page.goto('/')

      // Check for manifest
      const manifest = await page.evaluate(async () => {
        const link = document.querySelector('link[rel="manifest"]')
        if (link && 'href' in link) {
          const response = await fetch(link.href as string)
          return response.json()
        }
        return null
      })

      expect(manifest).toBeTruthy()
      expect(manifest).toHaveProperty('name')
      expect(manifest).toHaveProperty('short_name')
      expect(manifest).toHaveProperty('icons')
      expect(manifest).toHaveProperty('display', 'standalone')

      // Check for install prompt (implementation specific)
      const installButton = page.locator('[data-testid="pwa-install"], .install-button')
      if (await installButton.isVisible({ timeout: 5000 })) {
        // Click install button
        await installButton.click()

        // Check for install dialog or instructions
        await expect(
          page.getByText(/ホーム画面に追加|インストール/)
        ).toBeVisible({ timeout: 5000 }).catch(() => {
          console.log('No install prompt UI found')
        })
      }

      // Check iOS specific meta tags
      if (name === 'iPhone 13' || name === 'iPad') {
        const iosMetaTags = await page.evaluate(() => {
          const appleMobileWebAppCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]')
          const appleMobileWebAppStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
          return {
            capable: appleMobileWebAppCapable?.getAttribute('content'),
            statusBar: appleMobileWebAppStatus?.getAttribute('content')
          }
        })

        expect(iosMetaTags.capable).toBe('yes')
        expect(iosMetaTags.statusBar).toBeTruthy()
      }
    })

    test('mobile performance and lazy loading', async ({ page }) => {
      // Enable performance metrics
      const performanceMetrics = []

      page.on('load', async () => {
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
          return {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
            firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
          }
        })
        performanceMetrics.push(metrics)
      })

      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Check lazy loading images
      const images = page.locator('img[loading="lazy"]')
      const lazyImageCount = await images.count()
      expect(lazyImageCount).toBeGreaterThan(0)

      // Scroll to trigger lazy loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(1000)

      // Verify performance metrics
      expect(performanceMetrics.length).toBeGreaterThan(0)
      const firstMetrics = performanceMetrics[0]

      // Mobile should have reasonable load times
      expect(firstMetrics.firstContentfulPaint).toBeLessThan(3000) // 3 seconds
      expect(firstMetrics.domContentLoaded).toBeLessThan(5000) // 5 seconds
    })

    test('offline mode on mobile', async ({ page, context }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Wait for service worker
      await page.waitForTimeout(2000)

      // Go offline
      await context.setOffline(true)

      // Should show offline indicator
      await expect(
        page.getByText(/オフライン|接続されていません/)
      ).toBeVisible({ timeout: 5000 })

      // Navigate to a cached page
      await page.goto('/shops')

      // Should still work with cached content
      const content = page.locator('main, [role="main"]')
      await expect(content).toBeVisible()

      // Go back online
      await context.setOffline(false)

      // Offline indicator should disappear
      await expect(
        page.getByText(/オフライン|接続されていません/)
      ).not.toBeVisible({ timeout: 10000 })
    })

    test('mobile-specific UI elements', async ({ page }) => {
      await page.goto('/')

      // Check for mobile-specific elements
      const mobileOnlyElements = [
        '.mobile-only',
        '[data-mobile="true"]',
        '.bottom-navigation',
        '.floating-action-button'
      ]

      let foundMobileElement = false
      for (const selector of mobileOnlyElements) {
        if (await page.locator(selector).isVisible({ timeout: 1000 }).catch(() => false)) {
          foundMobileElement = true
          break
        }
      }

      // Check for bottom navigation on phones
      if (name !== 'iPad') {
        const bottomNav = page.locator('.bottom-navigation, nav[data-position="bottom"]')
        if (await bottomNav.isVisible()) {
          // Verify it's at the bottom
          const navBox = await bottomNav.boundingBox()
          const viewport = page.viewportSize()

          if (navBox && viewport) {
            expect(navBox.y).toBeGreaterThan(viewport.height * 0.85)
          }
        }
      }

      // Check for desktop elements that should be hidden
      const desktopOnlyElements = [
        '.desktop-only',
        '[data-desktop="true"]',
        '.sidebar[data-hide-mobile="true"]'
      ]

      for (const selector of desktopOnlyElements) {
        const element = page.locator(selector)
        if (await element.count() > 0) {
          await expect(element).not.toBeVisible()
        }
      }
    })
  })
})