import { test, expect } from '@playwright/test'

/**
 * Test: Verify that the availability label on the therapist card matches
 * the auto-selected slot in the reservation calendar overlay.
 *
 * Flow:
 * 1. Visit /search page
 * 2. Find a therapist card with availability label (e.g., "明日 10:00〜")
 * 3. Click the card to open reservation overlay
 * 4. Go to booking tab
 * 5. Find the first selected (open) slot in the calendar
 * 6. Verify the date/time matches the card's label
 */
test.describe('Availability label consistency', () => {
  test('therapist card availability label matches auto-selected slot in calendar', async ({ page }) => {
    // Go to search page
    await page.goto('/search')

    // Wait for therapist cards to load
    const therapistCards = page.locator('[data-testid="therapist-card"]')
    await expect(therapistCards.first()).toBeVisible({ timeout: 15000 })

    // Find a therapist card that has an availability badge (green or amber badge with time)
    // The availability badge appears at the bottom-left of the card image
    const cardWithAvailability = therapistCards.filter({
      has: page.locator('.bg-emerald-500\\/90, .bg-amber-500\\/90'),
    }).first()

    // Check if we have a card with availability
    const cardCount = await cardWithAvailability.count()
    if (cardCount === 0) {
      // No cards with availability labels - skip this test
      test.skip()
      return
    }

    // Get the availability label text from the card
    const availabilityBadge = cardWithAvailability.locator('.bg-emerald-500\\/90, .bg-amber-500\\/90')
    const cardAvailabilityText = await availabilityBadge.textContent()
    console.log('Card availability label:', cardAvailabilityText)

    // Click the card to open the reservation overlay
    await cardWithAvailability.click()

    // Wait for the overlay dialog to appear
    const overlay = page.getByRole('dialog', { name: /の予約詳細/ }).first()
    await expect(overlay).toBeVisible({ timeout: 15000 })

    // Click the "空き状況・予約" tab
    await overlay.getByRole('button', { name: '空き状況・予約' }).click()

    // Wait for calendar to load - look for slot buttons or timeline
    await page.waitForTimeout(1000) // Allow time for availability data to load

    // Check if we have a selected slot displayed in the "選択中の候補" section
    const selectedSlotSection = overlay.locator('text=選択中の候補').locator('..')
    await expect(selectedSlotSection).toBeVisible({ timeout: 10000 })

    // Look for the first selected slot indicator (第1候補)
    // The selected slot list shows slots in format like "12/9(火) 13:00〜14:30"
    const selectedSlotText = selectedSlotSection.locator('[class*="bg-brand-primary"]').first()
    const slotExists = await selectedSlotText.count()

    if (slotExists === 0) {
      // If no slot is selected, there might be a message
      const emptyMessage = await selectedSlotSection.locator('text=候補枠が選択されていません').count()
      if (emptyMessage > 0) {
        console.log('No slots are auto-selected')
        // This is acceptable if the card showed "本日空きあり" without specific time
        if (cardAvailabilityText === '本日空きあり') {
          // This is fine - the label is generic and no specific slot is selected
          return
        }
      }
    }

    // Look for the slot entry with the selected time
    // Find time display within the slot list (pattern: HH:MM〜HH:MM)
    const slotEntries = selectedSlotSection.locator('[class*="rounded"]').filter({
      has: page.locator('text=/\\d{1,2}:\\d{2}〜/')
    })

    const entryCount = await slotEntries.count()
    console.log('Number of selected slot entries:', entryCount)

    if (entryCount > 0) {
      // Get the first selected slot's text
      const firstSlotText = await slotEntries.first().textContent()
      console.log('First selected slot text:', firstSlotText)

      // Now verify this matches the card's label
      // Card shows: "本日 18:00〜" or "明日 10:00〜" or "12月9日 10:00〜"
      // Selected slot shows: "12/9(火) 10:00〜10:30"

      if (cardAvailabilityText && firstSlotText) {
        // Extract the time from card label (e.g., "10:00" from "明日 10:00〜")
        const cardTimeMatch = cardAvailabilityText.match(/(\d{1,2}:\d{2})/)
        const slotTimeMatch = firstSlotText.match(/(\d{1,2}:\d{2})/)

        if (cardTimeMatch && slotTimeMatch) {
          const cardTime = cardTimeMatch[1]
          const slotTime = slotTimeMatch[1]
          console.log(`Card time: ${cardTime}, Slot time: ${slotTime}`)

          // The times should match (the start time)
          expect(cardTime).toBe(slotTime)
        }
      }
    }

    // Also verify the slot is visible in the calendar grid
    // Look for open (○) or tentative (△) slots
    const openSlots = overlay.locator('[aria-label*="予約可"], [aria-label*="要確認"]')
    const openSlotCount = await openSlots.count()
    console.log('Number of open slots visible in calendar:', openSlotCount)

    // At least one open slot should be visible if we have a selected slot
    if (entryCount > 0) {
      expect(openSlotCount).toBeGreaterThan(0)
    }

    // Close the overlay
    await overlay.getByRole('button', { name: '予約パネルを閉じる' }).click()
    await expect(overlay).not.toBeVisible()
  })

  test('auto-selected slot is visible in calendar when opening booking tab', async ({ page }) => {
    // Go to search page
    await page.goto('/search')

    // Wait for therapist cards to load
    const therapistCards = page.locator('[data-testid="therapist-card"]')
    await expect(therapistCards.first()).toBeVisible({ timeout: 15000 })

    // Find a card with specific time availability (not just "本日空きあり")
    const cardWithSpecificTime = therapistCards.filter({
      has: page.locator('text=/\\d{1,2}:\\d{2}〜/'),
    }).first()

    const cardCount = await cardWithSpecificTime.count()
    if (cardCount === 0) {
      test.skip()
      return
    }

    // Get the availability label
    const badge = cardWithSpecificTime.locator('.bg-emerald-500\\/90, .bg-amber-500\\/90')
    const labelText = await badge.textContent()
    console.log('Selected card availability:', labelText)

    // Click the card
    await cardWithSpecificTime.click()

    // Wait for overlay
    const overlay = page.getByRole('dialog', { name: /の予約詳細/ }).first()
    await expect(overlay).toBeVisible({ timeout: 15000 })

    // Click booking tab
    await overlay.getByRole('button', { name: '空き状況・予約' }).click()
    await page.waitForTimeout(1000)

    // The auto-selected slot should be visible in the calendar
    // Look for highlighted/selected cell in the calendar grid
    // Selected slots typically have a special styling (e.g., ring, border)

    // Check that "選択中の候補" has an entry
    const selectedSection = overlay.locator('text=選択中の候補').locator('..')
    const hasSelectedSlot = await selectedSection.locator('text=/第\\d候補/').count()

    // If the card had a specific time, we should have at least one selected slot
    if (labelText && /\d{1,2}:\d{2}/.test(labelText)) {
      expect(hasSelectedSlot).toBeGreaterThanOrEqual(1)
      console.log('Auto-selected slot is present in the list')
    }

    // Verify an open slot marker (○ or △) exists in the visible calendar area
    const visibleOpenSlots = overlay.locator('[aria-label*="予約可"], [aria-label*="要確認"]')
    const visibleCount = await visibleOpenSlots.count()
    console.log('Visible open slots in calendar:', visibleCount)

    // There should be at least one visible open slot if we auto-selected something
    if (hasSelectedSlot > 0) {
      expect(visibleCount).toBeGreaterThan(0)
    }

    // Close overlay
    await overlay.getByRole('button', { name: '予約パネルを閉じる' }).click()
  })
})
