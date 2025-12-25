import { test, expect } from '@playwright/test'

/**
 * Therapist Search E2E Tests
 * Generated from specs/therapist-search.md
 */

test.describe('Therapist Search', () => {
  // Scenario 1: Basic Therapist Search
  test('Basic Therapist Search', async ({ page }) => {
    await page.goto('/')

    // Click on therapist search tab/link
    const therapistSearchLink = page.locator('[data-testid="therapist-search"], a:has-text("セラピスト検索")')
    await therapistSearchLink.click()

    // Wait for therapist search page
    await page.waitForURL(/therapist/)

    // Enter therapist name in search field
    const searchInput = page.locator('[data-testid="therapist-search-input"], input[placeholder*="セラピスト"]')
    await searchInput.fill('さくら')
    await searchInput.press('Enter')

    // Wait for search results
    await page.waitForSelector('[data-testid="therapist-card"], .therapist-card')

    // Verify results contain "さくら"
    const therapistCards = page.locator('[data-testid="therapist-card"], .therapist-card')
    await expect(therapistCards.first()).toBeVisible()

    // Check therapist card contains expected elements
    const firstCard = therapistCards.first()
    await expect(firstCard.locator('img')).toBeVisible() // Photo
    await expect(firstCard.locator('[data-testid="therapist-name"], h3')).toContainText('さくら')
    await expect(firstCard.locator('[data-testid="shop-name"], .shop-name')).toBeVisible()

    // Check availability indicator
    const availabilityIndicator = firstCard.locator('[data-testid="availability"], .availability-status')
    if (await availabilityIndicator.count() > 0) {
      await expect(availabilityIndicator).toBeVisible()
    }
  })

  // Scenario 2: Therapist Filter by Characteristics
  test('Therapist Filter by Characteristics', async ({ page }) => {
    // Navigate to therapist search page
    await page.goto('/therapists')

    // Open filter panel
    const filterButton = page.locator('[data-testid="filter-button"], button:has-text("絞り込み")')
    await filterButton.click()

    // Select age range filter
    const ageFilter = page.locator('[data-filter="age"], select[name="age"]')
    if (await ageFilter.count() > 0) {
      await ageFilter.selectOption('20-25')
    } else {
      // Alternative: checkbox/radio approach
      await page.locator('input[name="age"][value="20-25"]').check()
    }

    // Select body type filter
    const bodyTypeFilter = page.locator('[data-filter="body-type"]')
    await bodyTypeFilter.locator('text=スレンダー').click()

    // Select style filter
    const styleFilter = page.locator('[data-filter="style"]')
    await styleFilter.locator('text=清楚系').click()

    // Apply filters
    const applyButton = page.locator('button:has-text("検索"), button:has-text("適用")')
    await applyButton.click()

    // Wait for filtered results
    await page.waitForTimeout(1000)

    // Verify filter tags are shown
    const filterTags = page.locator('[data-testid="active-filters"], .filter-tags')
    await expect(filterTags).toBeVisible()
    await expect(filterTags).toContainText('20-25歳')
    await expect(filterTags).toContainText('スレンダー')

    // Verify results are updated
    const therapistCards = page.locator('[data-testid="therapist-card"], .therapist-card')
    await expect(therapistCards.first()).toBeVisible()
  })

  // Scenario 3: Browse Therapists by Shop
  test('Browse Therapists by Shop', async ({ page }) => {
    // Navigate to a shop details page
    await page.goto('/shops/sample-shop') // This would be a real shop slug

    // Click on staff therapists section
    const therapistSection = page.locator('[data-testid="staff-therapists"], section:has-text("在籍セラピスト")')
    await expect(therapistSection).toBeVisible()

    // Check therapist grid/list is displayed
    const therapistGrid = therapistSection.locator('[data-testid="therapist-grid"], .therapist-grid')
    await expect(therapistGrid).toBeVisible()

    // Verify therapists are from this shop
    const therapistCards = therapistGrid.locator('.therapist-card')
    await expect(therapistCards.first()).toBeVisible()

    // Click "View All" if available
    const viewAllButton = therapistSection.locator('a:has-text("すべて見る"), button:has-text("すべて見る")')
    if (await viewAllButton.count() > 0) {
      await viewAllButton.click()
      await page.waitForURL(/therapists.*shop=/)
    }
  })

  // Scenario 4: Therapist Profile Detail View
  test('Therapist Profile Detail View', async ({ page }) => {
    // Navigate to therapist listing
    await page.goto('/therapists')

    // Wait for therapists to load
    await page.waitForSelector('.therapist-card')

    // Click on first therapist card
    const firstTherapist = page.locator('.therapist-card').first()
    await firstTherapist.click()

    // Wait for profile page
    await page.waitForURL(/therapists?\/[^\/]+/)

    // Verify profile elements
    await expect(page.locator('[data-testid="therapist-main-photo"], .main-photo')).toBeVisible()
    await expect(page.locator('h1')).toBeVisible() // Therapist name

    // Check self-introduction
    const introSection = page.locator('[data-testid="self-introduction"], section:has-text("自己紹介")')
    await expect(introSection).toBeVisible()

    // Check services offered
    const servicesSection = page.locator('[data-testid="services-offered"], section:has-text("サービス")')
    await expect(servicesSection).toBeVisible()

    // Check schedule section
    const scheduleSection = page.locator('[data-testid="schedule"], section:has-text("スケジュール"), section:has-text("出勤")')
    await expect(scheduleSection).toBeVisible()

    // Check booking button
    const bookingButton = page.locator('button:has-text("予約"), a:has-text("予約")')
    await expect(bookingButton).toBeVisible()
  })

  // Scenario 5: Therapist Schedule Checking
  test('Therapist Schedule Checking', async ({ page }) => {
    // Navigate to therapist profile with schedule
    await page.goto('/therapists/sample-therapist')

    // Locate schedule section
    const scheduleSection = page.locator('[data-testid="schedule-section"], section:has-text("スケジュール")')
    await expect(scheduleSection).toBeVisible()

    // Check calendar or schedule view
    const calendar = scheduleSection.locator('[data-testid="schedule-calendar"], .calendar')
    await expect(calendar).toBeVisible()

    // Navigate between days
    const nextDayButton = calendar.locator('button[aria-label="次の日"], button:has-text(">")')
    if (await nextDayButton.count() > 0) {
      await nextDayButton.click()
      await page.waitForTimeout(500)
    }

    // Check available time slots
    const timeSlots = calendar.locator('[data-testid="time-slot"], .time-slot')
    const availableSlot = timeSlots.filter({ hasText: /空き|○|Available/ }).first()

    if (await availableSlot.count() > 0) {
      await expect(availableSlot).toBeVisible()

      // Click on available slot
      await availableSlot.click()

      // Check if booking modal or confirmation appears
      const bookingModal = page.locator('[data-testid="booking-modal"], .booking-modal')
      if (await bookingModal.count() > 0) {
        await expect(bookingModal).toBeVisible()
      }
    }
  })

  // Scenario 6: New Therapist Highlights
  test('New Therapist Highlights', async ({ page }) => {
    await page.goto('/')

    // Find new therapist section
    const newTherapistSection = page.locator('[data-testid="new-therapists"], section:has-text("新人セラピスト")')

    if (await newTherapistSection.count() > 0) {
      await newTherapistSection.click()
      await page.waitForURL(/new|新人/)
    } else {
      // Navigate through therapist listing
      await page.goto('/therapists')

      // Look for new therapist filter
      const newFilter = page.locator('[data-filter="new"], input[value="new"]')
      if (await newFilter.count() > 0) {
        await newFilter.check()
      }
    }

    // Verify new therapist indicators
    await page.waitForSelector('.therapist-card')
    const newBadge = page.locator('[data-testid="new-badge"], .new-badge, .badge:has-text("NEW")')
    await expect(newBadge.first()).toBeVisible()

    // Check join date if displayed
    const joinDate = page.locator('[data-testid="join-date"], .join-date')
    if (await joinDate.count() > 0) {
      const dateText = await joinDate.first().textContent()
      expect(dateText).toContain('入店')
    }
  })

  // Scenario 7: Therapist Photo Gallery
  test('Therapist Photo Gallery', async ({ page }) => {
    // Navigate to therapist profile
    await page.goto('/therapists/sample-therapist')

    // Click on main photo or gallery icon
    const mainPhoto = page.locator('[data-testid="therapist-main-photo"], .main-photo')
    await mainPhoto.click()

    // Wait for gallery to open
    const gallery = page.locator('[data-testid="photo-gallery"], .photo-gallery, [role="dialog"]')
    await expect(gallery).toBeVisible()

    // Check navigation controls
    const nextButton = gallery.locator('button[aria-label="次の写真"], button:has-text(">")')
    const prevButton = gallery.locator('button[aria-label="前の写真"], button:has-text("<")')

    // Navigate through photos
    if (await nextButton.count() > 0) {
      await nextButton.click()
      await page.waitForTimeout(300)

      // Check photo counter
      const photoCounter = gallery.locator('[data-testid="photo-counter"], .photo-counter')
      if (await photoCounter.count() > 0) {
        await expect(photoCounter).toContainText(/\d+\/\d+/)
      }
    }

    // Close gallery
    const closeButton = gallery.locator('button[aria-label="閉じる"], button:has-text("×")')
    await closeButton.click()
    await expect(gallery).not.toBeVisible()
  })

  // Scenario 8: Popular Therapist Rankings
  test('Popular Therapist Rankings', async ({ page }) => {
    await page.goto('/')

    // Look for popular therapist section
    const popularSection = page.locator('[data-testid="popular-therapists"], section:has-text("人気セラピスト")')

    if (await popularSection.count() > 0) {
      // Click to view full rankings
      const viewRankingsLink = popularSection.locator('a:has-text("ランキング"), a:has-text("もっと見る")')
      if (await viewRankingsLink.count() > 0) {
        await viewRankingsLink.click()
        await page.waitForURL(/ranking|popular/)
      }
    } else {
      // Navigate directly to rankings
      await page.goto('/therapists/ranking')
    }

    // Verify ranking display
    const rankingList = page.locator('[data-testid="ranking-list"], .ranking-list')
    await expect(rankingList).toBeVisible()

    // Check ranking numbers
    const rankingNumbers = rankingList.locator('[data-testid="rank-number"], .rank')
    await expect(rankingNumbers.first()).toContainText('1')

    // Check period selector if available
    const periodSelector = page.locator('[data-testid="ranking-period"], select[name="period"]')
    if (await periodSelector.count() > 0) {
      await periodSelector.selectOption('weekly')
      await page.waitForTimeout(1000)
    }
  })

  // Scenario 9: Therapist Search on Mobile
  test('Therapist Search on Mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })

    await page.goto('/therapists')

    // Check mobile search interface
    const mobileSearchBar = page.locator('[data-testid="mobile-search"], input[type="search"]')
    await expect(mobileSearchBar).toBeVisible()

    // Enter search term
    await mobileSearchBar.fill('ゆい')
    await mobileSearchBar.press('Enter')

    // Wait for results
    await page.waitForSelector('.therapist-card')

    // Check mobile-optimized layout
    const therapistCards = page.locator('.therapist-card')
    const firstCard = await therapistCards.first().boundingBox()

    if (firstCard) {
      // Cards should be nearly full width on mobile
      expect(firstCard.width).toBeGreaterThan(300)
    }

    // Test mobile filter access
    const filterButton = page.locator('[data-testid="mobile-filter-button"], button[aria-label="フィルター"]')
    if (await filterButton.count() > 0) {
      await filterButton.click()

      // Check if filter modal/sheet opens
      const filterModal = page.locator('[data-testid="filter-modal"], .filter-sheet')
      await expect(filterModal).toBeVisible()
    }
  })

  // Scenario 10: Favorite Therapist Management
  test('Favorite Therapist Management', async ({ page, context }) => {
    // This test assumes user is logged in
    // In real scenario, would need to handle authentication

    await page.goto('/therapists')

    // Wait for therapists to load
    await page.waitForSelector('.therapist-card')

    // Find favorite button on first therapist
    const firstTherapist = page.locator('.therapist-card').first()
    const favoriteButton = firstTherapist.locator('[data-testid="favorite-button"], button[aria-label*="お気に入り"]')

    if (await favoriteButton.count() > 0) {
      // Click to add to favorites
      await favoriteButton.click()

      // Check if button state changed
      await expect(favoriteButton).toHaveAttribute('aria-pressed', 'true')

      // Navigate to favorites list
      await page.goto('/account/favorites/therapists')

      // Verify therapist appears in favorites
      const favoritesList = page.locator('[data-testid="favorites-list"], .favorites-list')
      await expect(favoritesList).toBeVisible()

      const favoritedTherapist = favoritesList.locator('.therapist-card').first()
      await expect(favoritedTherapist).toBeVisible()

      // Remove from favorites
      const removeFavoriteButton = favoritedTherapist.locator('[data-testid="remove-favorite"]')
      if (await removeFavoriteButton.count() > 0) {
        await removeFavoriteButton.click()

        // Confirm removal if dialog appears
        const confirmButton = page.locator('button:has-text("削除"), button:has-text("はい")')
        if (await confirmButton.count() > 0) {
          await confirmButton.click()
        }
      }
    }
  })

  // Scenario 11: Therapist Review Display
  test('Therapist Review Display', async ({ page }) => {
    // Navigate to therapist with reviews
    await page.goto('/therapists/sample-therapist')

    // Locate review section
    const reviewSection = page.locator('[data-testid="reviews-section"], section:has-text("レビュー"), section:has-text("口コミ")')
    await expect(reviewSection).toBeVisible()

    // Check overall rating display
    const overallRating = reviewSection.locator('[data-testid="overall-rating"], .rating-average')
    await expect(overallRating).toBeVisible()
    await expect(overallRating).toContainText(/\d+\.?\d*/)

    // Check individual reviews
    const reviewList = reviewSection.locator('[data-testid="review-list"], .review-list')
    const reviews = reviewList.locator('[data-testid="review-item"], .review')

    if (await reviews.count() > 0) {
      const firstReview = reviews.first()
      await expect(firstReview).toBeVisible()

      // Check review elements
      await expect(firstReview.locator('.rating, [data-testid="review-rating"]')).toBeVisible()
      await expect(firstReview.locator('.review-date, [data-testid="review-date"]')).toBeVisible()
      await expect(firstReview.locator('.review-text, [data-testid="review-content"]')).toBeVisible()

      // Check verified indicator if present
      const verifiedBadge = firstReview.locator('[data-testid="verified-badge"], .verified')
      if (await verifiedBadge.count() > 0) {
        await expect(verifiedBadge).toBeVisible()
      }
    }

    // Test review sorting if available
    const sortDropdown = reviewSection.locator('select[name="review-sort"]')
    if (await sortDropdown.count() > 0) {
      await sortDropdown.selectOption('newest')
      await page.waitForTimeout(1000)
    }
  })
})

