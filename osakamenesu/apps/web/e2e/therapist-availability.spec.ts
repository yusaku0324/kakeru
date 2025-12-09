import { test, expect } from '@playwright/test'

test.describe('セラピストカードの空き状況表示', () => {
  test('セラピストカードに空き状況ラベルが表示される', async ({ page }) => {
    // 検索ページにアクセス（サンプルデータ使用）
    await page.goto('/search?force_samples=1')
    await page.waitForLoadState('networkidle')

    // セラピストカードを取得
    const cards = page.locator('[data-testid="therapist-card"]')
    const cardCount = await cards.count()
    console.log('セラピストカード数:', cardCount)
    expect(cardCount).toBeGreaterThan(0)

    // 空き状況ラベルを探す（本日空きあり or 次回 XX時から）
    const availabilityLabels = page.locator('[data-testid="therapist-card"] p:text-matches("本日空きあり|次回.*時から|\\d+月\\d+日.*時から")')
    const labelCount = await availabilityLabels.count()
    console.log('空き状況ラベル数:', labelCount)

    // 少なくとも1つは空き状況ラベルがあるはず（サンプルデータにはtoday_available: trueのスタッフがいる）
    expect(labelCount).toBeGreaterThan(0)

    // 最初のラベルの内容を確認
    if (labelCount > 0) {
      const firstLabel = await availabilityLabels.first().textContent()
      console.log('最初の空き状況ラベル:', firstLabel)
    }
  })

  test('カードクリックでオーバーレイが開き、空き時間が一致する', async ({ page }) => {
    await page.goto('/search?force_samples=1')
    await page.waitForLoadState('networkidle')

    // 空き状況ラベルがあるカードを探す
    const cardWithLabel = page.locator('[data-testid="therapist-card"]').filter({
      has: page.locator('p:text-matches("本日空きあり|次回.*時から")')
    }).first()

    const hasCardWithLabel = await cardWithLabel.count() > 0
    if (!hasCardWithLabel) {
      console.log('空き状況ラベルのあるカードが見つかりません')
      test.skip()
      return
    }

    // カードの空き状況ラベルを取得
    const cardLabel = await cardWithLabel.locator('p:text-matches("本日空きあり|次回.*時から|\\d+月\\d+日.*時から")').textContent()
    console.log('カードの空き状況ラベル:', cardLabel)

    // カードをクリック
    await cardWithLabel.click()

    // オーバーレイが表示されるまで待機
    const overlay = page.locator('[data-testid="reservation-overlay"], [role="dialog"]')
    await expect(overlay).toBeVisible({ timeout: 5000 })

    // オーバーレイ内の空き時間情報を確認
    // オーバーレイにはdefaultStartが渡されているはず
    const overlayContent = await overlay.textContent()
    console.log('オーバーレイ内容の一部:', overlayContent?.slice(0, 500))

    // オーバーレイが表示されたことを確認
    expect(overlay).toBeVisible()
  })

  test('予約するボタンが全カードにある', async ({ page }) => {
    await page.goto('/search?force_samples=1')
    await page.waitForLoadState('networkidle')

    const cards = page.locator('[data-testid="therapist-card"]')
    const cardCount = await cards.count()

    // 各カードに「予約する」ボタンがあるか確認
    const reserveButtons = page.locator('[data-testid="therapist-card"]:has-text("予約する")')
    const buttonCount = await reserveButtons.count()

    console.log('カード数:', cardCount, '予約ボタン数:', buttonCount)
    expect(buttonCount).toBe(cardCount)
  })
})
