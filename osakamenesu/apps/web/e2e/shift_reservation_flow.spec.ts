import { expect, test } from '@playwright/test'

const WEB_BASE = process.env.E2E_WEB_BASE || 'http://localhost:3000'
const API_BASE = process.env.E2E_API_BASE || 'https://osakamenesu-api-stg.fly.dev'
const ADMIN_BASE = process.env.E2E_ADMIN_BASE || API_BASE
const ADMIN_KEY = process.env.E2E_ADMIN_KEY || 'dev_admin_key'

const SHOP_ID = process.env.E2E_SHOP_ID || 'a7cc4b9d-81a8-4181-a47e-afa7db2281ef'
const THERAPIST_ID = process.env.E2E_THERAPIST_ID || '53605bf2-0a8e-4171-a239-62f6843d10ed'

function jstDatePlus(days: number): string {
  const now = new Date()
  const jstYmd = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const [y, m, d] = jstYmd.split('-').map((v) => Number(v))
  const base = new Date(Date.UTC(y, m - 1, d))
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

function isStgBase(base: string): boolean {
  return base.includes('api-stg') || base.includes('-stg.') || base.includes('localhost')
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { res, json, text }
}

async function fetchJsonWithRetry(url: string, init?: RequestInit, attempts = 3) {
  let last: Awaited<ReturnType<typeof fetchJson>> | null = null
  for (let i = 0; i < attempts; i += 1) {
    last = await fetchJson(url, init)
    if (last.res.ok) return last
    // lightweight backoff for transient Fly/Meili hiccups
    await new Promise((r) => setTimeout(r, 250 * (i + 1)))
  }
  return last!
}

function minutesBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso)
  const end = new Date(endIso)
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

function floorToStep(value: number, step: number): number {
  if (step <= 0) return value
  return Math.floor(value / step) * step
}

