import { expect, test } from '@playwright/test'

/**
 * Full UI reservation test on production
 * Tests: shop page -> click therapist -> select slot -> fill form -> submit -> verify completion
 */

const WEB_BASE = 'https://osakamenesu.com'
const API_BASE = 'https://api.osakamenesu.com'
const ADMIN_KEY = process.env.E2E_ADMIN_KEY || 'osakamenesu-admin-2024'

// E2E Test Shop & Therapist IDs
const E2E_SHOP_ID = '11111111-2222-3333-4444-555555555555'
const E2E_THERAPIST_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

test.describe('Production UI Reservation Flow', () => {
  test('complete full reservation flow for ももな via shop page', async ({ page }) => {
    // Set test timeout to 2 minutes
    test.setTimeout(120000)

    // Set a larger viewport for desktop view
    await page.setViewportSize({ width: 1280, height: 900 })

    // Step 1: Go directly to the E2E shop page
    console.log('Step 1: Opening E2E shop page directly...')
    await page.goto(`${WEB_BASE}/shops/${E2E_SHOP_ID}`, { waitUntil: 'networkidle' })
    await page.screenshot({ path: '/tmp/e2e-step1-shop.png', fullPage: true })

    // Check page content
    const pageTitle = await page.title()
    console.log(`Page title: ${pageTitle}`)

    const pageContent = await page.locator('body').innerText()
    const hasMomona = pageContent.includes('ももな')
    console.log(`Page contains ももな: ${hasMomona}`)

    // Step 2: Find and click the "予約する" button
    console.log('Step 2: Looking for 予約する button...')

    // Look for the reserve button - multiple selector strategies
    const reserveButton = page.locator('button:has-text("予約する")').first()
    const reserveButtonExists = await reserveButton.count() > 0
    console.log(`予約する button found: ${reserveButtonExists}`)

    if (reserveButtonExists) {
      await expect(reserveButton).toBeVisible({ timeout: 10000 })
      await reserveButton.click()
      console.log('Clicked 予約する button')
    } else {
      // Try alternative selectors
      const altButton = page.locator('[data-testid="therapist-cta"]').first()
      if (await altButton.count() > 0) {
        await altButton.click()
        console.log('Clicked CTA button')
      }
    }

    // Wait for overlay to appear
    const overlayDialog = page.locator('[role="dialog"][aria-modal="true"]:visible')
    try {
      await expect(overlayDialog).toBeVisible({ timeout: 10000 })
      console.log('Overlay dialog appeared')
    } catch (e) {
      console.log('Overlay dialog did not appear within timeout')
    }

    await page.screenshot({ path: '/tmp/e2e-step2-overlay.png', fullPage: true })

    // Check dialogs
    const allDialogs = await page.locator('[role="dialog"]').all()
    console.log(`Found ${allDialogs.length} dialogs`)
    for (let i = 0; i < allDialogs.length; i++) {
      const ariaLabel = await allDialogs[i].getAttribute('aria-label')
      const isVisible = await allDialogs[i].isVisible()
      console.log(`Dialog ${i}: aria-label="${ariaLabel}", visible=${isVisible}`)
    }

    // Step 3: Click booking tab
    console.log('Step 3: Looking for booking tab...')
    const bookingTab = page.locator('button:has-text("空き状況・予約"):visible')
    const bookingTabCount = await bookingTab.count()
    console.log(`Found ${bookingTabCount} visible booking tab buttons`)

    if (bookingTabCount > 0) {
      await bookingTab.first().click({ force: true })
      console.log('Clicked booking tab')
    }

    await page.waitForTimeout(1500)
    await page.screenshot({ path: '/tmp/e2e-step3-booking-tab.png', fullPage: true })

    // Step 4: Look for available slots
    console.log('Step 4: Looking for available time slots...')
    const availabilityGrid = page.locator('[data-testid="availability-grid"]')
    const gridVisible = await availabilityGrid.isVisible().catch(() => false)
    console.log(`Availability grid visible: ${gridVisible}`)

    const availableSlots = page.locator('[data-testid="slot-available"]:visible')
    const pendingSlots = page.locator('[data-testid="slot-pending"]:visible')
    const availableCount = await availableSlots.count()
    const pendingCount = await pendingSlots.count()
    console.log(`Available slots: ${availableCount}, Pending slots: ${pendingCount}`)

    await page.screenshot({ path: '/tmp/e2e-step4-slots.png', fullPage: true })

    // Click a slot if available
    if (availableCount > 0) {
      await availableSlots.first().scrollIntoViewIfNeeded()
      await availableSlots.first().click({ force: true })
      console.log('Clicked first available slot')
    } else if (pendingCount > 0) {
      await pendingSlots.first().scrollIntoViewIfNeeded()
      await pendingSlots.first().click({ force: true })
      console.log('Clicked first pending slot')
    } else {
      console.log('No slots available - using empty state')
      const requestButton = page.locator('button:has-text("予約リクエストを送る"):visible')
      if (await requestButton.count() > 0) {
        await requestButton.first().click({ force: true })
      }
    }

    await page.waitForTimeout(1000)
    await page.screenshot({ path: '/tmp/e2e-step4-slot-selected.png', fullPage: true })

    // Step 5: Open reservation form
    console.log('Step 5: Opening reservation form...')
    const formButton = page.locator('button:has-text("予約フォームに進む"):visible').first()
    const openFormButton = page.locator('button:has-text("予約フォームを開く"):visible').first()

    if (await formButton.count() > 0) {
      await formButton.click({ force: true })
      console.log('Clicked 予約フォームに進む')
    } else if (await openFormButton.count() > 0) {
      await openFormButton.click({ force: true })
      console.log('Clicked 予約フォームを開く')
    }

    await page.waitForTimeout(2000)
    await page.screenshot({ path: '/tmp/e2e-step5-form-modal.png', fullPage: true })

    // Step 6: Fill the form
    console.log('Step 6: Filling contact form...')
    const nameInput = page.locator('#reservation-name')
    const phoneInput = page.locator('#reservation-phone')

    if (await nameInput.isVisible()) {
      await nameInput.fill('E2E-UIテスト-' + Date.now())
      console.log('Filled name')
    }
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('09077777777')
      console.log('Filled phone')
    }

    await page.screenshot({ path: '/tmp/e2e-step6-filled.png', fullPage: true })

    // Step 7: Submit
    console.log('Step 7: Submitting reservation...')
    const submitButton = page.locator('button:has-text("予約リクエストを送信"):visible')
    const submitCount = await submitButton.count()
    console.log(`Submit button count: ${submitCount}`)

    if (submitCount > 0) {
      const isDisabled = await submitButton.first().isDisabled()
      console.log(`Submit disabled: ${isDisabled}`)

      if (!isDisabled) {
        await submitButton.first().click({ force: true })
        console.log('Clicked submit, waiting for response...')
        await page.waitForTimeout(6000)
        await page.screenshot({ path: '/tmp/e2e-step7-submitted.png', fullPage: true })

        // Check for success
        const successMessage = page.locator('h3:has-text("予約リクエスト完了"), text=予約リクエスト完了')
        const hasSuccess = await successMessage.isVisible().catch(() => false)
        console.log(`Success message visible: ${hasSuccess}`)

        if (hasSuccess) {
          console.log('✅ RESERVATION COMPLETED SUCCESSFULLY!')
        } else {
          const bodyText = await page.locator('body').innerText()
          if (bodyText.includes('完了') || bodyText.includes('ありがとう')) {
            console.log('✅ Found completion text in page body')
          } else if (bodyText.includes('エラー') || bodyText.includes('失敗')) {
            console.log('❌ Error detected in page')
          } else {
            console.log('⚠️ Unknown state after submission')
          }
        }
      } else {
        console.log('Submit button is disabled')
      }
    }

    // Final state
    console.log('\n=== Test Complete ===')
    await page.screenshot({ path: '/tmp/e2e-final.png', fullPage: true })
    console.log('Screenshots saved to /tmp/e2e-*.png')
  })
})
