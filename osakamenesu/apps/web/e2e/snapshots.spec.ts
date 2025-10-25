import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

test.describe('snapshots', () => {
  test.describe.configure({ mode: 'serial' })

  test('home, search, profile screenshots', async ({ page, baseURL }) => {
    const outDir = path.resolve('e2e-output')
    fs.mkdirSync(outDir, { recursive: true })

    // Home
    const homeResponse = await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' })
    expect.soft(homeResponse?.ok(), 'ホームページのレスポンスが成功すること').toBeTruthy()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('link', { name: '大阪メンエス.com' })).toBeVisible({ timeout: 15000 })
    await page.screenshot({ path: path.join(outDir, 'home.png'), fullPage: true })

    // Search
    const searchUrl = `${baseURL}/search?today=true&price_min=10000&price_max=30000&sort=price_min%3Adesc&page=1&force_samples=1`
    await page.goto(searchUrl)
    await expect(page.getByText('店舗検索結果')).toBeVisible()
    await page.screenshot({ path: path.join(outDir, 'search.png'), fullPage: true })

    // Open first non-PR profile card
    const firstProfileCard = page.locator('a[href^="/profiles/"]').first()
    await expect(firstProfileCard).toBeVisible()
    await firstProfileCard.click()
    await expect(page).toHaveURL(/\/profiles\//)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toBeVisible()
    await page.screenshot({ path: path.join(outDir, 'profile.png'), fullPage: true })
  })
})
