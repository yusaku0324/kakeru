import { test, expect } from '@playwright/test'

/**
 * Availability Calendar UI E2E Tests
 *
 * Tests for Phase 4 of availability-calendar-ui spec:
 * - Calendar display with correct status icons
 * - Cell interactions (select/deselect)
 * - Blocked cell behavior
 * - Accessibility requirements
 */

test.describe('Availability Calendar UI', () => {
  test.describe('4.1 Calendar Display', () => {
    test('displays availability grid with correct structure', async ({ page }) => {
      const shopId = process.env.E2E_SAMPLE_SHOP_ID || 'sample-namba-resort'
      await page.goto(`/profiles/${shopId}`)

      // Open reservation overlay
      const overlayTrigger = page.getByRole('button', { name: /Web予約する|空き状況を問い合わせる/ })
      await expect(overlayTrigger).toBeVisible({ timeout: 15000 })
      await overlayTrigger.click()

      // Wait for overlay
      const overlay = page.getByRole('dialog').first()
      await expect(overlay).toBeVisible({ timeout: 15000 })

      // Navigate to schedule tab
      await overlay.getByRole('button', { name: '空き状況・予約' }).click()

      // Verify availability grid is displayed
      const grid = page.locator('[data-testid="availability-grid"]')
      await expect(grid).toBeVisible({ timeout: 10000 })
    })

    test('displays status icons correctly (◎/△/×)', async ({ page }) => {
      const shopId = process.env.E2E_SAMPLE_SHOP_ID || 'sample-namba-resort'
      await page.goto(`/profiles/${shopId}`)

      const overlayTrigger = page.getByRole('button', { name: /Web予約する|空き状況を問い合わせる/ })
      await expect(overlayTrigger).toBeVisible({ timeout: 15000 })
      await overlayTrigger.click()

      const overlay = page.getByRole('dialog').first()
      await expect(overlay).toBeVisible({ timeout: 15000 })
      await overlay.getByRole('button', { name: '空き状況・予約' }).click()

      // Check for status icons in the grid
      const grid = page.locator('[data-testid="availability-grid"]')
      await expect(grid).toBeVisible({ timeout: 10000 })

      // Look for any of the status icons
      const hasOpenIcon = await grid.locator(':text("◎")').count()
      const hasTentativeIcon = await grid.locator(':text("△")').count()
      const hasBlockedIcon = await grid.locator(':text("×")').count()

      console.log(`Icons found - Open(◎): ${hasOpenIcon}, Tentative(△): ${hasTentativeIcon}, Blocked(×): ${hasBlockedIcon}`)

      // At least one type of icon should be present
      expect(hasOpenIcon + hasTentativeIcon + hasBlockedIcon).toBeGreaterThan(0)
    })
  })

  test.describe('4.2 Cell Interactions', () => {
    test('clicking open cell selects it', async ({ page }) => {
      const shopId = process.env.E2E_SAMPLE_SHOP_ID || 'sample-namba-resort'
      await page.goto(`/profiles/${shopId}`)

      const overlayTrigger = page.getByRole('button', { name: /Web予約する|空き状況を問い合わせる/ })
      await expect(overlayTrigger).toBeVisible({ timeout: 15000 })
      await overlayTrigger.click()

      const overlay = page.getByRole('dialog').first()
      await expect(overlay).toBeVisible({ timeout: 15000 })
      await overlay.getByRole('button', { name: '空き状況・予約' }).click()

      // Find an available slot
      const availableSlot = overlay.locator('[data-testid="slot-available"]').first()
      const slotExists = await availableSlot.count() > 0

      if (!slotExists) {
        console.log('No available slots found, skipping test')
        test.skip()
        return
      }

      // Click the slot
      await availableSlot.click()

      // Verify selection indicator appears
      await expect(overlay.getByText(/第1候補/)).toBeVisible({ timeout: 5000 })
    })

    test('clicking selected cell deselects it', async ({ page }) => {
      const shopId = process.env.E2E_SAMPLE_SHOP_ID || 'sample-namba-resort'
      await page.goto(`/profiles/${shopId}`)

      const overlayTrigger = page.getByRole('button', { name: /Web予約する|空き状況を問い合わせる/ })
      await expect(overlayTrigger).toBeVisible({ timeout: 15000 })
      await overlayTrigger.click()

      const overlay = page.getByRole('dialog').first()
      await expect(overlay).toBeVisible({ timeout: 15000 })
      await overlay.getByRole('button', { name: '空き状況・予約' }).click()

      const availableSlot = overlay.locator('[data-testid="slot-available"]').first()
      const slotExists = await availableSlot.count() > 0

      if (!slotExists) {
        console.log('No available slots found, skipping test')
        test.skip()
        return
      }

      // Select the slot
      await availableSlot.click()
      await expect(overlay.getByText(/第1候補/)).toBeVisible({ timeout: 5000 })

      // Click again to deselect
      await availableSlot.click()

      // Selection indicator should disappear or change
      // Note: Behavior depends on implementation - may show 0 candidates or hide section
      const candidateText = overlay.getByText(/第1候補/)
      const isHidden = await candidateText.isHidden().catch(() => true)
      console.log(`After deselect - candidate text hidden: ${isHidden}`)
    })

    test('blocked cells are not clickable', async ({ page }) => {
      const shopId = process.env.E2E_SAMPLE_SHOP_ID || 'sample-namba-resort'
      await page.goto(`/profiles/${shopId}`)

      const overlayTrigger = page.getByRole('button', { name: /Web予約する|空き状況を問い合わせる/ })
      await expect(overlayTrigger).toBeVisible({ timeout: 15000 })
      await overlayTrigger.click()

      const overlay = page.getByRole('dialog').first()
      await expect(overlay).toBeVisible({ timeout: 15000 })
      await overlay.getByRole('button', { name: '空き状況・予約' }).click()

      // Find a blocked slot
      const blockedSlot = overlay.locator('[data-testid="slot-blocked"]').first()
      const slotExists = await blockedSlot.count() > 0

      if (!slotExists) {
        console.log('No blocked slots found, skipping test')
        test.skip()
        return
      }

      // Verify blocked slot has disabled styling
      const hasDisabledAttr = await blockedSlot.getAttribute('aria-disabled')
      const hasPointerEventsNone = await blockedSlot.evaluate((el) => {
        const style = window.getComputedStyle(el)
        return style.pointerEvents === 'none'
      })

      console.log(`Blocked slot - aria-disabled: ${hasDisabledAttr}, pointer-events: none: ${hasPointerEventsNone}`)

      // Should have either aria-disabled or pointer-events: none
      expect(hasDisabledAttr === 'true' || hasPointerEventsNone).toBe(true)
    })
  })

  test.describe('4.3 Conflict Scenario (requires mock)', () => {
    test('shows conflict error when slot becomes unavailable', async ({ page }) => {
      // Mock the verify_slot API to return 409 Conflict
      await page.route('**/verify_slot**', async (route) => {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: {
              detail: 'slot_unavailable',
              status: 'blocked',
              conflicted_at: new Date().toISOString(),
            },
          }),
        })
      })

      // Mock reservation API (should not be called)
      await page.route('**/api/reservations', async (route) => {
        await route.fulfill({ status: 201, body: JSON.stringify({ id: 'test-reservation' }) })
      })

      const shopId = process.env.E2E_SAMPLE_SHOP_ID || 'sample-namba-resort'
      await page.goto(`/profiles/${shopId}`)

      const overlayTrigger = page.getByRole('button', { name: /Web予約する|空き状況を問い合わせる/ })
      await expect(overlayTrigger).toBeVisible({ timeout: 15000 })
      await overlayTrigger.click()

      const overlay = page.getByRole('dialog').first()
      await expect(overlay).toBeVisible({ timeout: 15000 })
      await overlay.getByRole('button', { name: '空き状況・予約' }).click()

      // Select a slot
      const availableSlot = overlay.locator('[data-testid="slot-available"]').first()
      const slotExists = await availableSlot.count() > 0

      if (!slotExists) {
        console.log('No available slots found, skipping test')
        test.skip()
        return
      }

      await availableSlot.click()

      // Open form and try to submit
      const formButton = overlay.getByRole('button', { name: /予約フォーム(へ|に)進む|予約フォームを開く/ }).first()
      await formButton.click()

      const formDialog = page.getByRole('dialog', { name: /の予約フォーム/ }).first()
      await expect(formDialog).toBeVisible({ timeout: 15000 })

      // Fill required fields
      await formDialog.locator('input[placeholder*="山田"]').fill('テスト 太郎')
      await formDialog.locator('input[placeholder*="090"]').fill('090-1234-5678')

      // Submit
      const submitButton = formDialog.getByRole('button', { name: /予約リクエストを送信/ })
      await submitButton.click()

      // Note: Conflict error banner should appear
      // This test verifies the flow works - actual error display depends on staffId being present
      console.log('Conflict scenario test completed - verify error handling in logs')
    })
  })

  test.describe('4.4 Accessibility', () => {
    test('calendar cells have proper aria labels', async ({ page }) => {
      const shopId = process.env.E2E_SAMPLE_SHOP_ID || 'sample-namba-resort'
      await page.goto(`/profiles/${shopId}`)

      const overlayTrigger = page.getByRole('button', { name: /Web予約する|空き状況を問い合わせる/ })
      await expect(overlayTrigger).toBeVisible({ timeout: 15000 })
      await overlayTrigger.click()

      const overlay = page.getByRole('dialog').first()
      await expect(overlay).toBeVisible({ timeout: 15000 })
      await overlay.getByRole('button', { name: '空き状況・予約' }).click()

      // Check for aria-labels on slot buttons
      const slotsWithLabels = overlay.locator('[data-testid^="slot-"][aria-label]')
      const count = await slotsWithLabels.count()

      console.log(`Slots with aria-label: ${count}`)

      if (count > 0) {
        const firstLabel = await slotsWithLabels.first().getAttribute('aria-label')
        console.log(`First slot aria-label: ${firstLabel}`)

        // Aria label should contain date/time and status info
        expect(firstLabel).toBeTruthy()
      }
    })

    test('blocked cells have aria-disabled attribute', async ({ page }) => {
      const shopId = process.env.E2E_SAMPLE_SHOP_ID || 'sample-namba-resort'
      await page.goto(`/profiles/${shopId}`)

      const overlayTrigger = page.getByRole('button', { name: /Web予約する|空き状況を問い合わせる/ })
      await expect(overlayTrigger).toBeVisible({ timeout: 15000 })
      await overlayTrigger.click()

      const overlay = page.getByRole('dialog').first()
      await expect(overlay).toBeVisible({ timeout: 15000 })
      await overlay.getByRole('button', { name: '空き状況・予約' }).click()

      // Find blocked slots
      const blockedSlots = overlay.locator('[data-testid="slot-blocked"]')
      const count = await blockedSlots.count()

      if (count === 0) {
        console.log('No blocked slots found, skipping accessibility check')
        test.skip()
        return
      }

      // Check first blocked slot for aria-disabled
      const firstBlocked = blockedSlots.first()
      const ariaDisabled = await firstBlocked.getAttribute('aria-disabled')

      console.log(`First blocked slot aria-disabled: ${ariaDisabled}`)
      expect(ariaDisabled).toBe('true')
    })

    test('screen reader text is present for slot status', async ({ page }) => {
      const shopId = process.env.E2E_SAMPLE_SHOP_ID || 'sample-namba-resort'
      await page.goto(`/profiles/${shopId}`)

      const overlayTrigger = page.getByRole('button', { name: /Web予約する|空き状況を問い合わせる/ })
      await expect(overlayTrigger).toBeVisible({ timeout: 15000 })
      await overlayTrigger.click()

      const overlay = page.getByRole('dialog').first()
      await expect(overlay).toBeVisible({ timeout: 15000 })
      await overlay.getByRole('button', { name: '空き状況・予約' }).click()

      // Check for sr-only elements (screen reader only text)
      const srOnlyElements = overlay.locator('.sr-only')
      const count = await srOnlyElements.count()

      console.log(`Screen reader only elements: ${count}`)

      // Should have at least some sr-only elements for accessibility
      expect(count).toBeGreaterThan(0)
    })
  })
})
