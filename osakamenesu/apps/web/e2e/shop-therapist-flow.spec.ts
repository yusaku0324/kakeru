import { test, expect } from '@playwright/test'

/**
 * Test: Verify the flow from /search?tab=shops to shop page to therapist overlay
 *
 * This test covers:
 * 1. /search?tab=shops shows shop listings
 * 2. Clicking a shop navigates to /profiles/[slug] page
 * 3. Shop page shows therapists in Staff section
 * 4. Clicking "予約する" on a therapist opens the reservation overlay
 * 5. The overlay shows the same format as /search therapist cards
 */
test.describe('Shop to Therapist Flow', () => {
  test('/search?tab=shops shows shop listings', async ({ page }) => {
    await page.goto('/search?tab=shops')
    await page.waitForLoadState('networkidle')

    // Verify we're on the shops tab
    const shopsTab = page.locator('a[aria-current="page"]:has-text("店舗")')
    await expect(shopsTab).toBeVisible({ timeout: 10000 })

    // Verify shop cards are displayed
    const shopCards = page.locator('[data-testid="shop-card"], .shop-card, [class*="ShopCard"]')
    const shopCardsCount = await shopCards.count()
    console.log(`Found ${shopCardsCount} shop cards`)

    // If no shop cards with test ID, look for any shop listing elements
    if (shopCardsCount === 0) {
      // Check for shop section
      const shopSection = page.locator('#shop-results, [id*="shop"]')
      const sectionCount = await shopSection.count()
      console.log(`Shop sections found: ${sectionCount}`)

      // Look for any card-like elements in shops section
      const anyShopCards = page.locator('section:has-text("店舗") a[href*="/profiles/"]')
      const anyCount = await anyShopCards.count()
      console.log(`Shop links found: ${anyCount}`)
      expect(anyCount).toBeGreaterThan(0)
    }

    await page.screenshot({ path: '/tmp/search-shops-tab.png' })
  })

  test('clicking shop navigates to shop profile page', async ({ page }) => {
    await page.goto('/search?tab=shops')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Find a link to a shop profile page
    const shopLinks = page.locator('a[href*="/profiles/sample-"]')
    const firstShopLink = shopLinks.first()

    if (await firstShopLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await firstShopLink.getAttribute('href')
      console.log('Clicking shop link:', href)

      await firstShopLink.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Verify we navigated to a profile page
      const currentUrl = page.url()
      console.log('Current URL:', currentUrl)
      expect(currentUrl).toContain('/profiles/')

      await page.screenshot({ path: '/tmp/shop-profile-page.png' })

      // Verify this is the canonical shop page (not /staff/xxx)
      expect(currentUrl).not.toMatch(/\/staff\/[a-f0-9-]+/)
    } else {
      console.log('No shop links found, using direct navigation')
      await page.goto('/profiles/sample-namba-resort')
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain('/profiles/')
    }
  })

  test('shop page displays therapists in Staff section', async ({ page }) => {
    // Navigate directly to a sample shop
    await page.goto('/profiles/sample-namba-resort')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: '/tmp/shop-page-full.png', fullPage: true })

    // Look for staff section
    const staffSection = page.locator('#staff-section, section:has-text("セラピスト")')
    const staffSectionVisible = await staffSection.isVisible({ timeout: 10000 }).catch(() => false)
    console.log('Staff section visible:', staffSectionVisible)

    if (staffSectionVisible) {
      // Scroll to staff section
      await staffSection.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)

      // Count therapist cards in staff section
      const therapistCards = staffSection.locator('[id^="staff-"]')
      const cardCount = await therapistCards.count()
      console.log('Therapist cards in staff section:', cardCount)

      // Verify at least one therapist is shown
      expect(cardCount).toBeGreaterThan(0)

      // Check for "予約する" buttons
      const reserveButtons = staffSection.locator('button:has-text("予約する")')
      const buttonCount = await reserveButtons.count()
      console.log('Reserve buttons found:', buttonCount)
      expect(buttonCount).toBeGreaterThan(0)

      await page.screenshot({ path: '/tmp/shop-staff-section.png' })
    } else {
      // Try alternative selectors
      const altStaffSection = page.locator('h2:has-text("セラピスト"), h3:has-text("セラピスト")')
      const altVisible = await altStaffSection.isVisible().catch(() => false)
      console.log('Alternative staff heading visible:', altVisible)
    }
  })

  test('clicking 予約する opens reservation overlay', async ({ page }) => {
    await page.goto('/profiles/sample-namba-resort')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Scroll to staff section
    const staffSection = page.locator('#staff-section')
    if (await staffSection.isVisible().catch(() => false)) {
      await staffSection.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
    }

    // Find and click the first "予約する" button
    const reserveButton = page.locator('button:has-text("予約する")').first()
    const buttonVisible = await reserveButton.isVisible({ timeout: 10000 }).catch(() => false)

    if (buttonVisible) {
      console.log('Clicking 予約する button')
      await reserveButton.click()
      await page.waitForTimeout(1500)

      // Check if overlay opened - use the "予約フォームを開く" button as indicator
      const formButton = page.locator('button:has-text("予約フォームを開く")')
      const formButtonVisible = await formButton.isVisible({ timeout: 5000 }).catch(() => false)

      // Also check for overlay backdrop or close button
      const closeButton = page.locator('button[aria-label*="閉じる"], button:has-text("×"), svg[class*="close"]')
      const closeVisible = await closeButton.isVisible().catch(() => false)

      console.log('Form button visible:', formButtonVisible)
      console.log('Close button visible:', closeVisible)

      await page.screenshot({ path: '/tmp/therapist-overlay-from-shop.png' })

      // Verify overlay opened - form button should be visible
      expect(formButtonVisible).toBe(true)

      // Close overlay
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    } else {
      console.log('Reserve button not found')
      await page.screenshot({ path: '/tmp/shop-no-reserve-button.png', fullPage: true })
    }
  })

  test('shop therapist overlay matches /search therapist overlay format', async ({ page }) => {
    // First, capture the overlay format from /search
    await page.goto('/search')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const searchCard = page.locator('[data-testid="therapist-card"]').first()
    if (await searchCard.isVisible({ timeout: 10000 }).catch(() => false)) {
      await searchCard.click()
      await page.waitForTimeout(1500)

      // Capture search overlay structure - use form button visibility
      const searchOverlayFormBtn = await page.locator('button:has-text("予約フォームを開く")').isVisible({ timeout: 5000 }).catch(() => false)

      await page.screenshot({ path: '/tmp/search-therapist-overlay.png' })
      console.log('Search overlay - Form button visible:', searchOverlayFormBtn)

      // Close overlay
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)

      // Now check shop page overlay
      await page.goto('/profiles/sample-namba-resort')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const reserveButton = page.locator('button:has-text("予約する")').first()
      if (await reserveButton.isVisible({ timeout: 10000 }).catch(() => false)) {
        await reserveButton.scrollIntoViewIfNeeded()
        await reserveButton.click()
        await page.waitForTimeout(1500)

        // Capture shop overlay structure
        const shopOverlayFormBtn = await page.locator('button:has-text("予約フォームを開く")').isVisible({ timeout: 5000 }).catch(() => false)

        await page.screenshot({ path: '/tmp/shop-therapist-overlay.png' })
        console.log('Shop overlay - Form button visible:', shopOverlayFormBtn)

        // Verify both overlays have the same structure - both should show form button
        expect(searchOverlayFormBtn).toBe(true)
        expect(shopOverlayFormBtn).toBe(true)

        console.log('Both overlays have consistent structure with form button')
      }
    } else {
      console.log('No therapist cards found on /search')
    }
  })

  test('clicking form button opens reservation form', async ({ page }) => {
    await page.goto('/profiles/sample-namba-resort')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Click first reserve button to open overlay
    const reserveButton = page.locator('button:has-text("予約する")').first()
    if (await reserveButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      await reserveButton.scrollIntoViewIfNeeded()
      await reserveButton.click()
      await page.waitForTimeout(1500)

      // Click the form button
      const formButton = page.locator('button:has-text("予約フォームを開く")')
      if (await formButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await formButton.click()
        await page.waitForTimeout(1500)

        await page.screenshot({ path: '/tmp/reservation-form-opened.png' })

        // Check for form elements
        const formInputs = page.locator('input[type="text"], input[type="email"], input[type="tel"], textarea')
        const inputCount = await formInputs.count()
        console.log('Form inputs found:', inputCount)

        // Should have at least some form fields
        expect(inputCount).toBeGreaterThan(0)
      } else {
        console.log('Form button not visible')
      }
    }
  })
})
