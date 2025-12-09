import { test, expect } from '@playwright/test'

const VERCEL_URL = 'https://web-2ojy9o4ms-yusaku0324s-projects.vercel.app'

test.describe('予約フローの確認', () => {
  test('検索 -> セラピスト詳細 -> 予約ページの流れ', async ({ page }) => {
    // 1. 検索ページに行く
    await page.goto(`${VERCEL_URL}/search`)
    await page.waitForLoadState('networkidle')

    console.log('検索ページ読み込み完了')

    // スクリーンショット
    await page.screenshot({ path: 'reserve-flow-1-search.png', fullPage: true })

    // セラピストカードを探す
    const therapistCards = page.locator('[data-testid="therapist-card"], .therapist-card, a[href*="/guest/therapists/"]')
    const cardCount = await therapistCards.count()
    console.log('セラピストカード数:', cardCount)

    if (cardCount > 0) {
      // 最初のセラピストカードをクリック
      const firstCard = therapistCards.first()
      const href = await firstCard.getAttribute('href')
      console.log('クリックするカードのhref:', href)

      await firstCard.click()
      await page.waitForLoadState('networkidle')

      console.log('現在のURL:', page.url())
      await page.screenshot({ path: 'reserve-flow-2-detail.png', fullPage: true })

      // 予約ボタンを探す
      const reserveButton = page.locator('text=この子を予約する, text=予約する, a[href*="/reserve"]')
      const reserveButtonExists = await reserveButton.count() > 0
      console.log('予約ボタンの存在:', reserveButtonExists)

      if (reserveButtonExists) {
        await reserveButton.first().click()
        await page.waitForLoadState('networkidle')

        console.log('予約ページURL:', page.url())
        await page.screenshot({ path: 'reserve-flow-3-reserve.png', fullPage: true })

        // 予約フォームの存在確認
        const dateInput = page.locator('input[type="date"]')
        const timeInput = page.locator('input[type="time"]')
        const submitButton = page.locator('button[type="submit"], text=予約する')

        console.log('日付入力:', await dateInput.count() > 0)
        console.log('時間入力:', await timeInput.count() > 0)
        console.log('送信ボタン:', await submitButton.count() > 0)

        expect(await dateInput.count()).toBeGreaterThan(0)
      }
    }
  })

  test('セラピスト詳細ページに直接アクセス', async ({ page }) => {
    // サンプルIDでセラピスト詳細ページにアクセス
    const testTherapistId = 'sample-therapist-001'
    await page.goto(`${VERCEL_URL}/guest/therapists/${testTherapistId}?name=テスト&shop_name=テスト店舗&shop_id=sample-shop-001`)
    await page.waitForLoadState('networkidle')

    console.log('セラピスト詳細ページ読み込み完了')
    await page.screenshot({ path: 'therapist-detail-direct.png', fullPage: true })

    // 予約ボタンを確認
    const reserveButton = page.locator('text=この子を予約する')
    const buttonExists = await reserveButton.count() > 0
    console.log('「この子を予約する」ボタン:', buttonExists)

    // 空き状況ボタンを確認
    const availabilityButton = page.locator('text=空き状況を見る')
    const availExists = await availabilityButton.count() > 0
    console.log('「空き状況を見る」ボタン:', availExists)

    expect(buttonExists).toBe(true)
    expect(availExists).toBe(true)
  })

  test('予約ページに直接アクセス', async ({ page }) => {
    const testTherapistId = 'sample-therapist-001'
    await page.goto(`${VERCEL_URL}/guest/therapists/${testTherapistId}/reserve?shop_id=sample-shop-001`)
    await page.waitForLoadState('networkidle')

    console.log('予約ページ読み込み完了')
    await page.screenshot({ path: 'reserve-page-direct.png', fullPage: true })

    // フォーム要素の確認
    const dateInput = page.locator('input[type="date"]')
    const timeInput = page.locator('input[type="time"]')
    const durationSelect = page.locator('select')
    const submitButton = page.locator('button[type="submit"]')

    console.log('日付入力:', await dateInput.count() > 0)
    console.log('時間入力:', await timeInput.count() > 0)
    console.log('コース時間選択:', await durationSelect.count() > 0)
    console.log('送信ボタン:', await submitButton.count() > 0)

    // 予約フォームの存在を確認
    expect(await dateInput.count()).toBeGreaterThan(0)
    expect(await timeInput.count()).toBeGreaterThan(0)
    expect(await submitButton.count()).toBeGreaterThan(0)

    // ページタイトルを確認
    const title = page.locator('h1')
    const titleText = await title.textContent()
    console.log('ページタイトル:', titleText)
    expect(titleText).toContain('予約フォーム')
  })
})
