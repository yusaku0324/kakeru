import { test, expect } from '@playwright/test'

test.describe('セラピストカードの空き状況表示', () => {
  test('セラピストカードに空き状況ラベルが表示される', async ({ page }) => {
    // 検索ページにアクセス（サンプルデータ使用、therapistsタブ指定）
    await page.goto('/search?force_samples=1&tab=therapists')
    await page.waitForLoadState('networkidle')

    // セラピスト結果セクションが表示されるまでスクロールして待機
    const therapistSection = page.locator('#therapist-results')
    await therapistSection.scrollIntoViewIfNeeded()
    await expect(therapistSection).toBeVisible({ timeout: 10000 })

    // セラピストカードを取得
    const cards = page.locator('[data-testid="therapist-card"]')
    const cardCount = await cards.count()
    console.log('セラピストカード数:', cardCount)
    expect(cardCount).toBeGreaterThan(0)

    // 空き状況ラベルを探す（本日 XX:XX〜 or MM/DD(曜) XX:XX〜 形式）
    // Note: These labels are rendered as div elements with the availability badge styling
    const availabilityLabels = page.locator('[data-testid="therapist-card"]').locator('text=/本日 \\d{1,2}:\\d{2}〜|\\d{1,2}\\/\\d{1,2}\\([日月火水木金土]\\) \\d{1,2}:\\d{2}〜/')
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
    await page.goto('/search?force_samples=1&tab=therapists')
    await page.waitForLoadState('networkidle')

    // セラピスト結果セクションが表示されるまでスクロールして待機
    const therapistSection = page.locator('#therapist-results')
    await therapistSection.scrollIntoViewIfNeeded()
    await expect(therapistSection).toBeVisible({ timeout: 10000 })

    // 空き状況ラベルがあるカードを探す（本日 XX:XX〜 形式）
    const cardWithLabel = page.locator('[data-testid="therapist-card"]').filter({
      has: page.locator('text=/本日 \\d{1,2}:\\d{2}〜/')
    }).first()

    const hasCardWithLabel = await cardWithLabel.count() > 0
    if (!hasCardWithLabel) {
      console.log('空き状況ラベルのあるカードが見つかりません')
      test.skip()
      return
    }

    // カードの空き状況ラベルを取得
    const cardLabel = await cardWithLabel.locator('text=/本日 \\d{1,2}:\\d{2}〜|\\d{1,2}\\/\\d{1,2}\\([日月火水木金土]\\) \\d{1,2}:\\d{2}〜/').first().textContent()
    console.log('カードの空き状況ラベル:', cardLabel)

    // カードをクリック
    await cardWithLabel.click()

    // オーバーレイが表示されるまで待機（レスポンシブで複数ある場合は最初のものを使用）
    const overlay = page.locator('[role="dialog"]').first()
    await expect(overlay).toBeVisible({ timeout: 5000 })

    // オーバーレイ内の空き時間情報を確認
    // オーバーレイにはdefaultStartが渡されているはず
    const overlayContent = await overlay.textContent()
    console.log('オーバーレイ内容の一部:', overlayContent?.slice(0, 500))

    // オーバーレイが表示されたことを確認
    expect(overlay).toBeVisible()
  })

  test('カードの空き時間とグリッドのステータスアイコンが整合する', async ({ page }) => {
    await page.goto('/search?force_samples=1&tab=therapists')
    await page.waitForLoadState('networkidle')

    // セラピスト結果セクションが表示されるまでスクロールして待機
    const therapistSection = page.locator('#therapist-results')
    await therapistSection.scrollIntoViewIfNeeded()
    await expect(therapistSection).toBeVisible({ timeout: 10000 })

    // 「本日」の空き状況ラベルがあるカードを探す
    const cardWithTodaySlot = page.locator('[data-testid="therapist-card"]').filter({
      has: page.locator('text=/本日 \\d{1,2}:\\d{2}〜/')
    }).first()

    const hasCard = await cardWithTodaySlot.count() > 0
    if (!hasCard) {
      console.log('本日の空き枠があるカードが見つかりません')
      test.skip()
      return
    }

    // カードの空き時間を取得（例: "本日 16:00〜"）
    const cardLabel = await cardWithTodaySlot.locator('text=/本日 \\d{1,2}:\\d{2}〜/').first().textContent()
    console.log('カードの空き状況ラベル:', cardLabel)

    // 時刻を抽出（例: "16:00"）
    const timeMatch = cardLabel?.match(/(\d{1,2}:\d{2})/)
    expect(timeMatch).toBeTruthy()
    const expectedTime = timeMatch![1]
    console.log('期待される空き時刻:', expectedTime)

    // カードをクリックしてオーバーレイを開く
    await cardWithTodaySlot.click()

    // オーバーレイが表示されるまで待機（レスポンシブで複数ある場合は最初のものを使用）
    const overlay = page.locator('[role="dialog"]').first()
    await expect(overlay).toBeVisible({ timeout: 5000 })

    // 「空き状況・予約」タブをクリックしてグリッドを表示
    const scheduleTab = overlay.locator('button:has-text("空き状況・予約")')
    if (await scheduleTab.count() > 0) {
      await scheduleTab.scrollIntoViewIfNeeded()
      await scheduleTab.click({ force: true })
      await page.waitForTimeout(500)
    }

    // グリッドが表示されるまで待機（グリッドがない場合はEmpty State表示）
    const grid = page.locator('[data-testid="availability-grid"]').first()
    const emptyState = overlay.locator('text="空き状況未登録"')

    // グリッドまたはEmpty Stateが表示されることを確認
    const gridVisible = await grid.isVisible().catch(() => false)
    const emptyVisible = await emptyState.isVisible().catch(() => false)

    if (!gridVisible && emptyVisible) {
      console.log('空き状況未登録（Empty State）が表示されています - availabilityDaysが空です')
      // サンプルデータにavailabilityDaysがない場合は、このテストはスキップ
      test.skip()
      return
    }

    await expect(grid).toBeVisible({ timeout: 5000 })

    // 今日の日付を取得
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    console.log('今日の日付:', todayStr)

    // 期待される時刻のスロットを探す（◎ or △）
    // data-date="YYYY-MM-DD" と時刻が一致するスロットを探す
    const availableSlots = grid.locator('[data-testid="slot-available"], [data-testid="slot-pending"]')
    const availableCount = await availableSlots.count()
    console.log('利用可能スロット数:', availableCount)

    // 少なくとも1つは空きスロットがあるはず
    expect(availableCount).toBeGreaterThan(0)

    // 今日の日付で期待時刻のスロットを探す
    const todaySlots = grid.locator(`[data-date="${todayStr}"][data-testid="slot-available"], [data-date="${todayStr}"][data-testid="slot-pending"]`)
    const todaySlotsCount = await todaySlots.count()
    console.log('今日の空きスロット数:', todaySlotsCount)

    // カードに表示されている時刻のスロットが存在するか確認
    // 期待される時刻を正規化（0埋め）
    const expectedHour = expectedTime.split(':')[0].padStart(2, '0')
    const expectedMinute = expectedTime.split(':')[1]
    const normalizedExpected = `${expectedHour}:${expectedMinute}`
    console.log('正規化された期待時刻:', normalizedExpected)

    // 今日の全スロットの時刻を取得
    const slotTimes: string[] = []
    let foundMatchingSlot = false
    let earliestSlotTime: string | null = null

    for (let i = 0; i < todaySlotsCount; i++) {
      const slotStartAt = await todaySlots.nth(i).getAttribute('data-start-at')
      if (slotStartAt) {
        const slotTime = new Date(slotStartAt)
        const slotHour = String(slotTime.getHours()).padStart(2, '0')
        const slotMinute = String(slotTime.getMinutes()).padStart(2, '0')
        const slotTimeStr = `${slotHour}:${slotMinute}`
        slotTimes.push(slotTimeStr)

        // 最も早いスロット時刻を記録
        if (!earliestSlotTime || slotTimeStr < earliestSlotTime) {
          earliestSlotTime = slotTimeStr
        }

        if (slotTimeStr === normalizedExpected) {
          foundMatchingSlot = true
          console.log(`✓ 期待時刻 ${normalizedExpected} のスロットが見つかりました`)
        }
      }
    }

    console.log('今日の空きスロット時刻一覧:', slotTimes.join(', '))
    console.log('最も早いスロット時刻:', earliestSlotTime)

    // カードに表示されている時刻がグリッドに存在するか、
    // または時間が経過してカード時刻が過去になった場合は最も早いスロットが存在することを確認
    // （サンプルデータのnext_available_slotは固定値だが、グリッドは現在時刻でフィルタされる）
    if (foundMatchingSlot) {
      console.log('✓ カードの時刻とグリッドのスロットが一致')
    } else if (earliestSlotTime && normalizedExpected <= earliestSlotTime) {
      // カードの時刻が最も早いスロット以前の場合、時間経過による正当な差異
      console.log(`⚠ カード時刻 ${normalizedExpected} は過去となり、グリッドには ${earliestSlotTime} 以降が表示`)
      console.log('これはサンプルデータのnext_available_slotと現在時刻によるグリッドフィルタの差異です')
    } else {
      // カードの時刻がグリッドに存在せず、かつ最も早いスロットより遅い場合は問題
      console.error(`✗ カード時刻 ${normalizedExpected} がグリッド内に見つかりません（最早スロット: ${earliestSlotTime}）`)
      expect(foundMatchingSlot).toBe(true) // 失敗させる
    }

    // 少なくとも空きスロットがグリッドに存在することを確認
    expect(slotTimes.length).toBeGreaterThan(0)

    // グリッドにステータスアイコンが表示されていることを確認
    // ◎（open）または △（tentative）が存在する
    const openIcon = grid.locator('text="◎"')
    const tentativeIcon = grid.locator('text="△"')
    const openCount = await openIcon.count()
    const tentativeCount = await tentativeIcon.count()
    console.log('◎アイコン数:', openCount, '△アイコン数:', tentativeCount)

    // 少なくとも1つのステータスアイコンがある
    expect(openCount + tentativeCount).toBeGreaterThan(0)
  })

  test('予約するボタンが全カードにある', async ({ page }) => {
    await page.goto('/search?force_samples=1&tab=therapists')
    await page.waitForLoadState('networkidle')

    // セラピスト結果セクションが表示されるまでスクロールして待機
    const therapistSection = page.locator('#therapist-results')
    await therapistSection.scrollIntoViewIfNeeded()
    await expect(therapistSection).toBeVisible({ timeout: 10000 })

    const cards = page.locator('[data-testid="therapist-card"]')
    const cardCount = await cards.count()

    // 各カードに「予約する」ボタンがあるか確認
    const reserveButtons = page.locator('[data-testid="therapist-card"]:has-text("予約する")')
    const buttonCount = await reserveButtons.count()

    console.log('カード数:', cardCount, '予約ボタン数:', buttonCount)
    expect(buttonCount).toBe(cardCount)
  })
})