test.describe('STG: admin shift -> search UI -> reservation', () => {
  test.skip(!isStgBase(API_BASE), 'STG only: set E2E_API_BASE to stg (no prod writes)')

  test('flow works end-to-end (stg only)', async ({ browser }) => {
    const targetDate = process.env.E2E_DATE || jstDatePlus(14)

    // ---- Step 0: fetch shop name (for search query) ----
    const shopDetail = await fetchJsonWithRetry(`${API_BASE}/api/v1/shops/${SHOP_ID}`, {
      headers: { Accept: 'application/json' },
    })
    expect(shopDetail.res.ok, `shop detail failed: ${shopDetail.res.status}`).toBeTruthy()
    const shopName: string = shopDetail.json?.name || SHOP_ID
    const therapistNameFromShop: string | undefined = Array.isArray(shopDetail.json?.staff)
      ? shopDetail.json.staff.find((s: any) => String(s?.id || '').toLowerCase() === THERAPIST_ID.toLowerCase())?.name
      : undefined
    const therapistName = therapistNameFromShop || `E2E Therapist ${THERAPIST_ID.slice(0, 8)}`

    // ---- Step 1: ensure a future shift exists (admin API, no UI) ----
    const listShifts = await fetchJsonWithRetry(
      `${API_BASE}/api/admin/therapist_shifts?therapist_id=${THERAPIST_ID}&date=${targetDate}`,
      {
        headers: {
          Accept: 'application/json',
          'X-Admin-Key': ADMIN_KEY,
        },
      },
    )
    expect(listShifts.res.ok, `list shifts failed: ${listShifts.res.status}`).toBeTruthy()
    const existing = Array.isArray(listShifts.json?.items) ? listShifts.json.items : []
    if (existing.length === 0) {
      const createShift = await fetchJson(`${API_BASE}/api/admin/therapist_shifts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Admin-Key': ADMIN_KEY,
        },
        body: JSON.stringify({
          therapist_id: THERAPIST_ID,
          shop_id: SHOP_ID,
          date: targetDate,
          start_at: `${targetDate}T10:00:00+09:00`,
          end_at: `${targetDate}T18:00:00+09:00`,
          break_slots: [],
          availability_status: 'available',
        }),
      })
      // 409 is OK (shift already exists due to concurrent runs)
      expect(
        [201, 409].includes(createShift.res.status),
        `create shift failed: ${createShift.res.status} ${createShift.text.slice(0, 200)}`,
      ).toBeTruthy()
    }

    // ---- Step 2: admin_htmx rebuild via UI (htmx partial update) ----
    const adminContext = await browser.newContext({
      extraHTTPHeaders: { 'X-Admin-Key': ADMIN_KEY },
    })
    const adminPage = await adminContext.newPage()
    await adminPage.goto(`${ADMIN_BASE}/admin/htmx/shifts`, { waitUntil: 'domcontentloaded' })

    await adminPage.fill('input[name="therapist_id"]', THERAPIST_ID)
    await adminPage.fill('input[name="date"]', targetDate)
    await adminPage.getByTestId('admin-htmx-shifts-rebuild').click()

    const errorBox = adminPage.locator('#error_box')
    await expect(adminPage.getByTestId('admin-htmx-shifts-slots')).toBeVisible()
    await expect(adminPage.getByTestId('admin-htmx-shifts-slots')).not.toContainText('No slots')
    await expect(errorBox).toHaveText(/^\s*$/)

    await adminContext.close()

    // ---- Step 2.5: ensure staff list exists in shop content, so the search index exposes staff_preview IDs ----
    // In STG, therapists can exist in DB while contact_json.staff is empty (and therapist.status is draft),
    // which results in staff_preview=[] in Meili and /search therapist tab rendering no cards.
    const adminShopDetail = await fetchJsonWithRetry(`${API_BASE}/api/admin/shops/${SHOP_ID}`, {
      headers: {
        Accept: 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
    })
    expect(adminShopDetail.res.ok, `admin shop detail failed: ${adminShopDetail.res.status}`).toBeTruthy()
    const currentStaff: Array<{ id?: string; name?: string; alias?: string; headline?: string; specialties?: string[] }> =
      Array.isArray(adminShopDetail.json?.staff) ? adminShopDetail.json.staff : []
    const hasTherapist = currentStaff.some(
      (s) => String(s?.id || '').toLowerCase() === THERAPIST_ID.toLowerCase(),
    )
    if (!hasTherapist) {
      const updatedStaff = [
        ...currentStaff.map((s) => ({
          id: s.id,
          name: s.name,
          alias: s.alias,
          headline: s.headline,
          specialties: Array.isArray(s.specialties) ? s.specialties : [],
        })),
        { id: THERAPIST_ID, name: therapistName, specialties: [] as string[] },
      ]
      const updateContent = await fetchJsonWithRetry(`${API_BASE}/api/admin/shops/${SHOP_ID}/content`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Admin-Key': ADMIN_KEY,
        },
        body: JSON.stringify({ staff: updatedStaff }),
      })
      expect(updateContent.res.ok, `admin shop content update failed: ${updateContent.res.status}`).toBeTruthy()
    }

    // Wait until the shop search document reflects staff_preview for the target therapist.
    const maxPoll = 10
    let staffPreviewReady = false
    for (let i = 0; i < maxPoll; i += 1) {
      const search = await fetchJsonWithRetry(
        `${API_BASE}/api/v1/shops?q=${encodeURIComponent(shopName)}&page=1&page_size=10`,
        { headers: { Accept: 'application/json' } },
        1,
      )
      const results: any[] = Array.isArray(search.json?.results) ? search.json.results : []
      const found = results.find((r) => r?.id === SHOP_ID)
      const preview: any[] = Array.isArray(found?.staff_preview) ? found.staff_preview : []
      staffPreviewReady = preview.some((p) => String(p?.id || '').toLowerCase() === THERAPIST_ID.toLowerCase())
      if (staffPreviewReady) break
      await new Promise((r) => setTimeout(r, 300))
    }
    expect(staffPreviewReady, 'staff_preview should contain target therapist after reindex').toBeTruthy()

    // ---- Step 3: web search UI reflects availability (no POST) ----
    const webContext = await browser.newContext()
    const page = await webContext.newPage()
    await page.goto(
      `${WEB_BASE}/search?tab=therapists&q=${encodeURIComponent(shopName)}&page=1`,
      { waitUntil: 'networkidle' },
    )

    const card = page.locator(
      `[data-testid="therapist-card"][data-therapist-id="${THERAPIST_ID}"]`,
    )
    await expect(card).toBeVisible()
    await expect(card.getByTestId('therapist-availability-badge')).toBeVisible()
    await expect(card.getByTestId('therapist-cta')).toHaveText(/予約する|読み込み中/)

    await webContext.close()

    // ---- Step 4: create reservation (STG only, single POST) ----
    const slotsRes = await fetchJsonWithRetry(
      `${API_BASE}/api/guest/therapists/${THERAPIST_ID}/availability_slots?date=${targetDate}`,
      { headers: { Accept: 'application/json' } },
    )
    expect(slotsRes.res.ok, `availability_slots failed: ${slotsRes.res.status}`).toBeTruthy()
    const slots: Array<{ start_at: string; end_at: string }> = Array.isArray(slotsRes.json?.slots)
      ? slotsRes.json.slots
      : []
    expect(slots.length, 'expected at least 1 slot').toBeGreaterThan(0)

    const chosen = slots[0]
    const intervalMinutes = minutesBetween(chosen.start_at, chosen.end_at)
    const durationMinutes = Math.min(60, intervalMinutes)
    expect(durationMinutes, 'slot duration must be > 0').toBeGreaterThan(0)

    // NOTE: STG is long-lived and may already have a cancelled/confirmed reservation at the
    // earliest slot start, causing a unique constraint failure. Try a few offsets inside the
    // returned interval to find a free start_at without spamming POSTs.
    const baseMs = new Date(chosen.start_at).getTime()
    const maxOffsetMinutes = Math.max(0, intervalMinutes - durationMinutes)
    const offsets = [
      0,
      floorToStep(Math.floor(maxOffsetMinutes / 2), 15),
      floorToStep(maxOffsetMinutes, 15),
    ].filter((v, i, arr) => arr.indexOf(v) === i)

    let created: { id?: string; status?: string; debug?: any } | null = null
    let lastRejected: any = null

    for (const offsetMinutes of offsets) {
      const startAt = new Date(baseMs + offsetMinutes * 60000).toISOString()
      const res = await fetchJson(`${API_BASE}/api/guest/reservations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          shop_id: SHOP_ID,
          therapist_id: THERAPIST_ID,
          start_at: startAt,
          duration_minutes: durationMinutes,
          planned_extension_minutes: 0,
        }),
      })

      expect(res.res.ok, `reservation create failed: ${res.res.status}`).toBeTruthy()
      const statusVal: string | undefined = res.json?.status
      if (['confirmed', 'pending', 'reserved'].includes(statusVal || '')) {
        created = res.json
        break
      }
      lastRejected = { status: statusVal, reasons: res.json?.debug?.rejected_reasons }
    }

    expect(created, `reservation create rejected: ${JSON.stringify(lastRejected)}`).toBeTruthy()
    const reservationId: string | undefined = created?.id
    expect(reservationId, 'reservation id should be returned').toBeTruthy()

    // Cleanup (STG only): cancel the reservation so the test doesn't poison availability for future runs.
    const cancelRes = await fetchJson(`${API_BASE}/api/guest/reservations/${reservationId}/cancel`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    expect(cancelRes.res.ok, `reservation cancel failed: ${cancelRes.res.status}`).toBeTruthy()
  })
})
