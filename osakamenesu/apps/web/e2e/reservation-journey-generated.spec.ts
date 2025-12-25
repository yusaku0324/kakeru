import { test, expect } from '@playwright/test'

/**
 * Reservation Journey E2E Tests
 * Generated from specs/reservation-journey.md
 */

test.describe('Reservation Journey', () => {
  // Helper function to login
  async function login(page, email = 'test@example.com', password = 'testpass123') {
    await page.goto('/login')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/dashboard|home/, { timeout: 10000 })
  }

  // Scenario 1: Complete Reservation Flow from Shop
  test('Complete Reservation Flow from Shop', async ({ page }) => {
    // Navigate to shop details
    await page.goto('/shops/sample-shop')

    // Click reserve button
    const reserveButton = page.locator('button:has-text("予約する"), a:has-text("予約する")')
    await reserveButton.click()

    // Check if login is required
    if (page.url().includes('login')) {
      // Login with test credentials
      await login(page)

      // Return to shop and click reserve again
      await page.goto('/shops/sample-shop')
      await reserveButton.click()
    }

    // Select service
    const serviceMenu = page.locator('[data-testid="service-menu"], .service-menu')
    await expect(serviceMenu).toBeVisible()

    // Choose 90-minute course
    const service90Min = serviceMenu.locator('label:has-text("90分コース"), input[value="90min"]').first()
    await service90Min.click()

    // Verify price is shown
    await expect(page.locator('text=/¥15,000|15,000円/')).toBeVisible()

    // Choose therapist or no preference
    const therapistSection = page.locator('[data-testid="therapist-selection"]')
    const noPreferenceOption = therapistSection.locator('input[value="no-preference"], label:has-text("指名なし")')
    if (await noPreferenceOption.count() > 0) {
      await noPreferenceOption.click()
    }

    // Select date from calendar
    const calendar = page.locator('[data-testid="booking-calendar"], .calendar')
    await expect(calendar).toBeVisible()

    // Click on available date (tomorrow)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateButton = calendar.locator(`button[data-date="${tomorrow.toISOString().split('T')[0]}"]`).first()

    if (await dateButton.count() === 0) {
      // Fallback: click any available date
      const availableDate = calendar.locator('button[data-available="true"]').first()
      await availableDate.click()
    } else {
      await dateButton.click()
    }

    // Choose time slot
    const timeSlots = page.locator('[data-testid="time-slots"], .time-slots')
    await expect(timeSlots).toBeVisible()

    const slot14 = timeSlots.locator('button:has-text("14:00")').first()
    await slot14.click()

    // Add optional requests
    const commentsField = page.locator('textarea[name="comments"], [data-testid="special-requests"]')
    if (await commentsField.count() > 0) {
      await commentsField.fill('強めの圧でお願いします')
    }

    // Proceed to confirmation
    const confirmButton = page.locator('button:has-text("確認"), button:has-text("次へ")')
    await confirmButton.click()

    // Review booking details
    const confirmationPage = page.locator('[data-testid="booking-confirmation"], .confirmation')
    await expect(confirmationPage).toBeVisible()

    // Verify all details are shown
    await expect(confirmationPage).toContainText('90分コース')
    await expect(confirmationPage).toContainText('¥15,000')
    await expect(confirmationPage).toContainText('14:00')

    // Select payment method
    const paymentSection = page.locator('[data-testid="payment-method"]')
    const creditCardOption = paymentSection.locator('input[value="credit"], label:has-text("クレジットカード")')
    await creditCardOption.click()

    // Complete booking
    const completeButton = page.locator('button:has-text("予約を確定"), button:has-text("予約する")')
    await completeButton.click()

    // Wait for success page
    await page.waitForURL(/complete|success|confirmation/)
    await expect(page.locator('text=/予約が完了|ご予約ありがとう/')).toBeVisible()
  })

  // Scenario 2: Quick Booking from Therapist Profile
  test('Quick Booking from Therapist Profile', async ({ page }) => {
    // Assume user is already logged in
    await page.goto('/therapists/sample-therapist')

    // Click book this therapist button
    const bookButton = page.locator('button:has-text("この therapist を予約"), button:has-text("予約する")')
    await bookButton.click()

    // Verify therapist is pre-selected
    const selectedTherapist = page.locator('[data-testid="selected-therapist"]')
    await expect(selectedTherapist).toBeVisible()
    await expect(selectedTherapist).toContainText('sample')

    // Calendar should show only this therapist's availability
    const calendar = page.locator('[data-testid="booking-calendar"]')
    await expect(calendar).toBeVisible()

    // Select available date and time
    const availableSlot = calendar.locator('button[data-available="true"]').first()
    await availableSlot.click()

    const timeSlot = page.locator('button:has-text("15:00")').first()
    await timeSlot.click()

    // Choose service duration
    const serviceDuration = page.locator('select[name="duration"], [data-testid="service-duration"]')
    await serviceDuration.selectOption('60')

    // Confirm details
    const confirmButton = page.locator('button:has-text("確認")')
    await confirmButton.click()

    // Complete payment
    const payButton = page.locator('button:has-text("支払う"), button:has-text("予約を確定")')
    await payButton.click()

    // Verify completion
    await expect(page.locator('[data-testid="booking-success"]')).toBeVisible()
  })

  // Scenario 3: Group/Multiple Reservation
  test('Group Reservation for Multiple People', async ({ page }) => {
    await page.goto('/shops/sample-shop')

    const reserveButton = page.locator('button:has-text("予約")')
    await reserveButton.click()

    // Look for number of people option
    const peopleSelector = page.locator('[data-testid="number-of-people"], select[name="people"]')
    if (await peopleSelector.count() > 0) {
      await peopleSelector.selectOption('2')

      // Check if different services option appears
      const differentServicesOption = page.locator('input[name="different-services"]')
      if (await differentServicesOption.count() > 0) {
        // Select same service for both
        await page.locator('input[value="same-service"]').check()
      }

      // Select service for both
      const service60Min = page.locator('label:has-text("60分コース")')
      await service60Min.click()

      // Verify price is doubled
      await expect(page.locator('[data-testid="total-price"]')).toContainText(/20,000|40,000/)

      // Continue with date selection
      const availableDate = page.locator('button[data-available="true"]').first()
      await availableDate.click()

      // Select time slot that can accommodate both
      const timeSlot = page.locator('button[data-capacity="2"]').first()
      if (await timeSlot.count() > 0) {
        await timeSlot.click()
      } else {
        // Fallback to any available slot
        await page.locator('.time-slot.available').first().click()
      }

      // Complete booking
      const confirmButton = page.locator('button:has-text("確認")')
      await confirmButton.click()
    }
  })

  // Scenario 4: Reservation with Special Requests
  test('Reservation with Special Requests', async ({ page }) => {
    await page.goto('/shops/sample-shop/book')

    // Select basic service
    await page.locator('input[value="60min"]').click()

    // Select date and time
    await page.locator('button[data-available="true"]').first().click()
    await page.locator('button:has-text("16:00")').click()

    // Enter special requests
    const requestsField = page.locator('textarea[name="special-requests"], #special-requests')
    await requestsField.fill('強めの圧でお願いします。香りの少ないオイル希望です。')

    // Check character count if displayed
    const charCount = page.locator('[data-testid="character-count"]')
    if (await charCount.count() > 0) {
      const countText = await charCount.textContent()
      expect(countText).toMatch(/\d+/)
    }

    // Continue to confirmation
    await page.locator('button:has-text("確認")').click()

    // Verify requests appear in summary
    const summary = page.locator('[data-testid="booking-summary"]')
    await expect(summary).toContainText('強めの圧')
    await expect(summary).toContainText('香りの少ないオイル')

    // Complete booking
    await page.locator('button:has-text("予約を確定")').click()
  })

  // Scenario 5: Modification of Existing Reservation
  test('Modify Existing Reservation', async ({ page }) => {
    // Navigate to booking history
    await page.goto('/account/bookings')

    // Find future reservation
    const futureBookings = page.locator('[data-testid="future-bookings"]')
    const firstBooking = futureBookings.locator('.booking-card').first()

    // Click modify button
    const modifyButton = firstBooking.locator('button:has-text("変更")')
    await modifyButton.click()

    // Check modification deadline notice
    const deadline = page.locator('[data-testid="modification-deadline"]')
    if (await deadline.count() > 0) {
      await expect(deadline).toContainText(/24時間前|1日前/)
    }

    // Change time from 14:00 to 16:00
    const currentTime = page.locator('[data-testid="current-time"]')
    await expect(currentTime).toContainText('14:00')

    // Select new time
    await page.locator('button:has-text("16:00")').click()

    // Review changes
    const changesSummary = page.locator('[data-testid="changes-summary"]')
    await expect(changesSummary).toBeVisible()
    await expect(changesSummary).toContainText('14:00 → 16:00')

    // Confirm modification
    await page.locator('button:has-text("変更を確定")').click()

    // Verify success
    await expect(page.locator('[data-testid="modification-success"]')).toBeVisible()
  })

  // Scenario 6: Cancellation Flow
  test('Cancel Reservation', async ({ page }) => {
    await page.goto('/account/bookings')

    // Select future reservation
    const booking = page.locator('.booking-card').filter({ hasText: '予定' }).first()
    await booking.locator('button:has-text("キャンセル")').click()

    // Read cancellation policy
    const policyDialog = page.locator('[data-testid="cancellation-policy"], [role="dialog"]')
    await expect(policyDialog).toBeVisible()
    await expect(policyDialog).toContainText('キャンセルポリシー')

    // Check cancellation deadline
    await expect(policyDialog).toContainText(/24時間前|キャンセル料/)

    // Select cancellation reason
    const reasonSelect = page.locator('select[name="cancellation-reason"]')
    if (await reasonSelect.count() > 0) {
      await reasonSelect.selectOption('schedule-conflict')
    }

    // Confirm cancellation
    await page.locator('button:has-text("キャンセルを確定")').click()

    // Confirm in second dialog if appears
    const confirmDialog = page.locator('button:has-text("はい、キャンセルします")')
    if (await confirmDialog.count() > 0) {
      await confirmDialog.click()
    }

    // Verify cancellation success
    await expect(page.locator('[data-testid="cancellation-success"]')).toBeVisible()
  })

  // Scenario 7: Payment Method Selection
  test('Various Payment Methods', async ({ page }) => {
    await page.goto('/shops/sample-shop/book')

    // Complete service and time selection
    await page.locator('input[value="60min"]').click()
    await page.locator('button[data-available="true"]').first().click()
    await page.locator('.time-slot').first().click()
    await page.locator('button:has-text("確認")').click()

    // Review payment methods
    const paymentSection = page.locator('[data-testid="payment-methods"]')
    await expect(paymentSection).toBeVisible()

    // Check available methods
    const methods = ['credit', 'paypay', 'linepay', 'cash']

    for (const method of methods) {
      const option = paymentSection.locator(`input[value="${method}"]`)
      if (await option.count() > 0) {
        await expect(option).toBeVisible()
      }
    }

    // Select PayPay
    await paymentSection.locator('input[value="paypay"]').click()

    // Continue to payment
    await page.locator('button:has-text("支払いへ進む")').click()

    // For PayPay, might redirect to PayPay page
    // This is where real payment integration would happen
  })

  // Scenario 8: Waitlist Functionality
  test('Join Waitlist for Fully Booked Slot', async ({ page }) => {
    await page.goto('/therapists/popular-therapist')

    // Try to book a fully booked slot
    const fullyBookedSlot = page.locator('button[data-available="false"]:has-text("15:00")').first()
    await fullyBookedSlot.click()

    // Check waitlist option
    const waitlistButton = page.locator('button:has-text("キャンセル待ち")')
    await expect(waitlistButton).toBeVisible()
    await waitlistButton.click()

    // Confirm waitlist registration
    const waitlistDialog = page.locator('[data-testid="waitlist-dialog"]')
    await expect(waitlistDialog).toBeVisible()

    // Select notification preferences
    const emailNotify = page.locator('input[name="notify-email"]')
    const smsNotify = page.locator('input[name="notify-sms"]')

    if (await emailNotify.count() > 0) {
      await emailNotify.check()
    }
    if (await smsNotify.count() > 0) {
      await smsNotify.check()
    }

    // Submit waitlist request
    await page.locator('button:has-text("キャンセル待ちに登録")').click()

    // Verify confirmation
    await expect(page.locator('[data-testid="waitlist-success"]')).toBeVisible()

    // Check position in queue if shown
    const queuePosition = page.locator('[data-testid="queue-position"]')
    if (await queuePosition.count() > 0) {
      await expect(queuePosition).toContainText(/\d+番目/)
    }
  })

  // Scenario 9: Mobile Booking Experience
  test('Mobile Booking Flow', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })

    await page.goto('/shops/sample-shop')

    // Tap reserve button
    const reserveButton = page.locator('button:has-text("予約")')
    await reserveButton.tap()

    // Select service on mobile
    const serviceCard = page.locator('.service-card').first()
    await serviceCard.tap()

    // Mobile date picker
    const datePicker = page.locator('[data-testid="mobile-date-picker"]')
    await expect(datePicker).toBeVisible()

    // Swipe or tap to select date
    const availableDate = datePicker.locator('[data-available="true"]').first()
    await availableDate.tap()

    // Time slot selection on mobile
    const timeSlotSheet = page.locator('[data-testid="time-slot-sheet"]')
    await expect(timeSlotSheet).toBeVisible()

    await timeSlotSheet.locator('button:has-text("17:00")').tap()

    // Check touch-friendly buttons
    const confirmButton = page.locator('button:has-text("確認")')
    const buttonSize = await confirmButton.boundingBox()
    if (buttonSize) {
      expect(buttonSize.height).toBeGreaterThanOrEqual(44) // iOS touch target
    }

    await confirmButton.tap()

    // Complete mobile payment
    await page.locator('input[value="credit"]').tap()
    await page.locator('button:has-text("予約を確定")').tap()
  })

  // Scenario 10: Recurring Reservation Setup
  test('Setup Recurring Reservation', async ({ page }) => {
    // Complete a regular booking first
    await page.goto('/shops/sample-shop/book')
    await page.locator('input[value="60min"]').click()
    await page.locator('button[data-available="true"]').first().click()
    await page.locator('.time-slot').first().click()
    await page.locator('button:has-text("確認")').click()
    await page.locator('button:has-text("予約を確定")').click()

    // On confirmation page, look for recurring option
    const recurringOption = page.locator('button:has-text("定期予約にする")')
    if (await recurringOption.count() > 0) {
      await recurringOption.click()

      // Select frequency
      const frequencySelect = page.locator('select[name="frequency"]')
      await frequencySelect.selectOption('weekly')

      // Set end date or occurrences
      const occurrencesInput = page.locator('input[name="occurrences"]')
      await occurrencesInput.fill('4') // 4 weeks

      // Review all future dates
      const futureDates = page.locator('[data-testid="future-dates-list"]')
      await expect(futureDates).toBeVisible()

      const dateItems = futureDates.locator('li')
      await expect(dateItems).toHaveCount(4)

      // Confirm recurring booking
      await page.locator('button:has-text("定期予約を確定")').click()

      // Verify success
      await expect(page.locator('[data-testid="recurring-success"]')).toBeVisible()
    }
  })

  // Scenario 12: Guest Booking
  test('Guest Booking Without Account', async ({ page }) => {
    await page.goto('/shops/sample-shop')

    // Click reserve
    await page.locator('button:has-text("予約")').click()

    // At login prompt, choose guest option
    const guestOption = page.locator('button:has-text("ゲストとして続ける")')
    await guestOption.click()

    // Enter contact information
    await page.fill('input[name="guest-name"]', 'Test Guest')
    await page.fill('input[name="guest-phone"]', '090-1234-5678')
    await page.fill('input[name="guest-email"]', 'guest@example.com')

    // Continue with booking
    await page.locator('button:has-text("次へ")').click()

    // Select service and time
    await page.locator('input[value="60min"]').click()
    await page.locator('button[data-available="true"]').first().click()
    await page.locator('.time-slot').first().click()

    // Confirm booking
    await page.locator('button:has-text("確認")').click()

    // Verify guest info is shown
    const summary = page.locator('[data-testid="booking-summary"]')
    await expect(summary).toContainText('Test Guest')
    await expect(summary).toContainText('090-1234-5678')

    // Complete booking
    await page.locator('button:has-text("予約を確定")').click()

    // Verify booking reference provided
    const reference = page.locator('[data-testid="booking-reference"]')
    await expect(reference).toBeVisible()
    await expect(reference).toContainText(/[A-Z0-9]{6,}/)

    // Check create account prompt
    const createAccountPrompt = page.locator('button:has-text("アカウントを作成")')
    if (await createAccountPrompt.count() > 0) {
      await expect(createAccountPrompt).toBeVisible()
    }
  })
})

