import { test, expect } from '@playwright/test'

/**
 * Phase 1 Safe Refactor 検証テスト
 *
 * 目的：
 * Phase 1（availability.ts の deprecated wrapper 削除・lib/jst.ts 直接インポート統一）後の
 * 挙動が本当に変わっていないことを、人間の目視確認に相当するレベルで自動検証する。
 *
 * これは新機能テストではなく「実動確認（納得のための確認）」の自動化。
 *
 * 検証ポイント（Availability Consistency Contract）：
 * 1. セラピストカードの「次回◯時〜」表示
 * 2. 予約フォームのカレンダーで「予約可能」と表示されている最初の枠の時刻
 * → 同一セラピスト・同一日付に対して、カードの時刻がカレンダーの空き枠内に存在すること
 *
 * このテストが通る限り「Phase 1 で挙動は変わっていない」と言える理由：
 * - UI 側で空き枠を再計算していないこと（API レスポンス由来の表示であること）
 * - カードとカレンダーが同一の空き枠データに基づいて描画されていること
 *
 * 注意：
 * - カードは `next_available_slot` から時刻を取得（サンプルデータでは動的生成）
 * - カレンダーは `availability_slots` API から取得（30分刻みのスロット）
 * - これらは厳密に同一ではないが、「空き枠がある」という情報は一致すべき
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'

// サンプルデータモード（実 API が不安定な場合のフォールバック）
const USE_SAMPLES = process.env.E2E_USE_SAMPLES !== 'false'
const SEARCH_PATH = USE_SAMPLES ? '/search?force_samples=1' : '/search'

/**
 * ISO 文字列から時刻部分（HH:mm）を抽出
 */
function extractTime(isoString: string): string {
  return isoString.slice(11, 16)
}

