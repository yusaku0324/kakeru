import { test, expect } from '@playwright/test'

test.describe('本番環境の店舗詳細でシフト時刻を確認', () => {
  test('店舗詳細ページでシフト時刻表示を確認', async ({ page }) => {
    console.log('=== 本番環境の店舗詳細ページ確認 ===')

    // 1. 検索ページにアクセス
    await page.goto('https://osakamenesu-web.vercel.app/search')
    await page.waitForLoadState('networkidle')

    // 検索ページのスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/prod-shop-01-search.png',
      fullPage: true
    })

    // 2. 店舗カードを探す（より具体的なセレクター）
    const shopCards = await page.locator('.grid > div').all()
    console.log(`グリッド内の要素数: ${shopCards.length}`)

    // 店舗カード内の詳細ボタンを探す
    const detailButtons = await page.locator('button:has-text("詳細"), a:has-text("詳細")').all()
    console.log(`詳細ボタンの数: ${detailButtons.length}`)

    if (detailButtons.length > 0) {
      console.log('詳細ボタンをクリックします')
      await detailButtons[0].click()
      await page.waitForLoadState('networkidle')
    } else {
      // 店舗カード自体をクリック
      if (shopCards.length > 0) {
        console.log('店舗カードをクリックします')
        await shopCards[0].click()
        await page.waitForLoadState('networkidle')
      }
    }

    // 3. 現在のURLを確認
    const currentUrl = page.url()
    console.log('現在のURL:', currentUrl)

    if (currentUrl.includes('/shops/')) {
      console.log('店舗詳細ページに移動しました')

      // 店舗詳細ページのスクリーンショット
      await page.screenshot({
        path: 'e2e/screenshots/prod-shop-02-detail.png',
        fullPage: true
      })

      // 4. セラピスト情報を探す
      const therapistSections = await page.locator('div:has(> img)').all()
      console.log(`セラピストセクション数: ${therapistSections.length}`)

      // 5. 時刻表示を探す（様々なパターン）
      const timePatterns = [
        'text=/\\d{1,2}:\\d{2}.*\\d{1,2}:\\d{2}/',
        'text=/\\d{1,2}時.*\\d{1,2}時/',
        '*:has-text("時")',
        '*:has-text(":")'
      ]

      let timeElements = []
      for (const pattern of timePatterns) {
        const elements = await page.locator(pattern).all()
        if (elements.length > 0) {
          console.log(`パターン "${pattern}" で ${elements.length} 個の要素が見つかりました`)
          timeElements = elements
          break
        }
      }

      console.log(`\n時刻表示が見つかった数: ${timeElements.length}`)

      // 時刻表示を分析
      for (let i = 0; i < Math.min(timeElements.length, 10); i++) {
        const text = await timeElements[i].textContent()
        console.log(`  時刻表示 ${i + 1}: ${text}`)

        // 問題のある表示をチェック
        if (text && text.includes('20:00')) {
          console.log('    ⚠️ 20:00の表示が見つかりました！')

          // 要素をハイライト
          await timeElements[i].evaluate(el => {
            el.style.border = '3px solid red'
            el.style.backgroundColor = 'yellow'
            el.style.padding = '5px'
          })

          // 周辺の情報も含めてスクリーンショット
          const box = await timeElements[i].boundingBox()
          if (box) {
            await page.screenshot({
              path: `e2e/screenshots/prod-shop-03-time-issue-${i}.png`,
              clip: {
                x: Math.max(0, box.x - 100),
                y: Math.max(0, box.y - 100),
                width: box.width + 200,
                height: box.height + 200
              }
            })
          }
        } else if (text && (text.includes('11:00') || text.includes('13:00') || text.includes('15:00'))) {
          console.log('    ✓ 正しい時刻表示のようです')

          // 正しい表示もハイライト（緑）
          await timeElements[i].evaluate(el => {
            el.style.border = '3px solid green'
            el.style.backgroundColor = 'lightgreen'
            el.style.padding = '5px'
          })
        }
      }

      // 全体のスクリーンショット（ハイライト付き）
      await page.screenshot({
        path: 'e2e/screenshots/prod-shop-04-highlighted.png',
        fullPage: true
      })

      // 6. セラピストのシフト情報を詳しく調査
      const therapistCards = await page.locator('[class*="therapist"], [class*="card"]').all()
      console.log(`\nセラピストカード数: ${therapistCards.length}`)

      for (let i = 0; i < Math.min(therapistCards.length, 3); i++) {
        const cardText = await therapistCards[i].textContent()
        console.log(`\nセラピストカード ${i + 1} の内容:`)
        console.log(cardText?.substring(0, 200) + '...')

        // カード内の時刻情報を探す
        const cardTimeElements = await therapistCards[i].locator('*:has-text(":")').all()
        for (const timeEl of cardTimeElements) {
          const timeText = await timeEl.textContent()
          if (timeText && timeText.match(/\d{1,2}:\d{2}/)) {
            console.log(`  -> 時刻: ${timeText}`)
          }
        }
      }
    } else {
      console.log('店舗詳細ページに移動できませんでした')

      // 現在のページのスクリーンショット
      await page.screenshot({
        path: 'e2e/screenshots/prod-shop-05-current-page.png',
        fullPage: true
      })
    }

    console.log('\nテスト完了')
  })
})
