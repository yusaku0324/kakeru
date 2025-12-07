import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3200';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Go to search page with therapists tab
  console.log('Navigating to search page...');
  await page.goto(`${BASE_URL}/search?tab=therapists&today=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Take screenshot of the card
  await page.screenshot({ path: '/tmp/card-view-local.png', fullPage: true });
  console.log('Screenshot saved: /tmp/card-view-local.png');

  // Find and extract the availability time from therapist cards
  const cardAvailability = await page.evaluate(() => {
    // Look for text elements
    const results = [];

    // Look for 最短の空き枠 text
    const allText = document.body.innerText;
    const lines = allText.split('\n').filter(line =>
      line.includes('最短の空き枠') ||
      line.includes('次に入れる時間')
    );
    results.push(...lines.slice(0, 10));

    return results;
  });
  console.log('\n=== CARD PAGE (Search Results) ===');
  console.log('Availability texts found:', cardAvailability);

  // Navigate to staff detail page using /profiles/xxx/staff/xxx pattern
  const staffDetailUrl = `${BASE_URL}/profiles/sample-namba-resort/staff/11111111-1111-1111-8888-111111111111`;
  console.log('\nNavigating to detail page:', staffDetailUrl);
  await page.goto(staffDetailUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Take screenshot of detail page
  await page.screenshot({ path: '/tmp/detail-view-local.png', fullPage: true });
  console.log('Screenshot saved: /tmp/detail-view-local.png');

  // Extract availability info from detail page
  const detailAvailability = await page.evaluate(() => {
    const results = [];

    // Look for availability-related text
    const allText = document.body.innerText;
    const lines = allText.split('\n').filter(line =>
      line.includes('最短の空き枠') ||
      line.includes('次に入れる時間') ||
      line.includes('空き枠') ||
      (line.includes('本日') && !line.includes('本日予約')) ||
      line.includes('明日')
    );
    results.push(...lines.slice(0, 20));

    return results;
  });
  console.log('\n=== DETAIL PAGE (Therapist Profile) ===');
  console.log('Availability texts found:', detailAvailability);

  await browser.close();
  console.log('\nDone');
}

main().catch(console.error);
