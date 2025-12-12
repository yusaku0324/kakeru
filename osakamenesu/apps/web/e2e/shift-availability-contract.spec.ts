import { test, expect } from '@playwright/test'

/**
 * シフト→Availability API 整合性契約テスト
 *
 * 目的：シフトが存在するセラピストに対して、
 *       availability_slots API が空でないスロットを返すことを保証する
 *
 * 前提条件：
 * - 本番環境 (osakamenesu-web.vercel.app) で実行
 * - テスト対象のセラピストにシフトが登録されている
 */

const BASE_URL = process.env.E2E_BASE_URL || 'https://osakamenesu-web.vercel.app'
const SEARCH_QUERY = 'SSS'
const THERAPIST_NAME = 'ももな'

type AvailabilitySlot = {
  start_at: string
  end_at: string
  status: 'open' | 'tentative' | 'blocked'
}

type AvailabilityDay = {
  date: string
  is_today: boolean
  slots: AvailabilitySlot[]
}

type AvailabilityResponse = {
  days: AvailabilityDay[]
}

test.describe('シフト→Availability API 契約テスト', () => {
  test('セラピストが「本日」表示の場合、availability API は空でないスロットを返す', async ({
    request,
    page,
  }) => {
    console.log('=== 契約テスト開始 ===')
    console.log(`BASE_URL: ${BASE_URL}`)

    // Step 1: 検索ページにアクセスしてセラピストIDを取得
    const searchUrl = `${BASE_URL}/search?q=${SEARCH_QUERY}`
    console.log(`Step 1: ${searchUrl} にアクセス`)
    await page.goto(searchUrl, { waitUntil: 'networkidle' })

    // セラピストカードを探す
    const therapistCard = page
      .locator('article')
      .filter({
        has: page.getByText(THERAPIST_NAME, { exact: false }),
      })
      .first()

    await expect(therapistCard).toBeVisible({ timeout: 15000 })
    console.log(`  \"${THERAPIST_NAME}\" のカードを発見`)

    // カードに「本日」ラベルがあるか確認
    const todayLabel = therapistCard.getByText(/本日.*\d+:\d+/)
    const hasTodayLabel = await todayLabel.isVisible().catch(() => false)
    console.log(`  カードの「本日」ラベル: ${hasTodayLabel ? 'あり' : 'なし'}`)

    if (!hasTodayLabel) {
      console.log('  「本日」ラベルがないため、このテストはスキップします')
      test.skip()
      return
    }

    // Step 2: 予約ボタンをクリックしてオーバーレイを開く（therapistIdを取得するため）
    console.log('Step 2: オーバーレイを開いてtherapistIdを取得')

    let therapistId: string | null = null

    // availability_slots API リクエストをキャプチャ
    const apiPromise = page.waitForRequest(
      (req) => req.url().includes('availability_slots'),
      { timeout: 15000 }
    )

    const reserveButton = therapistCard.getByRole('button', { name: /予約/ })
    await reserveButton.click()

    // オーバーレイを待機
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })

    try {
      const apiRequest = await apiPromise
      const urlMatch = apiRequest.url().match(/therapists\/([^/]+)\/availability_slots/)
      if (urlMatch) {
        therapistId = urlMatch[1]
        console.log(`  therapistId: ${therapistId}`)
      }
    } catch {
      console.log('  API リクエストをキャプチャできませんでした')
    }

    if (!therapistId) {
      console.error('therapistId を取得できませんでした')
      expect(therapistId).toBeTruthy()
      return
    }

    // Step 3: availability_slots API を直接呼び出して検証
    console.log('Step 3: availability_slots API を直接呼び出して検証')

    const apiUrl = `${BASE_URL}/api/guest/therapists/${therapistId}/availability_slots`
    console.log(`  API URL: ${apiUrl}`)

    const response = await request.get(apiUrl)
    expect(response.status()).toBe(200)

    const data: AvailabilityResponse = await response.json()
    console.log('  API レスポンス:')
    console.log(`    days.length: ${data.days?.length || 0}`)

    // 各日のスロット数をログ
    let totalOpenSlots = 0
    let totalTentativeSlots = 0
    let totalBlockedSlots = 0

    if (data.days) {
      for (const day of data.days) {
        const openCount = day.slots.filter((s) => s.status === 'open').length
        const tentativeCount = day.slots.filter((s) => s.status === 'tentative').length
        const blockedCount = day.slots.filter((s) => s.status === 'blocked').length

        totalOpenSlots += openCount
        totalTentativeSlots += tentativeCount
        totalBlockedSlots += blockedCount

        if (day.slots.length > 0) {
          console.log(
            `    ${day.date}${day.is_today ? ' (今日)' : ''}: open=${openCount}, tentative=${tentativeCount}, blocked=${blockedCount}`
          )
        }
      }
    }

    console.log(`  合計: open=${totalOpenSlots}, tentative=${totalTentativeSlots}, blocked=${totalBlockedSlots}`)

    // Step 4: 契約検証
    console.log('Step 4: 契約検証')

    // 「本日」ラベルがある場合、少なくとも1つの予約可能スロット（open または tentative）があるべき
    const totalBookableSlots = totalOpenSlots + totalTentativeSlots

    if (totalBookableSlots === 0) {
      console.error('=== 契約違反検出 ===')
      console.error('カードには「本日」ラベルがあるが、API には予約可能スロットがない')
      console.error('API レスポンス詳細:')
      console.error(JSON.stringify(data, null, 2))

      // スクリーンショットを保存
      await page.screenshot({
        path: 'e2e/screenshots/contract-violation.png',
        fullPage: true,
      })
    }

    expect(
      totalBookableSlots,
      `契約違反: カードに「本日」ラベルがあるのに、APIから予約可能スロット（open/tentative）が返されていない。` +
        `open=${totalOpenSlots}, tentative=${totalTentativeSlots}`
    ).toBeGreaterThan(0)

    console.log('=== 契約テスト成功 ===')
  })

  test('availability API レスポンス構造の検証', async ({ request, page }) => {
    console.log('=== API レスポンス構造テスト ===')

    // 検索ページにアクセスしてtherapistIdを取得
    await page.goto(`${BASE_URL}/search?q=${SEARCH_QUERY}`, { waitUntil: 'networkidle' })

    const therapistCard = page
      .locator('article')
      .filter({
        has: page.getByText(THERAPIST_NAME, { exact: false }),
      })
      .first()

    await expect(therapistCard).toBeVisible({ timeout: 15000 })

    let therapistId: string | null = null

    const apiPromise = page.waitForRequest(
      (req) => req.url().includes('availability_slots'),
      { timeout: 15000 }
    )

    const reserveButton = therapistCard.getByRole('button', { name: /予約/ })
    await reserveButton.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })

    try {
      const apiRequest = await apiPromise
      const urlMatch = apiRequest.url().match(/therapists\/([^/]+)\/availability_slots/)
      if (urlMatch) {
        therapistId = urlMatch[1]
      }
    } catch {
      // ignore
    }

    if (!therapistId) {
      test.skip()
      return
    }

    // API を直接呼び出し
    const response = await request.get(
      `${BASE_URL}/api/guest/therapists/${therapistId}/availability_slots`
    )
    expect(response.status()).toBe(200)

    const data: AvailabilityResponse = await response.json()

    // レスポンス構造の検証
    expect(data).toHaveProperty('days')
    expect(Array.isArray(data.days)).toBe(true)

    // 7日分のデータがあることを確認
    expect(data.days.length).toBe(7)

    // 各日のデータ構造を検証
    for (const day of data.days) {
      expect(day).toHaveProperty('date')
      expect(day).toHaveProperty('is_today')
      expect(day).toHaveProperty('slots')
      expect(Array.isArray(day.slots)).toBe(true)

      // 日付形式の検証（YYYY-MM-DD）
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      // スロットの構造を検証
      for (const slot of day.slots) {
        expect(slot).toHaveProperty('start_at')
        expect(slot).toHaveProperty('end_at')
        expect(slot).toHaveProperty('status')
        expect(['open', 'tentative', 'blocked']).toContain(slot.status)

        // ISO 8601 形式の検証
        expect(new Date(slot.start_at).toISOString()).toBeTruthy()
        expect(new Date(slot.end_at).toISOString()).toBeTruthy()
      }
    }

    // 今日のデータが is_today: true になっていることを確認
    const todayData = data.days.find((d) => d.is_today)
    expect(todayData).toBeTruthy()

    // 今日の日付と一致することを確認
    const jstFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const todayJST = jstFormatter.format(new Date())
    expect(todayData?.date).toBe(todayJST)

    console.log('=== API レスポンス構造テスト成功 ===')
  })
})