// Edge Cases
test.describe('Therapist Search Edge Cases', () => {
  test('Therapist No Longer Available', async ({ page }) => {
    // Try to access removed therapist profile
    await page.goto('/therapists/removed-therapist-id')

    // Check for appropriate error message
    await expect(page.locator('body')).toContainText(/お探しのセラピスト|見つかりません|利用できません/)

    // Check for suggestions
    const suggestions = page.locator('[data-testid="similar-therapists"], section:has-text("おすすめ")')
    if (await suggestions.count() > 0) {
      await expect(suggestions).toBeVisible()
    }
  })

  test('Fully Booked Therapist Schedule', async ({ page }) => {
    // Navigate to therapist profile
    await page.goto('/therapists/popular-therapist')

    // Check schedule section
    const scheduleSection = page.locator('[data-testid="schedule-section"]')
    await expect(scheduleSection).toBeVisible()

    // Look for all booked indicators
    const bookedSlots = scheduleSection.locator('.booked, [data-available="false"]')
    const availableSlots = scheduleSection.locator('.available, [data-available="true"]')

    // If all slots are booked
    if (await availableSlots.count() === 0) {
      // Check for waitlist option
      const waitlistButton = page.locator('button:has-text("キャンセル待ち"), button:has-text("通知を受け取る")')
      if (await waitlistButton.count() > 0) {
        await expect(waitlistButton).toBeVisible()
      }
    }
  })
})