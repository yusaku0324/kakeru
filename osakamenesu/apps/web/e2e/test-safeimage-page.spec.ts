import { test } from '@playwright/test'

test('verify SafeImage component behavior', async ({ page }) => {
  // Navigate to test page
  console.log('Navigating to test page...')
  await page.goto('http://localhost:3000/test-safeimage')

  // Wait for images to load
  await page.waitForTimeout(3000)

  // Take screenshot
  await page.screenshot({ path: 'test-safeimage-page.png', fullPage: true })

  // Get all images
  const images = await page.locator('img').all()
  console.log(`\nFound ${images.length} images on test page`)

  // Analyze each image
  for (let i = 0; i < images.length; i++) {
    const img = images[i]

    // Get parent container text to identify which test case
    const container = await img.locator('xpath=ancestor::div[contains(@class, "border")]').first()
    const label = await container.locator('h3').textContent()

    const src = await img.getAttribute('src')
    const imgData = await img.evaluate((el) => {
      const imgEl = el as HTMLImageElement
      return {
        naturalWidth: imgEl.naturalWidth,
        naturalHeight: imgEl.naturalHeight,
        currentSrc: imgEl.currentSrc,
        complete: imgEl.complete,
        loaded: imgEl.naturalWidth > 0
      }
    })

    console.log(`\n[${i}] ${label}`)
    console.log(`  src attribute: ${src}`)
    console.log(`  currentSrc: ${imgData.currentSrc}`)
    console.log(`  loaded: ${imgData.loaded} (${imgData.naturalWidth}x${imgData.naturalHeight})`)

    const isPlaceholder = src?.includes('placeholder') || imgData.currentSrc?.includes('placeholder')
    console.log(`  is placeholder: ${isPlaceholder}`)

    // Check if behavior is correct
    if (label?.includes('HTTPS') && isPlaceholder) {
      console.log(`  ⚠️  ERROR: HTTPS URL is showing placeholder!`)
    }
    if ((label?.includes('Null') || label?.includes('Empty')) && !isPlaceholder) {
      console.log(`  ⚠️  ERROR: Null/Empty URL is NOT showing placeholder!`)
    }
  }

  // Check for console errors
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  await page.waitForTimeout(1000)

  if (errors.length > 0) {
    console.log('\nConsole errors found:')
    errors.forEach(err => console.log(`  - ${err}`))
  }
})
