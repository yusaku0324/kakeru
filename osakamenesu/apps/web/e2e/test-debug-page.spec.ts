import { test } from '@playwright/test'

test('check local debug page', async ({ page }) => {
  // デバッグページに直接アクセス
  console.log('Navigating to debug page...')
  await page.goto('http://localhost:3000/debug-image')

  // ページが読み込まれるのを待つ
  await page.waitForTimeout(2000)

  // スクリーンショットを撮る
  await page.screenshot({ path: 'debug-page-local.png', fullPage: true })

  // ページのタイトルを確認
  const title = await page.title()
  console.log('Page title:', title)

  // ページの内容を確認
  const pageText = await page.textContent('body')
  console.log('Page contains debug page?', pageText?.includes('SafeImage Debug Page'))

  // 画像を探す
  const images = await page.locator('img').all()
  console.log(`\nFound ${images.length} images`)

  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    const src = await img.getAttribute('src')
    const alt = await img.getAttribute('alt')

    const info = await img.evaluate((el) => {
      const imgEl = el as HTMLImageElement
      return {
        loaded: imgEl.naturalWidth > 0,
        width: imgEl.naturalWidth,
        height: imgEl.naturalHeight,
        currentSrc: imgEl.currentSrc
      }
    })

    console.log(`\nImage ${i}:`)
    console.log('  src:', src)
    console.log('  alt:', alt)
    console.log('  loaded:', info.loaded)
    console.log('  dimensions:', `${info.width}x${info.height}`)
    if (src !== info.currentSrc && info.currentSrc) {
      console.log('  currentSrc:', info.currentSrc)
    }

    // Check if it's a placeholder
    const isPlaceholder = src?.includes('placeholder') || info.currentSrc?.includes('placeholder')
    console.log('  is placeholder:', isPlaceholder)
  }

  // Check SafeImage behavior by testing with custom URL
  const customUrlInput = page.locator('input[type="text"]')
  if (await customUrlInput.isVisible()) {
    console.log('\nTesting custom URL...')
    await customUrlInput.fill('https://pub-f573ead3e2054ef0a2e2fcc4af0e2203.r2.dev/shops/test.jpg')
    await page.waitForTimeout(1000)

    // Check if new image appeared
    const newImages = await page.locator('img').all()
    if (newImages.length > images.length) {
      const lastImg = newImages[newImages.length - 1]
      const src = await lastImg.getAttribute('src')
      console.log('Custom URL image src:', src)
    }
  }
})
