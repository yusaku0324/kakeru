import { test } from '@playwright/test'

test.describe('Test SafeImage Component Locally', () => {
  test('verify SafeImage behavior with various URLs', async ({ page }) => {
    // Create test page with SafeImage components
    await page.goto('http://localhost:3000')

    // Inject test code to verify SafeImage behavior
    const result = await page.evaluate(() => {
      // Create test container
      const container = document.createElement('div')
      container.id = 'test-container'
      container.style.position = 'fixed'
      container.style.top = '0'
      container.style.left = '0'
      container.style.background = 'white'
      container.style.zIndex = '9999'
      container.style.padding = '20px'
      container.style.border = '2px solid red'
      document.body.appendChild(container)

      // Test URLs
      const testUrls = [
        'https://i.pravatar.cc/300',
        'https://pub-f573ead3e2054ef0a2e2fcc4af0e2203.r2.dev/test.jpg',
        'https://example.com/test.jpg',
        '/images/placeholder-card.svg'
      ]

      const results: any[] = []

      // Create images and test
      testUrls.forEach((url, index) => {
        const img = document.createElement('img')
        img.src = url
        img.style.width = '100px'
        img.style.height = '100px'
        img.style.margin = '5px'
        img.style.border = '1px solid #ccc'

        container.appendChild(img)

        // Check after brief delay
        setTimeout(() => {
          results.push({
            url,
            loaded: img.naturalWidth > 0,
            currentSrc: img.currentSrc,
            width: img.naturalWidth,
            height: img.naturalHeight
          })
        }, 1000)
      })

      return new Promise(resolve => {
        setTimeout(() => {
          resolve(results)
        }, 2000)
      })
    })

    console.log('Image test results:', result)

    // Check SafeImage component code
    const safeImageCheck = await page.evaluate(() => {
      // Try to find and test SafeImage function
      const testUrl = 'https://example.com/test.jpg'
      const testUrlHttp = 'http://example.com/test.jpg'

      // Check if the component exists
      const scripts = Array.from(document.querySelectorAll('script'))
      let hasSafeImage = false
      let sanitizeSrcCode = ''

      for (const script of scripts) {
        if (script.innerHTML && script.innerHTML.includes('sanitizeSrc')) {
          hasSafeImage = true
          const match = script.innerHTML.match(/function\s+sanitizeSrc[^{]*{[^}]+}/)
          if (match) {
            sanitizeSrcCode = match[0]
          }
          break
        }
      }

      return {
        hasSafeImage,
        sanitizeSrcCode,
        timestamp: new Date().toISOString()
      }
    })

    console.log('\n=== SafeImage Component Check ===')
    console.log('Has SafeImage:', safeImageCheck.hasSafeImage)
    console.log('Code fragment:', safeImageCheck.sanitizeSrcCode)

    // Navigate to debug page if it exists
    const debugPageResponse = await page.goto('http://localhost:3000/debug-image', {
      waitUntil: 'networkidle',
      timeout: 10000
    }).catch(e => null)

    if (debugPageResponse && debugPageResponse.ok()) {
      console.log('\n=== Debug page found ===')
      await page.waitForTimeout(2000)

      const debugImages = await page.locator('img').all()
      console.log(`Found ${debugImages.length} images on debug page`)

      for (let i = 0; i < Math.min(debugImages.length, 5); i++) {
        const img = debugImages[i]
        const src = await img.getAttribute('src')
        const info = await img.evaluate((el) => ({
          loaded: (el as HTMLImageElement).naturalWidth > 0,
          width: (el as HTMLImageElement).naturalWidth,
          height: (el as HTMLImageElement).naturalHeight,
          currentSrc: (el as HTMLImageElement).currentSrc
        }))

        console.log(`Image ${i}: ${src}`)
        console.log(`  Loaded: ${info.loaded}, Size: ${info.width}x${info.height}`)
        if (src !== info.currentSrc) {
          console.log(`  Current src: ${info.currentSrc}`)
        }
      }
    } else {
      console.log('Debug page not found')
    }

    // Take screenshot
    await page.screenshot({ path: 'local-safeimage-test.png', fullPage: false })
  })
})