/**
 * 時刻文字列を分単位に変換
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

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

test.describe('Availability Consistency Contract', () => {
  /**
   * メインテスト：カード表示とAPI の最初の空きスロットが厳密に一致する
   *
   * Canonicalization 要件:
   * next_available_slot.start_at === availability_slots[0].start_at
   *
   * 人間が目視確認する際の手順を自動化：
   * 1. 検索ページでセラピストカードを見つける
   * 2. カードに「次回◯時〜」が表示されているか確認
   * 3. API から availability_slots を取得
   * 4. カードの時刻と API の最初の空きスロットが厳密に一致することを検証
   *
   * このテストが通ることで、next_available_slot が availability_slots から
   * 正しく導出されていることが証明される。
   */
  test('セラピストカードの「次回◯時〜」とAPIの最初の空き枠が厳密に一致する', async ({
    page,
    request,
  }) => {
    console.log('=== Phase 1 Availability Consistency 検証開始 ===')
    console.log(`テスト環境: ${BASE_URL}`)
    console.log(`サンプルデータモード: ${USE_SAMPLES}`)

    // Step 1: 検索ページからセラピストカードを取得
    await page.goto(`${BASE_URL}${SEARCH_PATH}`)
    await page.waitForLoadState('networkidle')

    const cards = page.locator('[data-testid="therapist-card"]')
    await expect(cards.first()).toBeVisible({ timeout: 15000 })

    // Step 2: 空き時間バッジ（「本日◯時〜」or「明日◯時〜」）があるカードを探す
    // バッジには時刻が含まれている必要がある（「本日空きあり」のみは対象外）
    const cardWithTimeBadge = cards
      .filter({
        has: page.locator('[data-testid="therapist-availability-badge"]'),
      })
      .filter({
        hasText: /\d{1,2}:\d{2}/,
      })
      .first()

    const hasCard = (await cardWithTimeBadge.count()) > 0

    if (!hasCard) {
      console.log('時刻表示のあるカードがないためスキップ')
      console.log('（これは Phase 1 の問題ではなく、データの問題）')
      test.skip()
      return
    }

    // Step 3: カードの therapistId と表示時刻を取得
    const therapistId = await cardWithTimeBadge.getAttribute('data-therapist-id')
    if (!therapistId) {
      console.log('therapistId が取得できないためスキップ')
      test.skip()
      return
    }

    const badge = cardWithTimeBadge.locator('[data-testid="therapist-availability-badge"]')
    const badgeText = await badge.textContent()
    console.log(`カードのバッジ表示: "${badgeText}"`)

    // バッジから時刻を抽出（例: "本日 10:00〜" → "10:00"）
    const cardTimeMatch = badgeText?.match(/(\d{1,2}):(\d{2})/)
    if (!cardTimeMatch) {
      console.log('時刻パターンが抽出できないためスキップ')
      test.skip()
      return
    }
    const cardTime = `${cardTimeMatch[1].padStart(2, '0')}:${cardTimeMatch[2]}`
    console.log(`カードの時刻: ${cardTime}`)

    // Step 4: API から空き枠データを取得
    const availRes = await request.get(
      `${BASE_URL}/api/guest/therapists/${therapistId}/availability_slots`
    )
    expect(availRes.status()).toBe(200)

    const apiData: AvailabilityResponse = await availRes.json()

    // Step 5: API の最初の「予約可能」スロットの時刻を取得
    const firstAvailableSlot = apiData.days
      .flatMap((d) => d.slots)
      .find((s) => s.status === 'open' || s.status === 'tentative')

    if (!firstAvailableSlot) {
      console.log('API に空きスロットがないためスキップ')
      test.skip()
      return
    }

    const apiTime = extractTime(firstAvailableSlot.start_at)
    console.log(`API の最初の空きスロット時刻: ${apiTime}`)

    // Step 6: Next Available Slot Canonicalization の検証（最重要）
    // 要件: next_available_slot.start_at === availability_slots[0].start_at（厳密一致）
    // この検証はカードクリック前に行う（UI の状態に依存しない）
    console.log('\n=== Next Available Slot Canonicalization 検証 ===')
    console.log(`  - カードの時刻 (next_available_slot): ${cardTime}`)
    console.log(`  - APIの最初の空き (availability_slots[0]): ${apiTime}`)

    // 厳密な時刻一致を要求（Canonicalization 実装後）
    expect(
      cardTime === apiTime,
      `Canonicalization: カードの時刻(${cardTime})とAPIの最初の空きスロット(${apiTime})が一致すること`
    ).toBe(true)
    console.log('✓ Canonicalization: カードとAPIの時刻が一致')

    // Step 7: API の全ての空きスロット時刻を収集して追加検証
    const allApiTimes = apiData.days
      .flatMap((d) => d.slots)
      .filter((s) => s.status === 'open' || s.status === 'tentative')
      .map((s) => extractTime(s.start_at))

    console.log('\n=== Availability Consistency Contract 検証 ===')
    console.log(`カードの時刻:        ${cardTime}`)
    console.log(`APIの最初の空き:     ${apiTime}`)
    console.log(`APIの全空き時刻:     ${allApiTimes.slice(0, 5).join(', ')}...`)

    // 核心的な検証：カードに時刻が表示されているなら、API にも空きスロットがあること
    expect(
      allApiTimes.length > 0,
      'カードに時刻が表示されているなら、API にも空きスロットがあること'
    ).toBe(true)

    // カードの時刻が API のスロット内に含まれていることを確認
    const cardInApiSlots = allApiTimes.includes(cardTime)
    console.log(`カード時刻(${cardTime})がAPIスロット内: ${cardInApiSlots}`)
    expect(
      cardInApiSlots,
      `カードの時刻(${cardTime})が API のスロット内に存在すること`
    ).toBe(true)

    console.log('\n=== Phase 1 Availability Consistency 検証成功 ===')
  })

  /**
   * 補助テスト：API レスポンスが30分グリッドに揃っていることの確認
   *
   * availability_slots API が返す時刻はすべて :00 または :30 であるべき。
   * これにより、next_available_slot との一致が保証される。
   */
  test('API の空きスロットは30分グリッドに揃っている', async ({
    page,
    request,
  }) => {
    console.log('=== API 30分グリッド検証開始 ===')

    await page.goto(`${BASE_URL}${SEARCH_PATH}`)
    await page.waitForLoadState('networkidle')

    const cards = page.locator('[data-testid="therapist-card"]')
    await expect(cards.first()).toBeVisible({ timeout: 15000 })

    const therapistId = await cards.first().getAttribute('data-therapist-id')
    if (!therapistId) {
      test.skip()
      return
    }

    // API データを取得
    const availRes = await request.get(
      `${BASE_URL}/api/guest/therapists/${therapistId}/availability_slots`
    )
    const apiData: AvailabilityResponse = await availRes.json()

    // API の全スロット時刻を収集し、30分グリッドに揃っているか検証
    const apiTimes: string[] = []
    const invalidTimes: string[] = []

    for (const day of apiData.days) {
      for (const slot of day.slots) {
        if (slot.status === 'open' || slot.status === 'tentative') {
          const time = extractTime(slot.start_at)
          apiTimes.push(time)

          // 30分グリッドに揃っているか確認（:00 または :30）
          const minutes = parseInt(time.split(':')[1])
          if (minutes !== 0 && minutes !== 30) {
            invalidTimes.push(time)
          }
        }
      }
    }

    console.log(`API が返した空きスロット時刻: ${apiTimes.slice(0, 10).join(', ')}...`)

    if (invalidTimes.length > 0) {
      console.log(`30分グリッドに揃っていない時刻: ${invalidTimes.join(', ')}`)
    }

    // すべての時刻が30分グリッドに揃っていることを検証
    expect(
      invalidTimes.length === 0,
      `API の時刻はすべて30分グリッドに揃っていること。不正な時刻: ${invalidTimes.join(', ')}`
    ).toBe(true)

    console.log('✓ API のすべてのスロットが30分グリッドに揃っている')
    console.log('=== API 30分グリッド検証成功 ===')
  })
})
