import { test, expect } from '@playwright/test'

test.describe('シフト時刻登録の確認', () => {
  test('11:00-13:00のシフトが正しく表示される', async ({ page }) => {
    // ダッシュボードにアクセス
    await page.goto('http://localhost:3000/dashboard/login')

    // ログイン
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // ログイン後のリダイレクトを待つ
    await page.waitForURL(/dashboard\/shops/)

    // 店舗選択（最初の店舗をクリック）
    await page.click('.grid a:first-child')

    // シフト管理ページへ移動
    await page.click('text=シフト管理')
    await page.waitForURL(/shifts/)

    // 新規シフト作成ボタンをクリック
    await page.click('button:has-text("新規作成")')

    // モーダルが開くのを待つ
    await page.waitForSelector('text=シフトを追加')

    // セラピストを選択（最初のセラピストを選択）
    await page.click('select[required]')
    await page.selectOption('select[required]', { index: 1 })

    // 日付を今日に設定
    const today = new Date().toISOString().split('T')[0]
    await page.fill('input[type="date"]', today)

    // 時刻を設定（11:00-13:00）
    await page.fill('input[type="time"]:first-of-type', '11:00')
    await page.fill('input[type="time"]:last-of-type', '13:00')

    // スクリーンショットを撮る（入力後）
    await page.screenshot({
      path: 'e2e/screenshots/shift-input-11-13.png',
      fullPage: true
    })

    // 保存
    await page.click('button:has-text("保存")')

    // 保存完了を待つ
    await page.waitForTimeout(2000)

    // シフトカードが表示されるのを待つ
    await page.waitForSelector('.grid')

    // 表示されたシフトの時刻を確認
    const shiftTimeText = await page.textContent('text=/11:00.*13:00/')
    expect(shiftTimeText).toContain('11:00')
    expect(shiftTimeText).toContain('13:00')

    // 表示後のスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/shift-displayed-11-13.png',
      fullPage: true
    })

    // 編集ボタンをクリック
    await page.click('button[aria-label*="編集"]')

    // 編集フォームの時刻を確認
    const startTimeValue = await page.inputValue('input[type="time"]:first-of-type')
    const endTimeValue = await page.inputValue('input[type="time"]:last-of-type')

    expect(startTimeValue).toBe('11:00')
    expect(endTimeValue).toBe('13:00')

    // 編集フォームのスクリーンショット
    await page.screenshot({
      path: 'e2e/screenshots/shift-edit-form-11-13.png',
      fullPage: true
    })

    console.log('✓ 11:00-13:00のシフトが正しく登録・表示されました')
    console.log(`  開始時刻: ${startTimeValue}`)
    console.log(`  終了時刻: ${endTimeValue}`)
  })
})
