import { test, expect } from '@playwright/test'

test.describe('シフト時刻表示の確認（テストログイン版）', () => {
  test('11:00-13:00のシフトが正しく表示されるか確認', async ({ page }) => {
    // ダッシュボードログインページへアクセス
    await page.goto('http://localhost:3000/dashboard/login')

    // テスト用メールアドレスを入力
    await page.fill('input[type="email"]', 'playwright-dashboard@example.com')

    // ログインボタンをクリック
    await page.click('button:has-text("ログインリンクを送信")')

    // メッセージが表示されるのを待つ
    await page.waitForSelector('text=/メール.*送信/i')

    // テスト環境の場合、直接ダッシュボードにアクセス（マジックリンクをスキップ）
    await page.goto('http://localhost:3000/dashboard/shops')

    // ログイン後のダッシュボードが表示されるまで待つ
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 現在のURLを確認
    const currentUrl = page.url()
    console.log('現在のURL:', currentUrl)

    // ダッシュボードのスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/dashboard-after-login.png',
      fullPage: true
    })

    // 店舗カードをクリック（最初の店舗）
    const shopCard = await page.locator('.grid a').first()
    if (await shopCard.isVisible()) {
      await shopCard.click()

      // 店舗詳細ページが読み込まれるまで待つ
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // シフト管理リンクを探してクリック
      const shiftsLink = await page.locator('text=/シフト管理/').first()
      if (await shiftsLink.isVisible()) {
        await shiftsLink.click()

        // シフト管理ページが読み込まれるまで待つ
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)

        // シフト管理ページのスクリーンショット
        await page.screenshot({
          path: 'e2e/screenshots/shifts-management-page.png',
          fullPage: true
        })

        // 新規作成ボタンを探してクリック
        const newShiftButton = await page.locator('button:has-text("新規作成")')
        if (await newShiftButton.isVisible()) {
          await newShiftButton.click()

          // モーダルが開くのを待つ
          await page.waitForSelector('text=/シフトを追加/')
          await page.waitForTimeout(1000)

          // 新規作成フォームのスクリーンショット
          await page.screenshot({
            path: 'e2e/screenshots/new-shift-form.png',
            fullPage: true
          })

          // セラピストを選択（selectの最初のオプション以外）
          const therapistSelect = await page.locator('select').first()
          const options = await therapistSelect.locator('option').all()
          if (options.length > 1) {
            const value = await options[1].getAttribute('value')
            if (value) {
              await therapistSelect.selectOption(value)
            }
          }

          // 日付を今日に設定
          const today = new Date().toISOString().split('T')[0]
          await page.fill('input[type="date"]', today)

          // 時刻を11:00-13:00に設定
          await page.fill('input[type="time"]:first-of-type', '11:00')
          await page.fill('input[type="time"]:last-of-type', '13:00')

          // 入力後のスクリーンショット
          await page.screenshot({
            path: 'e2e/screenshots/shift-form-filled-11-13.png',
            fullPage: true
          })

          // 保存ボタンをクリック
          await page.click('button:has-text("保存")')

          // 保存完了を待つ
          await page.waitForTimeout(3000)

          // シフト一覧が更新されたスクリーンショット
          await page.screenshot({
            path: 'e2e/screenshots/shifts-list-after-save.png',
            fullPage: true
          })

          // 追加されたシフトの時刻表示を確認
          const shiftCards = await page.locator('.grid > div').all()
          console.log(`シフトカード数: ${shiftCards.length}`)

          // 最新のシフト（通常は最初のカード）の時刻を確認
          if (shiftCards.length > 0) {
            const timeText = await shiftCards[0].locator('text=/\\d{1,2}:\\d{2}.*\\d{1,2}:\\d{2}/').textContent()
            console.log(`表示されている時刻: ${timeText}`)

            if (timeText && timeText.includes('11:00') && timeText.includes('13:00')) {
              console.log('✅ 時刻が正しく表示されています！')
            } else {
              console.log('❌ 時刻表示に問題があります')
            }

            // 編集ボタンをクリック
            const editButton = await shiftCards[0].locator('button[aria-label*="編集"]')
            if (await editButton.isVisible()) {
              await editButton.click()

              // 編集フォームが開くのを待つ
              await page.waitForTimeout(1000)

              // 編集フォームの時刻を確認
              const startTimeInput = await page.locator('input[type="time"]:first-of-type')
              const endTimeInput = await page.locator('input[type="time"]:last-of-type')

              const startValue = await startTimeInput.inputValue()
              const endValue = await endTimeInput.inputValue()

              console.log(`編集フォームの開始時刻: ${startValue}`)
              console.log(`編集フォームの終了時刻: ${endValue}`)

              // 編集フォームのスクリーンショット
              await page.screenshot({
                path: 'e2e/screenshots/edit-form-time-check.png',
                fullPage: true
              })

              if (startValue === '11:00' && endValue === '13:00') {
                console.log('✅ 編集フォームでも時刻が正しく表示されています！')
              } else {
                console.log('❌ 編集フォームの時刻表示に問題があります')
              }
            }
          }
        }
      }
    }
  })
})
