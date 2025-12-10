import { chromium } from 'playwright';

async function testShopTherapistFlow() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('=== Test 1: /search?tab=shops shows shop listings ===');
  await page.goto('http://localhost:3000/search?tab=shops');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Check shops tab is active
  const shopsTab = page.locator('a[aria-current="page"]:has-text("店舗")');
  const tabVisible = await shopsTab.isVisible().catch(() => false);
  console.log('Shops tab active:', tabVisible);

  // Look for shop links
  const shopLinks = await page.locator('a[href*="/profiles/sample-"]').all();
  console.log('Shop links found:', shopLinks.length);

  await page.screenshot({ path: '/tmp/test-search-shops-tab.png' });

  console.log('\n=== Test 2: Click shop to navigate to profile page ===');
  if (shopLinks.length > 0) {
    const href = await shopLinks[0].getAttribute('href');
    console.log('First shop link:', href);
    await shopLinks[0].click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    console.log('Is profile page:', currentUrl.includes('/profiles/'));
    console.log('Is canonical (not staff subpage):', !currentUrl.match(/\/staff\/[a-f0-9-]+/));

    await page.screenshot({ path: '/tmp/test-shop-profile-page.png' });
  } else {
    console.log('No shop links, navigating directly');
    await page.goto('http://localhost:3000/profiles/sample-namba-resort');
    await page.waitForLoadState('networkidle');
  }

  console.log('\n=== Test 3: Shop page shows therapists ===');
  const staffSection = page.locator('#staff-section');
  const staffSectionVisible = await staffSection.isVisible().catch(() => false);
  console.log('Staff section visible:', staffSectionVisible);

  if (staffSectionVisible) {
    await staffSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const therapistCards = await staffSection.locator('[id^="staff-"]').all();
    console.log('Therapist cards:', therapistCards.length);

    const reserveButtons = await staffSection.locator('button:has-text("予約する")').all();
    console.log('Reserve buttons:', reserveButtons.length);

    await page.screenshot({ path: '/tmp/test-staff-section.png' });
  }

  console.log('\n=== Test 4: Clicking 予約する opens overlay ===');
  const reserveButton = page.locator('button:has-text("予約する")').first();
  if (await reserveButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await reserveButton.scrollIntoViewIfNeeded();
    await reserveButton.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: '/tmp/test-therapist-overlay.png' });

    // Get all visible text on page to debug
    const bodyText = await page.locator('body').textContent().catch(() => '');
    const hasFormText = bodyText.includes('予約フォームを開く');
    const hasWebRequestText = bodyText.includes('WEB予約リクエスト');

    console.log('Page contains "予約フォームを開く":', hasFormText);
    console.log('Page contains "WEB予約リクエスト":', hasWebRequestText);

    // Try to find by text content directly
    const formButton = page.getByText('予約フォームを開く');
    const formButtonCount = await formButton.count();
    console.log('Form button count:', formButtonCount);

    const formButtonVisible = hasFormText || hasWebRequestText || formButtonCount > 0;
    if (formButtonVisible) {
      console.log('SUCCESS: Overlay opened correctly!');
    } else {
      console.log('WARN: Overlay content not detected');
    }

    // Test form button - use .first() and force click due to overlay container
    if (formButtonVisible && formButtonCount > 0) {
      console.log('\n=== Test 5: Check calendar tab for time consistency ===');

      // Click on booking tab to see the calendar
      const bookingTab = page.getByText('空き状況・予約').first();
      if (await bookingTab.isVisible()) {
        await bookingTab.evaluate((el) => el.click());
        await page.waitForTimeout(1500);

        await page.screenshot({ path: '/tmp/test-booking-tab-calendar.png', fullPage: true });
        console.log('Screenshot saved: /tmp/test-booking-tab-calendar.png');

        // Look for time slots in the calendar
        const pageContent = await page.content();
        const timeMatches = pageContent.match(/\d{1,2}:\d{2}/g);
        if (timeMatches) {
          const uniqueTimes = [...new Set(timeMatches)].slice(0, 10);
          console.log('Time slots found in calendar:', uniqueTimes);
        }
      }

      console.log('\n=== Test 6: Form button opens reservation form ===');
      // Click the form button using JavaScript evaluate to bypass pointer event interception
      const formBtnElement = formButton.first();
      await formBtnElement.evaluate((el) => el.click());
      await page.waitForTimeout(1500);

      await page.screenshot({ path: '/tmp/test-reservation-form.png' });

      const formInputs = await page.locator('input[type="text"], input[type="email"], input[type="tel"], textarea').all();
      console.log('Form inputs found:', formInputs.length);

      if (formInputs.length > 0) {
        console.log('SUCCESS: Reservation form opened with inputs!');
      } else {
        console.log('INFO: Form may use different input types or be in a different view');
      }
    }

    // Close overlay
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  console.log('\n=== Test 7: Compare with /search overlay ===');
  await page.goto('http://localhost:3000/search');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const searchCard = page.locator('[data-testid="therapist-card"]').first();
  if (await searchCard.isVisible({ timeout: 10000 }).catch(() => false)) {
    await searchCard.click();
    await page.waitForTimeout(1500);

    const searchOverlayCount = await page.locator('[data-state="open"]').count();
    const searchFormBtn = await page.locator('button:has-text("予約フォームを開く")').isVisible().catch(() => false);

    await page.screenshot({ path: '/tmp/test-search-overlay.png' });

    console.log('Search overlay elements:', searchOverlayCount);
    console.log('Search form button:', searchFormBtn);

    console.log('Both overlays should have similar structure');
  }

  await browser.close();
  console.log('\n=== All tests complete! ===');
}

testShopTherapistFlow().catch(console.error);
