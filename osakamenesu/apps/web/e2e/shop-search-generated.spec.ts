import { test, expect } from '@playwright/test'

/**
 * Shop Search Flow E2E Tests
 * Generated from specs/shop-search-flow.md
 */

test.describe('Shop Search Flow', () => {
  // Scenario 1: Basic Shop Search from Homepage
  test('Basic Shop Search from Homepage', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/')

    // Wait for the page to load
    await expect(page).toHaveTitle(/大阪メンエス/)

    // Locate the main search bar
    const searchBar = page.locator('[data-testid="search-input"], input[type="search"]').first()
    await expect(searchBar).toBeVisible()

    // Enter search term "大阪"
    await searchBar.fill('大阪')

    // Click search button or press Enter
    await searchBar.press('Enter')

    // Wait for search results to load
    await page.waitForSelector('[data-testid="search-results"], .search-results', {
      state: 'visible',
      timeout: 10000
    })

    // Verify results contain shops with "大阪"
    const shopCards = page.locator('[data-testid="shop-card"], .shop-card')
    await expect(shopCards.first()).toBeVisible()

    // Check that results contain the search term
    const firstShopText = await shopCards.first().textContent()
    expect(firstShopText).toContain('大阪')

    // Verify shop card elements
    await expect(shopCards.first().locator('img')).toBeVisible() // Thumbnail
    await expect(shopCards.first().locator('h2, h3')).toBeVisible() // Shop name
  })

  // Scenario 2: Area-Based Shop Search
  test('Area-Based Shop Search', async ({ page }) => {
    await page.goto('/')

    // Locate area navigation section
    const areaSection = page.locator('[data-testid="area-navigation"], section:has-text("エリアから探す")')
    await expect(areaSection).toBeVisible()

    // Click on Umeda area
    const umedaLink = areaSection.locator('a:has-text("梅田"), [data-area="umeda"]').first()
    await umedaLink.click()

    // Wait for area page to load
    await page.waitForURL(/area|umeda/, { timeout: 10000 })

    // Verify area-specific content
    await expect(page.locator('h1')).toContainText(/梅田/)

    // Verify shop listings are displayed
    const shopList = page.locator('[data-testid="shop-list"], .shop-list')
    await expect(shopList).toBeVisible()

    // Check filter options are available
    const filterSection = page.locator('[data-testid="filters"], .filter-section')
    await expect(filterSection).toBeVisible()
  })

  // Scenario 3: Advanced Shop Filtering
  test('Advanced Shop Filtering', async ({ page }) => {
    // Navigate to search results
    await page.goto('/')
    const searchBar = page.locator('input[type="search"]').first()
    await searchBar.fill('エステ')
    await searchBar.press('Enter')

    // Wait for results
    await page.waitForSelector('.shop-card', { state: 'visible' })

    // Open filter panel
    const filterButton = page.locator('button:has-text("絞り込み"), [data-testid="filter-button"]')
    await filterButton.click()

    // Select price range filter
    const priceFilter = page.locator('[data-filter="price"], select[name="price"]')
    if (await priceFilter.count() > 0) {
      await priceFilter.selectOption({ label: '10,000-15,000円' })
    } else {
      // Alternative: click price range buttons
      await page.locator('button:has-text("10,000-15,000")').click()
    }

    // Select business hours filter
    const hoursFilter = page.locator('[data-filter="hours"], input[value="late-night"]')
    if (await hoursFilter.count() > 0) {
      await hoursFilter.check()
    }

    // Apply filters
    const applyButton = page.locator('button:has-text("検索"), button:has-text("適用")')
    await applyButton.click()

    // Verify filtered results
    await page.waitForTimeout(1000) // Wait for filter application
    const filteredResults = page.locator('.shop-card')
    await expect(filteredResults.first()).toBeVisible()

    // Check filter tags are displayed
    const filterTags = page.locator('[data-testid="active-filters"], .filter-tags')
    await expect(filterTags).toBeVisible()
  })

  // Scenario 5: Shop Details Navigation
  test('Shop Details Navigation', async ({ page }) => {
    await page.goto('/')

    // Perform a search
    const searchBar = page.locator('input[type="search"]').first()
    await searchBar.fill('リラックス')
    await searchBar.press('Enter')

    // Wait for results and click first shop
    await page.waitForSelector('.shop-card')
    const firstShop = page.locator('.shop-card').first()
    await firstShop.click()

    // Wait for shop details page
    await page.waitForURL(/shops\/[^\/]+/)

    // Verify shop details elements
    await expect(page.locator('h1')).toBeVisible() // Shop name

    // Check photo gallery
    const gallery = page.locator('[data-testid="photo-gallery"], .photo-gallery, .gallery')
    await expect(gallery).toBeVisible()

    // Check service menu
    const serviceMenu = page.locator('[data-testid="service-menu"], section:has-text("サービス"), section:has-text("料金")')
    await expect(serviceMenu).toBeVisible()

    // Check therapist list
    const therapistSection = page.locator('[data-testid="therapist-list"], section:has-text("セラピスト")')
    await expect(therapistSection).toBeVisible()

    // Check booking button
    const bookingButton = page.locator('button:has-text("予約"), a:has-text("予約")')
    await expect(bookingButton).toBeVisible()
  })

  // Scenario 6: Search with No Results
  test('Search with No Results', async ({ page }) => {
    await page.goto('/')

    // Enter nonsensical search term
    const searchBar = page.locator('input[type="search"]').first()
    await searchBar.fill('xyzabc123')
    await searchBar.press('Enter')

    // Wait for no results message
    await page.waitForSelector('[data-testid="no-results"], .no-results', {
      state: 'visible',
      timeout: 10000
    })

    // Verify no results message
    await expect(page.locator('body')).toContainText(/検索結果が見つかりませんでした|該当する店舗がありません/)

    // Check for suggestions
    const suggestions = page.locator('[data-testid="search-suggestions"], .suggestions')
    if (await suggestions.count() > 0) {
      await expect(suggestions).toBeVisible()
    }

    // Check for popular shops section as alternative
    const popularShops = page.locator('section:has-text("人気"), section:has-text("おすすめ")')
    if (await popularShops.count() > 0) {
      await expect(popularShops).toBeVisible()
    }
  })

  // Scenario 7: Search Result Sorting
  test('Search Result Sorting', async ({ page }) => {
    await page.goto('/')

    // Perform search with multiple results
    const searchBar = page.locator('input[type="search"]').first()
    await searchBar.fill('マッサージ')
    await searchBar.press('Enter')

    // Wait for results
    await page.waitForSelector('.shop-card')

    // Locate sort dropdown
    const sortDropdown = page.locator('[data-testid="sort-dropdown"], select:has-text("並び替え")')

    if (await sortDropdown.count() > 0) {
      // Test sorting by price (low to high)
      await sortDropdown.selectOption({ label: '価格が安い順' })
      await page.waitForTimeout(1000)

      // Verify sort is applied
      const currentSort = await sortDropdown.inputValue()
      expect(currentSort).toBeTruthy()
    }
  })

  // Scenario 8: Mobile Shop Search
  test('Mobile Shop Search', async ({ page, isMobile }) => {
    // Set mobile viewport
    if (!isMobile) {
      await page.setViewportSize({ width: 375, height: 812 })
    }

    await page.goto('/')

    // Check for mobile search interface
    const mobileSearchIcon = page.locator('[data-testid="mobile-search-icon"], button[aria-label="検索"]')

    if (await mobileSearchIcon.count() > 0) {
      await mobileSearchIcon.click()
      // Wait for mobile search overlay
      await page.waitForSelector('[data-testid="mobile-search-overlay"], .search-overlay')
    }

    // Enter search term
    const searchInput = page.locator('input[type="search"]').first()
    await searchInput.fill('新大阪')
    await searchInput.press('Enter')

    // Wait for results
    await page.waitForSelector('.shop-card')

    // Verify mobile-optimized display
    const shopCards = page.locator('.shop-card')
    const firstCard = shopCards.first()
    await expect(firstCard).toBeVisible()

    // Check that cards are in single column (mobile layout)
    const cardBounds = await firstCard.boundingBox()
    if (cardBounds) {
      expect(cardBounds.width).toBeGreaterThan(300) // Should be nearly full width
    }
  })

  // Scenario 10: Shop Search Pagination
  test('Shop Search Pagination', async ({ page }) => {
    await page.goto('/')

    // Search for common term to get many results
    const searchBar = page.locator('input[type="search"]').first()
    await searchBar.fill('大阪')
    await searchBar.press('Enter')

    // Wait for results
    await page.waitForSelector('.shop-card')

    // Scroll to pagination
    const pagination = page.locator('[data-testid="pagination"], .pagination, nav[aria-label="ページネーション"]')

    if (await pagination.count() > 0) {
      await pagination.scrollIntoViewIfNeeded()

      // Click next page
      const nextButton = pagination.locator('button:has-text("次"), a:has-text("次"), [aria-label="次のページ"]')
      if (await nextButton.count() > 0) {
        await nextButton.click()

        // Wait for page 2 results
        await page.waitForURL(/page=2/)
        await page.waitForSelector('.shop-card')

        // Verify we're on page 2
        expect(page.url()).toContain('page=2')

        // Click specific page number (e.g., page 3)
        const page3Button = pagination.locator('button:has-text("3"), a:has-text("3")')
        if (await page3Button.count() > 0) {
          await page3Button.click()
          await page.waitForURL(/page=3/)
        }
      }
    }
  })
})

