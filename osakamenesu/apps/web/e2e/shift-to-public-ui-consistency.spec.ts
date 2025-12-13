import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'https://osakamenesu.com'
const API_BASE =
  process.env.E2E_API_BASE ||
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
  'https://api.osakamenesu.com'
const E2E_SEED_TOKEN = process.env.E2E_SEED_TOKEN || ''

const SHOP_ID = '11111111-2222-3333-4444-555555555555'
const THERAPIST_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const SHOP_SLUG = 'e2e-momona-salon'

type SlotsResponse = { slots: Array<{ start_at: string; end_at: string }>; count: number }

function jstDate(offsetDays = 0): string {
  const now = new Date()
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  jst.setDate(jst.getDate() + offsetDays)
  return jst.toISOString().slice(0, 10)
}

async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  if (!E2E_SEED_TOKEN) {
    throw new Error('E2E_SEED_TOKEN is required')
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'x-e2e-seed-token': E2E_SEED_TOKEN,
      'content-type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${text}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    return text as any
  }
}

async function seedOnce() {
  await api('/internal/e2e/seed', { method: 'POST' })
}

async function upsertShift({
  date,
  startAt,
  endAt,
  availabilityStatus = 'available',
  clearAll = true,
}: {
  date: string
  startAt: string
  endAt: string
  availabilityStatus?: string
  clearAll?: boolean
}) {
  await api('/internal/e2e/shifts', {
    method: 'POST',
    body: JSON.stringify({
      therapist_id: THERAPIST_ID,
      shop_id: SHOP_ID,
      date,
      start_at: startAt,
      end_at: endAt,
      availability_status: availabilityStatus,
      clear_all: clearAll,
    }),
  })
}

async function rebuildSlots(date: string) {
  await api(`/internal/e2e/rebuild_slots?shop_id=${SHOP_ID}&date=${date}`, {
    method: 'POST',
  })
}

async function fetchSlots(date: string): Promise<SlotsResponse> {
  return api(`/internal/e2e/slots?therapist_id=${THERAPIST_ID}&shop_id=${SHOP_ID}&date=${date}`)
}

async function waitForSlotCount(date: string, predicate: (n: number) => boolean) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const res = await fetchSlots(date)
    if (predicate(res.count)) return res
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`slot count did not satisfy predicate within timeout for ${date}`)
}

test.describe.serial('勤怠→公開UI 整合性', () => {
  const targetDate = jstDate(1) // 明日を固定
  const slotStart = `${targetDate}T10:00:00+09:00`
  const slotEnd = `${targetDate}T12:00:00+09:00`

  test.beforeAll(async () => {
    await seedOnce()
  })

  test('slots=0 のときは要問い合わせ表示になる', async ({ page }) => {
    // シフトをblockedで上書きし、slots=0を作る
    await upsertShift({
      date: targetDate,
      startAt: slotStart,
      endAt: slotEnd,
      availabilityStatus: 'off',
      clearAll: true,
    })
    await rebuildSlots(targetDate)
    const res = await waitForSlotCount(targetDate, (n) => n === 0)
    expect(res.count).toBe(0)

    await page.goto(`${BASE_URL}/search?q=momona&tab=therapists`, { waitUntil: 'networkidle' })
    const card = page.locator(`[data-testid="therapist-card"][data-shop="${SHOP_SLUG}"]`).first()
    await expect(card).toBeVisible()
    const badge = card.getByTestId('therapist-availability-badge')
    await expect(badge).toHaveText(/問い合わせ|リクエスト/)
    await expect(badge).not.toHaveText(/本日|\d{1,2}:\d{2}/)
    await expect(card.getByTestId('therapist-cta')).toHaveText(/予約リクエスト/)
  })

  test('slots>=1 のときは時刻表示 + 予約するになる', async ({ page }) => {
    await upsertShift({
      date: targetDate,
      startAt: slotStart,
      endAt: slotEnd,
      availabilityStatus: 'available',
      clearAll: true,
    })
    await rebuildSlots(targetDate)
    const res = await waitForSlotCount(targetDate, (n) => n >= 1)
    expect(res.count).toBeGreaterThan(0)

    await page.goto(`${BASE_URL}/search?q=momona&tab=therapists`, { waitUntil: 'networkidle' })
    const card = page.locator(`[data-testid="therapist-card"][data-shop="${SHOP_SLUG}"]`).first()
    await expect(card).toBeVisible()
    const badge = card.getByTestId('therapist-availability-badge')
    await expect(badge).toContainText(/本日|最短|\d{1,2}:\d{2}/)
    await expect(card.getByTestId('therapist-cta')).toHaveText(/予約する/)
  })
})
