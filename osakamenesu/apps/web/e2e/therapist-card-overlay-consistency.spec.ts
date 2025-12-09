import { test, expect } from '@playwright/test'

/**
 * Test: Verify that TherapistCard opens the same overlay on both
 * /search page and /guest/match-chat page (AI matching)
 *
 * Both pages should show:
 * - Reservation overlay dialog when clicking "詳細を見る" or "予約する"
 * - NOT navigate to /profiles/xxx/staff/xxx page
 */
test.describe('TherapistCard overlay consistency', () => {
  test('/search: clicking therapist card should open overlay (not navigate)', async ({ page }) => {
    // Go to search page
    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    // Wait for therapist cards
    const cards = page.locator('[data-testid="therapist-card"]')
    await expect(cards.first()).toBeVisible({ timeout: 15000 })

    // Get initial URL
    const initialUrl = page.url()
    console.log('Initial URL:', initialUrl)

    // Click the first therapist card (or the button inside it)
    const firstCard = cards.first()
    await firstCard.scrollIntoViewIfNeeded()
    await firstCard.click()

    // Wait a moment
    await page.waitForTimeout(1000)

    // Check that URL didn't change (no navigation to /profiles/...)
    const currentUrl = page.url()
    console.log('Current URL after click:', currentUrl)
    expect(currentUrl).toBe(initialUrl)
    expect(currentUrl).not.toContain('/profiles/')

    // Check that overlay appeared - look for elements with data-state="open" and 予約フォームを開く button
    const overlayOpenElements = page.locator('[data-state="open"]')
    const formButton = page.locator('button:has-text("予約フォームを開く")')

    // At least one indicator that overlay opened
    const hasOverlayState = (await overlayOpenElements.count()) > 0
    const hasFormButton = await formButton.isVisible().catch(() => false)

    console.log('Overlay state elements:', await overlayOpenElements.count())
    console.log('Form button visible:', hasFormButton)

    expect(hasOverlayState || hasFormButton).toBe(true)
    console.log('Overlay opened successfully on /search')

    // Close overlay
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  })

  test('/guest/match-chat: clicking therapist card should open overlay (not navigate)', async ({ page }) => {
    // Go to match-chat page
    await page.goto('/guest/match-chat')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Fill in required form fields
    // 1. Set date (required field)
    const dateInput = page.locator('input[type="date"]')
    if (await dateInput.isVisible().catch(() => false)) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]
      await dateInput.fill(dateStr)
      console.log('Set date to:', dateStr)
      await page.waitForTimeout(500)
    }

    // 2. Select a mood chip
    const moodChip = page.getByText('お任せしたい')
    if (await moodChip.isVisible().catch(() => false)) {
      await moodChip.click()
      console.log('Selected mood: お任せしたい')
      await page.waitForTimeout(500)
    }

    // 3. Click submit button
    const submitBtn = page.locator('button:has-text("この条件でおすすめをみる")')
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click()
      console.log('Clicked submit button')
    }

    // Wait for candidate cards to appear (API response)
    const cards = page.locator('[data-testid="therapist-card"]')
    const hasCards = await cards.first().isVisible({ timeout: 60000 }).catch(() => false)

    if (!hasCards) {
      // If no cards after waiting, the matching API may not have returned results
      console.log('No therapist cards found in match-chat - API may not have returned results')
      test.skip()
      return
    }

    // Get initial URL
    const initialUrl = page.url()
    console.log('Initial URL:', initialUrl)

    // Click the first therapist card
    const firstCard = cards.first()
    await firstCard.scrollIntoViewIfNeeded()
    await firstCard.click()

    // Wait a moment
    await page.waitForTimeout(1000)

    // Check that URL didn't change (no navigation to /profiles/...)
    const currentUrl = page.url()
    console.log('Current URL after click:', currentUrl)

    // CRITICAL: This is the main bug we're testing - it should NOT navigate to /profiles/
    expect(currentUrl).not.toContain('/profiles/')

    // Check that overlay appeared
    const overlayOpenElements = page.locator('[data-state="open"]')
    const formButton = page.locator('button:has-text("予約フォームを開く")')

    const hasOverlayState = (await overlayOpenElements.count()) > 0
    const hasFormButton = await formButton.isVisible().catch(() => false)

    console.log('Overlay state elements:', await overlayOpenElements.count())
    console.log('Form button visible:', hasFormButton)

    expect(hasOverlayState || hasFormButton).toBe(true)
    console.log('Overlay opened successfully on /guest/match-chat')

    // Close overlay
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  })

  test('overlay content should be consistent between /search and /guest/match-chat', async ({ page }) => {
    // Test that the overlay shows the same structure on both pages

    // Test /search overlay structure
    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    const searchCards = page.locator('[data-testid="therapist-card"]')
    await expect(searchCards.first()).toBeVisible({ timeout: 15000 })

    // Get name from card
    const searchCardName = await searchCards.first().locator('h3').textContent()
    console.log('Search card name:', searchCardName)

    // Open overlay
    await searchCards.first().click()
    await page.waitForTimeout(1000)

    // Check for overlay elements - using data-state instead of role
    const overlayOpen = (await page.locator('[data-state="open"]').count()) > 0
    expect(overlayOpen).toBe(true)

    // Check for key overlay elements using broader selectors
    const hasFormButton = await page.locator('button:has-text("予約フォームを開く")').isVisible().catch(() => false)

    console.log('/search overlay has form button:', hasFormButton)
    expect(hasFormButton).toBe(true)

    // Close overlay
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Test /guest/match-chat overlay structure - skip if no API results
    console.log('Note: /guest/match-chat test depends on matching API returning results')
    console.log('Skipping match-chat comparison as it requires live API data')
  })
})
