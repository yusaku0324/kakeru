import { test } from '@playwright/test'

test.describe('Debug Production Dashboard Images', () => {
  test('check debug page to verify SafeImage component', async ({ page }) => {
    // Collect all console logs
    const consoleLogs: string[] = []
    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
    })

    // Monitor network requests
    const imageRequests: { url: string; status: number; headers: any }[] = []
    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('.jpg') || url.includes('.png') || url.includes('.svg') ||
          url.includes('.r2.dev') || url.includes('/_next/image') || url.includes('placeholder')) {
        imageRequests.push({
          url,
          status: response.status(),
          headers: await response.headers()
        })
      }
    })

    // Navigate to the login page
    const loginUrl = 'https://osakamenesu-web.vercel.app/dashboard/52c92fb6-bab6-460e-9312-61a16ab98941/login'
    console.log('Navigating to login:', loginUrl)
    await page.goto(loginUrl, { waitUntil: 'networkidle' })

    // Wait for page to load and click test login button
    await page.waitForTimeout(2000)

    // Try to find and click test login button
    const testLoginButton = page.locator('button:has-text("テストログイン"), button:has-text("Test Login"), button:has-text("LINEでログイン")')

    if (await testLoginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Found test login button, clicking...')
      await testLoginButton.click()

      // Wait for navigation to dashboard
      await page.waitForURL('**/profile', { timeout: 10000 }).catch(() => {
        console.log('Navigation to profile page failed')
      })
    } else {
      console.log('Test login button not found')
    }

    // Wait for the page to fully load
    await page.waitForTimeout(3000)

    // Take a screenshot
    await page.screenshot({ path: 'production-dashboard.png', fullPage: true })

    // Analyze all images on the page
    const images = await page.locator('img').all()
    console.log(`\n=== Found ${images.length} images ===`)

    const imageData = []
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      const src = await img.getAttribute('src')
      const alt = await img.getAttribute('alt')
      const className = await img.getAttribute('class')

      // Get computed information
      const imgInfo = await img.evaluate((el) => {
        const imgEl = el as HTMLImageElement
        return {
          naturalWidth: imgEl.naturalWidth,
          naturalHeight: imgEl.naturalHeight,
          currentSrc: imgEl.currentSrc,
          complete: imgEl.complete,
          loading: imgEl.loading,
          // Check parent SafeImage wrapper
          parentClasses: imgEl.parentElement?.className || '',
          // Get computed styles
          display: window.getComputedStyle(imgEl).display,
          visibility: window.getComputedStyle(imgEl).visibility
        }
      })

      imageData.push({
        index: i,
        src,
        alt,
        className,
        ...imgInfo,
        isPlaceholder: src?.includes('placeholder') || imgInfo.currentSrc?.includes('placeholder')
      })
    }

    // Print detailed image analysis
    console.log('\n=== Image Analysis ===')
    imageData.forEach(data => {
      console.log(`\n[Image ${data.index}]`)
      console.log(`  src: ${data.src}`)
      console.log(`  currentSrc: ${data.currentSrc}`)
      console.log(`  alt: ${data.alt}`)
      console.log(`  loaded: ${data.naturalWidth > 0}`)
      console.log(`  dimensions: ${data.naturalWidth}x${data.naturalHeight}`)
      console.log(`  is placeholder: ${data.isPlaceholder}`)
      console.log(`  classes: ${data.className}`)
      console.log(`  parent classes: ${data.parentClasses}`)
    })

    // Check SafeImage component behavior
    const safeImageCode = await page.evaluate(() => {
      // Try to find SafeImage component code
      const scripts = Array.from(document.querySelectorAll('script'))
      for (const script of scripts) {
        if (script.innerHTML.includes('sanitizeSrc')) {
          return script.innerHTML.substring(
            script.innerHTML.indexOf('sanitizeSrc') - 100,
            script.innerHTML.indexOf('sanitizeSrc') + 500
          )
        }
      }
      return 'SafeImage code not found in inline scripts'
    })

    console.log('\n=== SafeImage Code Fragment ===')
    console.log(safeImageCode)

    // Print console logs that might be relevant
    const relevantLogs = consoleLogs.filter(log =>
      log.includes('SafeImage') || log.includes('image') || log.includes('Photo') || log.includes('error')
    )
    if (relevantLogs.length > 0) {
      console.log('\n=== Relevant Console Logs ===')
      relevantLogs.forEach(log => console.log(log))
    }

    // Print image requests
    console.log('\n=== Image Network Requests ===')
    imageRequests.forEach(req => {
      console.log(`${req.status} ${req.url}`)
      if (req.status !== 200) {
        console.log(`  Headers:`, req.headers)
      }
    })

    // Execute custom debugging in browser context
    const debugInfo = await page.evaluate(() => {
      // Check Next.js build ID
      const buildId = (window as any).__NEXT_DATA__?.buildId || 'unknown'

      // Check if there are any error boundaries
      const errorElements = document.querySelectorAll('[data-nextjs-error]')

      return {
        buildId,
        hasErrors: errorElements.length > 0,
        errorCount: errorElements.length,
        pageProps: (window as any).__NEXT_DATA__?.props?.pageProps || {}
      }
    })

    console.log('\n=== Debug Info ===')
    console.log('Build ID:', debugInfo.buildId)
    console.log('Has Errors:', debugInfo.hasErrors)
    console.log('Page Props:', JSON.stringify(debugInfo.pageProps, null, 2))

    // Summary
    const placeholderCount = imageData.filter(img => img.isPlaceholder).length
    const loadedCount = imageData.filter(img => img.naturalWidth > 0).length

    console.log('\n=== SUMMARY ===')
    console.log(`Total images: ${images.length}`)
    console.log(`Loaded images: ${loadedCount}`)
    console.log(`Placeholder images: ${placeholderCount}`)
    console.log(`Failed to load: ${images.length - loadedCount}`)
  })
})
