import { chromium } from 'playwright';

const BASE_URL = 'https://web-bm1jiuznl-yusaku0324s-projects.vercel.app';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Go to search page with therapists tab
  console.log('Navigating to search page...');
  await page.goto(`${BASE_URL}/search?tab=therapists&today=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Take screenshot of the card
  await page.screenshot({ path: '/tmp/card-view.png', fullPage: false });
  console.log('Screenshot saved: /tmp/card-view.png');

  // Find and extract the availability time from the first therapist card
  const cardAvailability = await page.evaluate(() => {
    // Look for elements containing 最短の空き枠 or similar
    const elements = document.querySelectorAll('*');
    const results = [];
    for (const el of elements) {
      const text = el.textContent;
      if (text && (text.includes('最短の空き枠') || text.includes('空き枠'))) {
        if (el.children.length === 0 || el.innerText === text.trim()) {
          results.push(text.trim().slice(0, 100));
        }
      }
    }
    return results.slice(0, 5);
  });
  console.log('Card availability texts:', cardAvailability);

  // Click on the first therapist card to go to detail page
  // First find a therapist link
  const therapistLink = await page.locator('a[href*="/profiles/"][href*="/staff/"]').first();
  if (await therapistLink.count() > 0) {
    const href = await therapistLink.getAttribute('href');
    console.log('Found therapist link:', href);

    // Navigate to detail page
    await page.goto(`${BASE_URL}${href}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Take screenshot of detail page
    await page.screenshot({ path: '/tmp/detail-view.png', fullPage: false });
    console.log('Screenshot saved: /tmp/detail-view.png');

    // Extract availability info from detail page
    const detailAvailability = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const results = [];
      for (const el of elements) {
        const text = el.textContent;
        if (text && (text.includes('次に入れる時間') || text.includes('空き枠サマリー') || text.includes('本日') || text.includes('明日'))) {
          if (el.children.length === 0 || el.tagName === 'DIV' || el.tagName === 'SPAN' || el.tagName === 'P') {
            const trimmed = text.trim().slice(0, 150);
            if (trimmed.length < 150 && !results.includes(trimmed)) {
              results.push(trimmed);
            }
          }
        }
      }
      return results.slice(0, 10);
    });
    console.log('Detail availability texts:', detailAvailability);
  } else {
    console.log('No therapist link found');
  }

  await browser.close();
  console.log('Done');
}

main().catch(console.error);