// Edge Cases
test.describe('Reservation Edge Cases', () => {
  test('Double Booking Prevention', async ({ page, context }) => {
    // Open same slot in two tabs
    const page1 = page
    const page2 = await context.newPage()

    // Navigate both to same booking
    await page1.goto('/shops/sample-shop/book')
    await page2.goto('/shops/sample-shop/book')

    // Select same service and slot
    await page1.locator('input[value="60min"]').click()
    await page2.locator('input[value="60min"]').click()

    const availableSlot = 'button:has-text("15:00")'
    await page1.locator(availableSlot).first().click()
    await page2.locator(availableSlot).first().click()

    // Try to book both
    await page1.locator('button:has-text("予約を確定")').click()
    await page2.locator('button:has-text("予約を確定")').click()

    // First should succeed
    await expect(page1.locator('[data-testid="booking-success"]')).toBeVisible()

    // Second should fail
    await expect(page2.locator('[data-testid="booking-error"], .error')).toBeVisible()
    await expect(page2).toContainText(/既に予約済み|利用できません/)

    await page2.close()
  })

  test('Session Timeout Recovery', async ({ page }) => {
    await page.goto('/shops/sample-shop/book')

    // Start booking process
    await page.locator('input[value="60min"]').click()
    await page.locator('button[data-available="true"]').first().click()

    // Simulate session timeout by clearing cookies
    await context.clearCookies()

    // Try to continue
    await page.locator('button:has-text("確認")').click()

    // Should redirect to login with saved state
    await expect(page).toHaveURL(/login/)

    // Check if return URL is saved
    const url = new URL(page.url())
    expect(url.searchParams.get('return')).toBeTruthy()

    // Login again
    await login(page)

    // Should return to booking with state preserved
    await expect(page.locator('[data-testid="booking-form"]')).toBeVisible()
  })
})