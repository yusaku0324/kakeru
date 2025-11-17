import { test, expect, Page } from '@playwright/test'

const visualEnabled = process.env.E2E_ENABLE_VISUAL === '1'

test.describe('Visual regression (opt-in)', () => {
  test.skip(!visualEnabled, 'Set E2E_ENABLE_VISUAL=1 to run visual regression tests.')

  test('home page matches baseline screenshot', async ({ page }) => {
    await captureStableScreenshot(page, '/')
    await expect(page).toHaveScreenshot('home-page.png', { fullPage: true, maxDiffPixelRatio: 0.02 })
  })

  test('search page matches baseline screenshot', async ({ page }) => {
    await captureStableScreenshot(page, '/search')
    await expect(page).toHaveScreenshot('search-page.png', { fullPage: true, maxDiffPixelRatio: 0.02 })
  })
})

async function captureStableScreenshot(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
      }
    `,
  })
  await page.waitForTimeout(500)
}