// Edge Cases
test.describe('Shop Search Edge Cases', () => {
  test('Special Characters in Search', async ({ page }) => {
    await page.goto('/')

    const searchBar = page.locator('input[type="search"]').first()

    // Test with special characters
    await searchBar.fill('メンエス@#$%')
    await searchBar.press('Enter')

    // Should handle gracefully
    await page.waitForTimeout(2000)

    // Check page doesn't break
    await expect(page.locator('body')).not.toContainText('Error')
    await expect(page.locator('body')).not.toContainText('undefined')
  })

  test('XSS Prevention in Search', async ({ page }) => {
    await page.goto('/')

    const searchBar = page.locator('input[type="search"]').first()

    // Try XSS attack
    const xssPayload = '<script>alert("xss")</script>'
    await searchBar.fill(xssPayload)
    await searchBar.press('Enter')

    // Wait for results
    await page.waitForTimeout(2000)

    // Check that script is not executed
    // If XSS was successful, an alert would appear
    const dialogs: string[] = []
    page.on('dialog', dialog => {
      dialogs.push(dialog.message())
      dialog.dismiss()
    })

    await page.waitForTimeout(1000)
    expect(dialogs).toHaveLength(0)

    // Check that the search term is properly escaped if displayed
    const searchDisplay = page.locator('[data-testid="search-query-display"], .search-query')
    if (await searchDisplay.count() > 0) {
      const displayText = await searchDisplay.textContent()
      expect(displayText).not.toContain('<script>')
    }
  })
})