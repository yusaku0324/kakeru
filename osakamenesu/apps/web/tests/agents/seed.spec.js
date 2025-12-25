import { test, expect } from '@playwright/test'

/**
 * Seed test for Playwright Test Agents - Planner
 *
 * このテストはPlannerが探索を開始する起点となります。
 * 単純にサイトのホームページを開くだけのテストです。
 */
test.describe('Osakamenesu Site Seed', () => {
  test('Open homepage', async ({ page }) => {
    // 本番サイトまたはステージング環境のURL
    // 環境に応じて変更してください
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'https://osakamenesu.com'

    // ホームページを開く
    await page.goto(baseUrl)

    // ページが正しく読み込まれたことを確認
    await expect(page).toHaveTitle(/大阪メンエス/)

    // メインコンテンツが表示されていることを確認
    await expect(page.locator('main')).toBeVisible()
  })
})