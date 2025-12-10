import { chromium } from 'playwright';

async function testOverlayConsistency() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('=== Testing /search page ===');
  await page.goto('http://localhost:3000/search');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const searchCard = page.locator('[data-testid="therapist-card"]').first();
  const searchCardVisible = await searchCard.isVisible().catch(() => false);
  console.log('Search card visible:', searchCardVisible);

  if (searchCardVisible) {
    const initialSearchUrl = page.url();
    await searchCard.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: '/tmp/test-search-overlay.png' });

    const afterSearchUrl = page.url();
    console.log('Search: URL changed to profiles:', afterSearchUrl.includes('/profiles/'));

    // Check for overlay by looking for elements with data-state="open" and form button
    const overlayElements = await page.locator('[data-state="open"]').count();
    const formButtonVisible = await page.locator('button:has-text("予約フォームを開く")').isVisible().catch(() => false);
    console.log('Search: Overlay elements with data-state=open:', overlayElements);
    console.log('Search: Form button visible:', formButtonVisible);

    if (overlayElements > 0 || formButtonVisible) {
      console.log('✅ /search: Overlay works correctly');
    }

    // Close overlay
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  console.log('\n=== Testing /guest/match-chat page ===');
  await page.goto('http://localhost:3000/guest/match-chat');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Fill in required fields
  // 1. Set date (required)
  const dateInput = page.locator('input[type="date"]');
  if (await dateInput.isVisible().catch(() => false)) {
    // Set date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await dateInput.fill(dateStr);
    console.log('Set date to:', dateStr);
    await page.waitForTimeout(500);
  }

  // 2. Select a mood chip
  const moodChip = page.getByText('お任せしたい');
  if (await moodChip.isVisible().catch(() => false)) {
    await moodChip.click();
    console.log('Selected mood: お任せしたい');
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: '/tmp/test-match-chat-form-filled.png' });

  // Click submit button
  const submitBtn = page.locator('button:has-text("この条件でおすすめをみる")');
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click();
    console.log('Clicked submit button');

    // Wait for loading to complete - look for therapist cards to appear
    console.log('Waiting for recommendations to load...');
    try {
      await page.locator('[data-testid="therapist-card"]').first().waitFor({
        state: 'visible',
        timeout: 30000
      });
      console.log('Cards loaded!');
    } catch (e) {
      console.log('Cards did not appear within timeout, continuing...');
    }
  }

  // Scroll to see results
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/test-match-chat-results.png' });

  // Check for therapist cards
  const matchCards = await page.locator('[data-testid="therapist-card"]').all();
  console.log('Match-chat cards found:', matchCards.length);

  if (matchCards.length > 0) {
    const initialMatchUrl = page.url();
    await matchCards[0].click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: '/tmp/test-match-chat-overlay.png' });

    const afterMatchUrl = page.url();
    const navigatedToProfiles = afterMatchUrl.includes('/profiles/');
    console.log('Match-chat: URL after click:', afterMatchUrl);
    console.log('Match-chat: Navigated to profiles:', navigatedToProfiles);

    if (navigatedToProfiles) {
      console.log('❌ BUG: /guest/match-chat navigated to profile page instead of opening overlay!');
    } else {
      // Check for overlay
      const overlayElements = await page.locator('[data-state="open"]').count();
      const formButtonVisible = await page.locator('button:has-text("予約フォームを開く")').isVisible().catch(() => false);
      console.log('Match-chat: Overlay elements:', overlayElements);
      console.log('Match-chat: Form button visible:', formButtonVisible);

      if (overlayElements > 0 || formButtonVisible) {
        console.log('✅ /guest/match-chat: Overlay works correctly');
        console.log('\n🎉 SUCCESS: Both pages show consistent overlay behavior!');
      }
    }
  } else {
    console.log('No cards found on match-chat page - checking page content');
    const errorMsg = await page.locator('text=エリアと日付を入力してください').isVisible().catch(() => false);
    if (errorMsg) {
      console.log('Error: Form validation failed - area and date required');
    }
  }

  await browser.close();
  console.log('\nTest complete!');
}

testOverlayConsistency().catch(console.error);
