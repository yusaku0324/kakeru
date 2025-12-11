import { test, expect } from '@playwright/test'

test.describe('Search Multiple Slots', () => {
  test('should fetch all available slots when clicking therapist card', async ({ page }) => {
    // 検索ページに移動（SSS で検索）
    await page.goto('/search?q=SSS')

    // ページが完全に読み込まれるのを待つ
    await page.waitForLoadState('networkidle')

    // セラピストカードの表示を待つ
    const therapistCard = await page.locator('[data-testid="therapist-card"]').first()
    await expect(therapistCard).toBeVisible({ timeout: 10000 })

    // 「ももな」のカードを確認
    const momonaCard = await page.locator('text=ももな').first()
    await expect(momonaCard).toBeVisible()

    // availability_slots API へのリクエストをインターセプト
    const availabilitySlotsPromise = page.waitForRequest(req =>
      req.url().includes('/api/guest/therapists/') &&
      req.url().includes('/availability_slots')
    )

    // セラピストカードをクリック
    await momonaCard.click()

    // API リクエストが送信されることを確認
    const request = await availabilitySlotsPromise
    console.log('Availability API called:', request.url())

    // レスポンスが成功することを確認
    const response = await request.response()
    expect(response?.status()).toBe(200)

    // オーバーレイが開くことを確認
    await page.waitForSelector('[data-testid="reservation-overlay"]', { timeout: 5000 })

    // 複数の予約可能スロットが表示されることを確認
    // （実際のUIに応じて調整が必要）
    const slots = await page.locator('[data-testid="time-slot"]').count()
    console.log(`Found ${slots} time slots`)
    expect(slots).toBeGreaterThan(1)
  })
})
