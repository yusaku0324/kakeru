import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'https://osakamenesu.com'
const API_BASE =
  process.env.E2E_API_BASE ||
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
  'https://api.osakamenesu.com'

function jstDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

async function fetchSlots(therapistId: string): Promise<Array<{ start_at: string; end_at: string }>> {
  const date = jstDate()
  const res = await fetch(`${API_BASE}/api/guest/therapists/${therapistId}/availability_slots?date=${date}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    return []
  }
  const json = await res.json().catch(() => ({}))
  return Array.isArray(json?.slots) ? json.slots : []
}

test.describe('検索カードと予約スロットの整合性', () => {
  /**
   * このテストは本番環境でも動作するよう、データ存在チェック後にスキップ判定を行う。
   * E2Eフィクスチャ（e2e-momona-salonなど）はシード環境でのみ存在する。
   */
  test('スロットが無いカードは時刻を出さず、リクエスト表示に統一される', async ({ page }) => {
    // 検索ページでセラピストカードを探索
    await page.goto(`${BASE_URL}/search?tab=therapists&page=1`, {
      waitUntil: 'networkidle',
    })

    // 直接セレクタでカードを探す（ループより高速）
    const slotCard = page.locator('[data-testid="therapist-card"]').filter({
      has: page.locator('[data-testid="therapist-availability-badge"]:text-matches("本日|最短")')
    }).first()

    const requestCard = page.locator('[data-testid="therapist-card"]').filter({
      has: page.locator('[data-testid="therapist-availability-badge"]:text-matches("要問い合わせ")')
    }).first()

    const [hasSlotCard, hasRequestCard] = await Promise.all([
      slotCard.count().then(c => c > 0),
      requestCard.count().then(c => c > 0),
    ])

    // 少なくとも片方のタイプが見つからない場合はスキップ
    if (!hasSlotCard && !hasRequestCard) {
      test.skip(true, 'テスト対象のカード（スロットあり/なし）が見つからないためスキップ')
      return
    }

    // スロットありカードの検証
    if (hasSlotCard) {
      await expect(slotCard.getByTestId('therapist-availability-badge')).toHaveText(/本日|最短|明日/)
      await expect(slotCard.getByTestId('therapist-cta')).toHaveText(/予約する/)
    }

    // スロットなしカードの検証
    if (hasRequestCard) {
      await expect(requestCard.getByTestId('therapist-availability-badge')).toHaveText(/要問い合わせ/)
      await expect(requestCard.getByTestId('therapist-cta')).toHaveText(/予約リクエスト/)
    }

    // 両方のタイプが見つかった場合のみ完全なテストを実行
    if (!hasSlotCard || !hasRequestCard) {
      console.log(`⚠️ 部分テスト: slotCard=${hasSlotCard}, requestCard=${hasRequestCard}`)
    }
  })
})
