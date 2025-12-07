import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3200';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const visitedUrls = new Set();
  const allLinks = [];
  const screenshots = [];
  const issues = [];

  // Start from homepage
  console.log('\n========================================');
  console.log('STEP 1: Taking screenshots of all pages');
  console.log('========================================\n');

  // Pages to visit
  const pagesToVisit = [
    { url: '/', name: 'homepage' },
    { url: '/search', name: 'search' },
    { url: '/search?tab=therapists&today=1', name: 'search-therapists' },
    { url: '/search?tab=shops', name: 'search-shops' },
    { url: '/shops/sample-namba-resort', name: 'shop-detail' },
    { url: '/profiles/sample-namba-resort/staff/11111111-1111-1111-8888-111111111111', name: 'therapist-detail-aoi' },
    { url: '/profiles/sample-namba-resort/staff/22222222-2222-2222-8888-222222222222', name: 'therapist-detail-rin' },
  ];

  // Take screenshots of each page
  for (const pageInfo of pagesToVisit) {
    const fullUrl = `${BASE_URL}${pageInfo.url}`;
    console.log(`Visiting: ${pageInfo.name} (${pageInfo.url})`);

    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      const screenshotPath = `/tmp/site-${pageInfo.name}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshots.push({ name: pageInfo.name, path: screenshotPath, url: pageInfo.url });
      console.log(`  Screenshot saved: ${screenshotPath}`);

      visitedUrls.add(pageInfo.url);
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
      issues.push({ page: pageInfo.name, url: pageInfo.url, error: error.message });
    }
  }

  console.log('\n========================================');
  console.log('STEP 2: Collecting all links from homepage');
  console.log('========================================\n');

  // Go to homepage and collect all links
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const homepageLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    return links.map(link => ({
      href: link.getAttribute('href'),
      text: link.textContent?.trim().slice(0, 50) || '',
      visible: link.offsetParent !== null
    })).filter(l => l.href && !l.href.startsWith('javascript:') && !l.href.startsWith('mailto:') && !l.href.startsWith('tel:'));
  });

  console.log(`Found ${homepageLinks.length} links on homepage:\n`);

  const uniqueLinks = new Map();
  for (const link of homepageLinks) {
    if (!uniqueLinks.has(link.href)) {
      uniqueLinks.set(link.href, link);
    }
  }

  for (const [href, link] of uniqueLinks) {
    console.log(`  ${href}`);
    console.log(`    Text: "${link.text}"`);
  }

  console.log('\n========================================');
  console.log('STEP 3: Testing link transitions from homepage');
  console.log('========================================\n');

  // Test each unique link
  let linkIndex = 0;
  for (const [href, linkInfo] of uniqueLinks) {
    linkIndex++;

    // Skip external links
    if (href.startsWith('http') && !href.startsWith(BASE_URL)) {
      console.log(`[${linkIndex}/${uniqueLinks.size}] SKIP external: ${href}`);
      continue;
    }

    // Normalize URL
    let targetUrl = href;
    if (href.startsWith('/')) {
      targetUrl = `${BASE_URL}${href}`;
    } else if (!href.startsWith('http')) {
      targetUrl = `${BASE_URL}/${href}`;
    }

    console.log(`[${linkIndex}/${uniqueLinks.size}] Testing: ${href}`);
    console.log(`  Link text: "${linkInfo.text}"`);

    try {
      // Navigate to homepage first
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);

      // Find and click the link
      const linkSelector = `a[href="${href}"]`;
      const linkElement = await page.$(linkSelector);

      if (linkElement) {
        await linkElement.click();
        await page.waitForTimeout(2000);

        const finalUrl = page.url();
        const pathname = new URL(finalUrl).pathname + new URL(finalUrl).search;

        console.log(`  Navigated to: ${pathname}`);

        // Check for errors on the page
        const pageContent = await page.content();
        const hasError = pageContent.includes('404') ||
                        pageContent.includes('Error') ||
                        pageContent.includes('エラー') ||
                        pageContent.includes('Not Found');

        if (hasError && !pathname.includes('404')) {
          // Take screenshot of error page
          const errorScreenshot = `/tmp/error-link-${linkIndex}.png`;
          await page.screenshot({ path: errorScreenshot, fullPage: true });
          issues.push({
            page: 'homepage',
            link: href,
            text: linkInfo.text,
            destination: pathname,
            error: 'Page may contain errors',
            screenshot: errorScreenshot
          });
          console.log(`  WARNING: Page may contain errors`);
        } else {
          console.log(`  OK`);
        }

        // Save screenshot if not already visited
        if (!visitedUrls.has(pathname)) {
          const safeName = pathname.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 50);
          const screenshotPath = `/tmp/link-${safeName}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          visitedUrls.add(pathname);
        }
      } else {
        console.log(`  Link element not found`);
      }
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
      issues.push({
        page: 'homepage',
        link: href,
        text: linkInfo.text,
        error: error.message
      });
    }
  }

  console.log('\n========================================');
  console.log('STEP 4: Testing search page links');
  console.log('========================================\n');

  // Go to search page and collect links
  await page.goto(`${BASE_URL}/search?tab=therapists&today=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const searchLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    return links.map(link => ({
      href: link.getAttribute('href'),
      text: link.textContent?.trim().slice(0, 50) || ''
    })).filter(l =>
      l.href &&
      (l.href.includes('/profiles/') || l.href.includes('/shops/')) &&
      !l.href.startsWith('javascript:')
    );
  });

  const uniqueSearchLinks = new Map();
  for (const link of searchLinks) {
    if (!uniqueSearchLinks.has(link.href)) {
      uniqueSearchLinks.set(link.href, link);
    }
  }

  console.log(`Found ${uniqueSearchLinks.size} unique shop/therapist links on search page\n`);

  for (const [href, linkInfo] of uniqueSearchLinks) {
    const targetUrl = href.startsWith('/') ? `${BASE_URL}${href}` : href;
    console.log(`Testing: ${href}`);

    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);

      const pageTitle = await page.title();
      const pageContent = await page.content();

      const has404 = pageContent.includes('404') || pageContent.includes('Not Found');
      const hasError = pageContent.includes('Error') || pageContent.includes('エラー');

      if (has404) {
        console.log(`  ERROR: 404 Not Found`);
        const errorScreenshot = `/tmp/error-search-link.png`;
        await page.screenshot({ path: errorScreenshot, fullPage: true });
        issues.push({ page: 'search', link: href, error: '404 Not Found', screenshot: errorScreenshot });
      } else if (hasError) {
        console.log(`  WARNING: May contain errors`);
      } else {
        console.log(`  OK - ${pageTitle}`);
      }

      // Save screenshot
      if (!visitedUrls.has(href)) {
        const safeName = href.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 50);
        const screenshotPath = `/tmp/search-link-${safeName}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        visitedUrls.add(href);
      }
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
      issues.push({ page: 'search', link: href, error: error.message });
    }
  }

  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================\n');

  console.log(`Total pages visited: ${visitedUrls.size}`);
  console.log(`Total issues found: ${issues.length}`);

  if (issues.length > 0) {
    console.log('\nIssues:');
    issues.forEach((issue, i) => {
      console.log(`\n${i + 1}. ${issue.page} - ${issue.link || issue.url}`);
      console.log(`   Error: ${issue.error}`);
      if (issue.screenshot) {
        console.log(`   Screenshot: ${issue.screenshot}`);
      }
    });
  }

  console.log('\nScreenshots saved:');
  screenshots.forEach(s => {
    console.log(`  ${s.path}`);
  });

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);
