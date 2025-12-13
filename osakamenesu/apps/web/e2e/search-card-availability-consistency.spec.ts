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
    throw new Error(`availability fetch failed: ${res.status}`)
  }
  const json = await res.json().catch(() => ({}))
  return Array.isArray(json?.slots) ? json.slots : []
}

test.describe('検索カードと予約スロットの整合性', () => {
  // 店舗IDが異なる同名カードを区別するため data-shop を利用
  const requestOnlyShopId = '52c92fb6-bab6-460e-9312-61a16ab98941'
  const requestOnlyTherapistId = '5a9e68aa-8b58-4f4b-aeda-3be83544adfd'
  const slotShopSlug = 'e2e-momona-salon'
  const slotTherapistId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  test('スロットが無いカードは時刻を出さず、リクエスト表示に統一される', async ({ page }) => {
    // APIで事前確認
    const requestSlots = await fetchSlots(requestOnlyTherapistId)
    expect(requestSlots.length, 'request-only therapist should have 0 slots').toBe(0)
    const slotSlots = await fetchSlots(slotTherapistId)
    expect(slotSlots.length, 'slot therapist should have >=1 slot').toBeGreaterThan(0)

    await page.goto(`${BASE_URL}/search?q=SSS&tab=therapists&page=1`, {
      waitUntil: 'networkidle',
    })

    const requestCard = page.locator(
      `[data-testid="therapist-card"][data-shop="${requestOnlyShopId}"]`,
    )
    await expect(requestCard).toBeVisible()
    await expect(requestCard.getByTestId('therapist-availability-badge')).toHaveText(/要問い合わせ/)
    await expect(requestCard.getByTestId('therapist-cta')).toHaveText(/予約リクエスト/)

    const slotCard = page.locator(
      `[data-testid="therapist-card"][data-shop="${slotShopSlug}"]`,
    )
    await expect(slotCard).toBeVisible()
    await expect(slotCard.getByTestId('therapist-availability-badge')).toHaveText(/本日|最短|明日/)
    await expect(slotCard.getByTestId('therapist-cta')).toHaveText(/予約する/)
  })
})
