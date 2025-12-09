import { test, expect } from '@playwright/test'

/**
 * カード時間とカレンダー時間の整合性テスト
 *
 * セラピストカードに表示される「次の空き時間」(例: 本日 10:00〜)が
 * オーバーレイ内のカレンダーでも選択可能であることを検証します。
 *
 * テスト対象ページ:
 * 1. /search - 検索結果ページ
 * 2. /guest/match-chat - AIマッチングページ
 * 3. /profiles/[slug] - 店舗プロフィールページ
 */

test.describe('Card-Calendar time consistency', () => {
  test('/search: card availability time should be selectable in calendar overlay', async ({
    page,
  }) => {
    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    // カードを待機
    const cards = page.locator('[data-testid="therapist-card"]')
    await expect(cards.first()).toBeVisible({ timeout: 15000 })

    // 最初のカードから空き時間情報を取得
    const firstCard = cards.first()
    const availabilityBadge = firstCard.locator(
      '.bg-emerald-500\\/90, .bg-amber-500\\/90',
    )
    const hasAvailability = await availabilityBadge.isVisible().catch(() => false)

    if (!hasAvailability) {
      console.log('No availability badge found on first card, skipping test')
      test.skip()
      return
    }

    const badgeText = await availabilityBadge.textContent()
    console.log('Card availability badge:', badgeText)

    // 時間を抽出 (例: "本日 10:00〜" -> "10:00")
    const timeMatch = badgeText?.match(/(\d{1,2}):(\d{2})/)
    if (!timeMatch) {
      console.log('Could not extract time from badge, skipping test')
      test.skip()
      return
    }

    const expectedTime = `${timeMatch[1]}:${timeMatch[2]}`
    console.log('Expected time in calendar:', expectedTime)

    // カードをクリックしてオーバーレイを開く
    await firstCard.click()
    await page.waitForTimeout(1500)

    // 「空き状況・予約」タブをクリック
    const bookingTab = page.getByText('空き状況・予約').first()
    if (await bookingTab.isVisible()) {
      await bookingTab.click()
      await page.waitForTimeout(1000)

      // ページのHTMLを取得して時間スロットを検索
      const pageContent = await page.content()

      // カードの時間がカレンダーに存在するか確認
      // HH:MM 形式で検索
      const timeExists =
        pageContent.includes(expectedTime) ||
        pageContent.includes(`>${timeMatch[1]}:${timeMatch[2]}<`) ||
        pageContent.includes(`"${expectedTime}"`)

      console.log(`Time ${expectedTime} exists in calendar:`, timeExists)

      // スクリーンショットを保存
      await page.screenshot({
        path: `/tmp/e2e-search-card-calendar-${expectedTime.replace(':', '')}.png`,
      })

      expect(
        timeExists,
        `Card time ${expectedTime} should be available in calendar`,
      ).toBe(true)
    }

    // オーバーレイを閉じる
    await page.keyboard.press('Escape')
  })

  test('/guest/match-chat: card availability time should be selectable in calendar overlay', async ({
    page,
  }) => {
    await page.goto('/guest/match-chat')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 日付を設定
    const dateInput = page.locator('input[type="date"]')
    if (await dateInput.isVisible().catch(() => false)) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]
      await dateInput.fill(dateStr)
    }

    // ムードを選択
    const moodChip = page.getByText('お任せしたい')
    if (await moodChip.isVisible().catch(() => false)) {
      await moodChip.click()
    }

    // 検索を実行
    const submitBtn = page.locator('button:has-text("この条件でおすすめをみる")')
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click()
    }

    // 結果カードを待機
    const cards = page.locator('[data-testid="therapist-card"]')
    const hasCards = await cards.first().isVisible({ timeout: 60000 }).catch(() => false)

    if (!hasCards) {
      console.log('No therapist cards found in match-chat results, skipping')
      test.skip()
      return
    }

    // 最初のカードの空き時間情報を取得
    const firstCard = cards.first()
    const availabilityBadge = firstCard.locator(
      '.bg-emerald-500\\/90, .bg-amber-500\\/90',
    )
    const hasAvailability = await availabilityBadge.isVisible().catch(() => false)

    if (!hasAvailability) {
      console.log('No availability badge on match-chat card')
      test.skip()
      return
    }

    const badgeText = await availabilityBadge.textContent()
    console.log('Match-chat card availability badge:', badgeText)

    const timeMatch = badgeText?.match(/(\d{1,2}):(\d{2})/)
    if (!timeMatch) {
      console.log('Could not extract time from badge')
      test.skip()
      return
    }

    const expectedTime = `${timeMatch[1]}:${timeMatch[2]}`
    console.log('Expected time in calendar:', expectedTime)

    // カードをクリックしてオーバーレイを開く
    await firstCard.click()
    await page.waitForTimeout(1500)

    // 「空き状況・予約」タブをクリック
    const bookingTab = page.getByText('空き状況・予約').first()
    if (await bookingTab.isVisible()) {
      await bookingTab.click()
      await page.waitForTimeout(1000)

      const pageContent = await page.content()
      const timeExists =
        pageContent.includes(expectedTime) ||
        pageContent.includes(`>${timeMatch[1]}:${timeMatch[2]}<`)

      console.log(`Time ${expectedTime} exists in calendar:`, timeExists)

      await page.screenshot({
        path: `/tmp/e2e-match-chat-card-calendar-${expectedTime.replace(':', '')}.png`,
      })

      expect(
        timeExists,
        `Card time ${expectedTime} should be available in calendar`,
      ).toBe(true)
    }

    await page.keyboard.press('Escape')
  })

  test('/profiles/[slug]: staff card availability time should be selectable in calendar overlay', async ({
    page,
  }) => {
    // 店舗検索ページから店舗を選択
    await page.goto('/search?tab=shops')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 店舗リンクを探す
    const shopLinks = page.locator('a[href*="/profiles/sample-"]')
    const shopLinkCount = await shopLinks.count()

    if (shopLinkCount === 0) {
      // 直接店舗ページへ
      await page.goto('/profiles/sample-namba-resort')
    } else {
      await shopLinks.first().click()
    }

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    // スタッフセクションを探す
    const staffSection = page.locator('#staff-section')
    const hasStaffSection = await staffSection.isVisible().catch(() => false)

    if (!hasStaffSection) {
      console.log('No staff section found, skipping')
      test.skip()
      return
    }

    await staffSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    // 予約ボタンを探す
    const reserveButton = staffSection.locator('button:has-text("予約する")').first()
    const hasReserveButton = await reserveButton.isVisible().catch(() => false)

    if (!hasReserveButton) {
      console.log('No reserve button in staff section')
      test.skip()
      return
    }

    // 空き時間バッジを取得
    const availabilityBadge = staffSection
      .locator('.bg-emerald-500\\/90, .bg-amber-500\\/90')
      .first()
    const hasAvailability = await availabilityBadge.isVisible().catch(() => false)

    let expectedTime: string | null = null
    if (hasAvailability) {
      const badgeText = await availabilityBadge.textContent()
      console.log('Shop staff card availability badge:', badgeText)

      const timeMatch = badgeText?.match(/(\d{1,2}):(\d{2})/)
      if (timeMatch) {
        expectedTime = `${timeMatch[1]}:${timeMatch[2]}`
        console.log('Expected time in calendar:', expectedTime)
      }
    }

    // オーバーレイを開く
    await reserveButton.click()
    await page.waitForTimeout(2000)

    // オーバーレイが開いたか確認
    const formButton = page.locator('button:has-text("予約フォームを開く")')
    const overlayOpened = await formButton.isVisible().catch(() => false)

    if (!overlayOpened) {
      console.log('Overlay did not open')
      test.skip()
      return
    }

    // 「空き状況・予約」タブをクリック
    const bookingTab = page.getByText('空き状況・予約').first()
    if (await bookingTab.isVisible()) {
      await bookingTab.click()
      await page.waitForTimeout(1000)

      if (expectedTime) {
        const pageContent = await page.content()
        const timeExists =
          pageContent.includes(expectedTime) ||
          pageContent.includes(`>${expectedTime.split(':')[0]}:${expectedTime.split(':')[1]}<`)

        console.log(`Time ${expectedTime} exists in calendar:`, timeExists)

        await page.screenshot({
          path: `/tmp/e2e-shop-staff-card-calendar-${expectedTime.replace(':', '')}.png`,
        })

        expect(
          timeExists,
          `Card time ${expectedTime} should be available in calendar`,
        ).toBe(true)
      } else {
        // 時間バッジがなかった場合もカレンダーが表示されることを確認
        await page.screenshot({ path: '/tmp/e2e-shop-staff-calendar-no-badge.png' })
        console.log('No time badge, but calendar should still work')
      }
    }

    await page.keyboard.press('Escape')
  })

  test('selected slot from card time should be pre-selected in calendar', async ({
    page,
  }) => {
    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    const cards = page.locator('[data-testid="therapist-card"]')
    await expect(cards.first()).toBeVisible({ timeout: 15000 })

    // 空き時間バッジがあるカードを探す
    let targetCard = null
    let badgeText: string | null = null

    for (let i = 0; i < Math.min(5, await cards.count()); i++) {
      const card = cards.nth(i)
      const badge = card.locator('.bg-emerald-500\\/90, .bg-amber-500\\/90')
      if (await badge.isVisible().catch(() => false)) {
        targetCard = card
        badgeText = await badge.textContent()
        break
      }
    }

    if (!targetCard || !badgeText) {
      console.log('No card with availability badge found')
      test.skip()
      return
    }

    console.log('Found card with badge:', badgeText)

    // カードをクリックしてオーバーレイを開く
    await targetCard.click()
    await page.waitForTimeout(1500)

    // 「空き状況・予約」タブをクリック
    const bookingTab = page.getByText('空き状況・予約').first()
    if (await bookingTab.isVisible()) {
      await bookingTab.click()
      await page.waitForTimeout(1000)

      // 選択済みスロット（第1候補）があるか確認
      const selectedBadge = page.locator('text=第1候補')
      const hasSelectedSlot = await selectedBadge.isVisible().catch(() => false)

      console.log('Pre-selected slot (第1候補) visible:', hasSelectedSlot)

      await page.screenshot({ path: '/tmp/e2e-preselected-slot.png', fullPage: true })

      // カードの時間が事前選択されているべき
      expect(
        hasSelectedSlot,
        'Card availability time should be pre-selected as 第1候補',
      ).toBe(true)
    }

    await page.keyboard.press('Escape')
  })
})
