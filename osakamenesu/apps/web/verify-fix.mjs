import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3200';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const issues = [];

  console.log('Verifying link fix...\n');

  // Go to homepage
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Find "本日予約できる店舗" section links
  const todayShopLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href^="/profiles/"], a[href^="/shops/"]'));
    return links.map(link => ({
      href: link.getAttribute('href'),
      text: link.textContent?.trim().slice(0, 50) || ''
    }));
  });

  console.log(`Found ${todayShopLinks.length} shop/profile links on homepage:\n`);

  // Test each unique link
  const testedUrls = new Set();
  let successCount = 0;
  let failCount = 0;

  for (const linkInfo of todayShopLinks) {
    if (testedUrls.has(linkInfo.href)) continue;
    testedUrls.add(linkInfo.href);

    const targetUrl = `${BASE_URL}${linkInfo.href}`;
    console.log(`Testing: ${linkInfo.href}`);

    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);

      const pageContent = await page.content();
      const has404 = pageContent.includes('店舗が見つかりませんでした') ||
                     pageContent.includes('404') ||
                     pageContent.includes('Not Found');

      if (has404) {
        console.log(`  ERROR: Page shows 404/not found`);
        const errorScreenshot = `/tmp/verify-error-${linkInfo.href.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
        await page.screenshot({ path: errorScreenshot });
        issues.push({ link: linkInfo.href, error: '404/Not Found', screenshot: errorScreenshot });
        failCount++;
      } else {
        console.log(`  OK`);
        successCount++;
      }
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
      issues.push({ link: linkInfo.href, error: error.message });
      failCount++;
    }
  }

  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================\n');

  console.log(`Total links tested: ${testedUrls.size}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);

  if (issues.length > 0) {
    console.log('\nIssues:');
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.link} - ${issue.error}`);
    });
  } else {
    console.log('\nAll links working correctly!');
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);
