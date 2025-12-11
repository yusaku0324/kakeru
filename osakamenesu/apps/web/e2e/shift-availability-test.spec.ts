import { test } from '@playwright/test'

test.describe('シフト作成と空き枠プレビュー確認', () => {
  test('複数セラピストのシフト作成と空き枠反映を確認', async ({ page }) => {
    console.log('=== シフト作成と空き枠プレビュー確認テスト ===')

    // 1. ダッシュボードにアクセス（ポート8001のAPIを使用）
    await page.goto('http://localhost:3000/dashboard/shops')
    await page.waitForLoadState('networkidle')

    // ダッシュボードのスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/shift-test-01-dashboard.png',
      fullPage: true
    })

    // 最初の店舗を選択（存在する場合）
    const shopCards = await page.locator('.grid a[href*="/dashboard/shops/"]').all()
    console.log(`見つかった店舗数: ${shopCards.length}`)

    if (shopCards.length === 0) {
      console.log('店舗が見つかりません。テストを終了します。')
      return
    }

    // 最初の店舗をクリック
    await shopCards[0].click()
    await page.waitForLoadState('networkidle')

    // 店舗詳細のスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/shift-test-02-shop-detail.png',
      fullPage: true
    })

    // 空き枠プレビューを探す
    const availabilityPreview = await page.locator('text=/希望日時を選択/').first()
    if (await availabilityPreview.isVisible()) {
      console.log('✓ 空き枠プレビューが見つかりました')

      // 空き枠プレビューのスクリーンショット
      const previewBox = await availabilityPreview.locator('..').locator('..').boundingBox()
      if (previewBox) {
        await page.screenshot({
          path: 'e2e/screenshots/shift-test-03-availability-preview.png',
          clip: {
            x: Math.max(0, previewBox.x - 20),
            y: Math.max(0, previewBox.y - 20),
            width: previewBox.width + 40,
            height: previewBox.height + 40
          }
        })
      }

      // 時間帯の表示を確認
      const timeSlots = await page.locator('text=/\\d{1,2}:\\d{2}/').all()
      console.log(`\n時間枠の数: ${timeSlots.length}`)

      // 各時間枠の状態を確認
      const availableSlots = []
      const unavailableSlots = []

      for (let i = 0; i < Math.min(timeSlots.length, 10); i++) {
        const slot = timeSlots[i]
        const text = await slot.textContent()
        const parent = await slot.locator('..')

        // ×マークがあるか確認
        const hasX = await parent.locator('text=×').count() > 0

        if (hasX) {
          unavailableSlots.push(text)
        } else {
          availableSlots.push(text)
        }
      }

      console.log('\n利用不可能な時間帯:')
      unavailableSlots.forEach(slot => console.log(`  × ${slot}`))

      console.log('\n利用可能な時間帯:')
      availableSlots.forEach(slot => console.log(`  ○ ${slot}`))

      // 問題の診断
      if (availableSlots.length === 0 && unavailableSlots.length > 0) {
        console.log('\n⚠️ すべての時間帯が利用不可になっています！')
        console.log('シフトが作成されているにも関わらず、空き枠に反映されていない可能性があります。')
      } else if (availableSlots.length > 0) {
        console.log('\n✓ 利用可能な時間帯が正しく表示されています')
      }
    } else {
      console.log('❌ 空き枠プレビューが見つかりません')
    }

    // シフト管理画面に移動
    const shiftsLink = await page.locator('a:has-text("シフト管理")').first()
    if (await shiftsLink.isVisible()) {
      await shiftsLink.click()
      await page.waitForLoadState('networkidle')

      // シフト管理画面のスクリーンショット
      await page.screenshot({
        path: 'e2e/screenshots/shift-test-04-shifts-page.png',
        fullPage: true
      })

      // 既存のシフトを確認
      const existingShifts = await page.locator('text=/\\d{1,2}:\\d{2}.*-.*\\d{1,2}:\\d{2}/').all()
      console.log(`\n既存のシフト数: ${existingShifts.length}`)

      for (let i = 0; i < Math.min(existingShifts.length, 5); i++) {
        const shiftText = await existingShifts[i].textContent()
        console.log(`  シフト ${i + 1}: ${shiftText}`)

        // 20:00以降の時刻をチェック
        if (shiftText && shiftText.match(/2[0-3]:\d{2}/)) {
          console.log('    ⚠️ 20時以降の表示があります - タイムゾーン問題の可能性')
        }
      }

      // 新しいシフトを作成してみる
      const addButton = await page.locator('button:has-text("追加"), button:has-text("新規作成")').first()
      if (await addButton.isVisible()) {
        console.log('\n新しいシフトを作成します...')
        await addButton.click()
        await page.waitForTimeout(1000)

        // フォームのスクリーンショット
        await page.screenshot({
          path: 'e2e/screenshots/shift-test-05-new-shift-form.png',
          fullPage: true
        })

        console.log('シフト作成フォームが開きました')
      }
    }

    console.log('\nテスト完了')
  })
})
