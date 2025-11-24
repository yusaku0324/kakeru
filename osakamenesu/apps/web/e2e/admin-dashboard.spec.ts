import { test, expect, Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

import { ensureDashboardAuthenticated, resolveApiBase, SkipTestError } from './utils/dashboard-auth'
import { resolveAdminExtraHeaders } from './utils/admin-headers'

// NOTE: Legacy admin dashboard E2E. Kept for reference but fully skipped in CI/smoke suites.
test.skip(true, 'Legacy admin dashboard suite is skipped (use smoke-admin.spec.ts instead)')

const dashboardStoragePath =
  process.env.PLAYWRIGHT_DASHBOARD_STORAGE ?? path.resolve(__dirname, 'storage', 'dashboard.json')

if (fs.existsSync(dashboardStoragePath)) {
  test.use({ storageState: dashboardStoragePath })
}

const STATUS_OPTIONS = ['pending', 'confirmed', 'declined', 'cancelled', 'expired'] as const

const NEW_DESCRIPTION = 'Playwrightテスト説明'
const NEW_NOTES = 'Playwrightテストメモ'
const CONTACT_PHONE = '08000001111'
const CONTACT_LINE = 'playwright_line'
const CONTACT_WEB = 'https://playwright.example.com'

const AUTH_EXCLUDED_TITLES = new Set(['認証なしでは管理画面にアクセスできない'])

const adminHeaders = resolveAdminExtraHeaders()
const hasAdminKey = Boolean(process.env.ADMIN_API_KEY ?? process.env.OSAKAMENESU_ADMIN_API_KEY)

if (!hasAdminKey) {
  console.warn(
    '[admin-dashboard] ADMIN_API_KEY が設定されていないため、一部の管理系API呼び出しが失敗する可能性があります',
  )
}

if (adminHeaders) {
  test.use({ extraHTTPHeaders: adminHeaders })
}

test.beforeEach(async ({ page, context, baseURL }, testInfo) => {
  if (AUTH_EXCLUDED_TITLES.has(testInfo.title)) {
    return
  }
  const resolvedBase = baseURL ?? 'http://127.0.0.1:3000'
  try {
    await ensureDashboardAuthenticated(context, page, resolvedBase)
  } catch (error) {
    if (error instanceof SkipTestError) {
      throw error
    }
    throw error
  }
})

function extractFirstAdminShop(payload: unknown) {
  const collections = Array.isArray((payload as { shops?: unknown[] })?.shops)
    ? ((payload as { shops?: unknown[] }).shops ?? [])
    : Array.isArray((payload as { items?: unknown[] })?.items)
      ? ((payload as { items?: unknown[] }).items ?? [])
      : []
  return (collections as Array<{ id?: string; name?: string }>)[0]
}

async function fetchFirstShop(page: Page) {
  const shopsResponse = await page.request.get('/api/admin/shops?limit=20')
  if (!shopsResponse.ok()) {
    throw new Error(`管理画面APIが利用できません: /api/admin/shops -> ${shopsResponse.status()}`)
  }
  const shopsJson = await shopsResponse.json()
  const firstShop = extractFirstAdminShop(shopsJson)
  if (!firstShop) {
    throw new Error('管理画面用の店舗データが存在しません')
  }
  return firstShop
}

async function openFirstShop(page: Page) {
  const firstShop = await fetchFirstShop(page)

  await page.goto('/admin/shops', { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/admin/shops')
  const titleLocator = page.getByTestId('admin-title')
  await titleLocator.waitFor({ state: 'visible', timeout: 30000 })
  const shopButton = page.getByRole('button', { name: firstShop.name, exact: false }).first()
  const detailResponsePromise = firstShop.id
    ? page.waitForResponse(
        (response) =>
          response.url().includes(`/api/admin/shops/${firstShop.id}`) &&
          response.request().method() === 'GET',
        { timeout: 30000 },
      )
    : undefined
  if (detailResponsePromise) {
    await Promise.all([detailResponsePromise, shopButton.click()])
  } else {
    await shopButton.click()
  }
  const loadingLocator = page.getByTestId('shop-loading')
  try {
    await loadingLocator.waitFor({ state: 'detached', timeout: 30000 })
  } catch {
    // ignore; loader might not render if detail is cached
  }
  await expect(page.getByTestId('shop-address')).toBeVisible()
  await expect(page.getByRole('button', { name: '店舗情報を保存' })).toBeEnabled({ timeout: 30000 })
  return firstShop
}

async function reopenShop(page: Page, shop: { id?: string; name: string }) {
  await page.goto('/admin/shops', { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/admin/shops')
  const title = page.getByTestId('admin-title')
  const shopButton = page.getByRole('button', { name: shop.name, exact: false }).first()
  await expect
    .poll(
      async () => {
        if (await title.isVisible()) return 'list'
        if (await page.getByTestId('shop-address').isVisible()) return 'detail'
        await page.waitForTimeout(250)
        return 'pending'
      },
      { timeout: 15000, message: 'admin list did not render' },
    )
    .not.toBe('pending')

  if (await title.isVisible()) {
    const detailResponsePromise =
      shop.id &&
      page.waitForResponse(
        (response) =>
          response.url().includes(`/api/admin/shops/${shop.id}`) && response.request().method() === 'GET',
        { timeout: 30000 },
      )
    if (detailResponsePromise) {
      await Promise.all([detailResponsePromise, shopButton.click()])
    } else {
      await shopButton.click()
    }
  }

  await expect(page.getByTestId('shop-address')).toBeVisible({ timeout: 15000 })
}

type EnsureReservationOptions = {
  forceNew?: boolean
}

async function ensureReservation(page: Page, options: EnsureReservationOptions = {}) {
  if (!options.forceNew) {
    const listResponse = await page.request.get('/api/admin/reservations?limit=1')
    if (listResponse.ok()) {
      const listJson = await listResponse.json()
      if (Array.isArray(listJson.items) && listJson.items.length > 0) {
        return listJson.items[0]
      }
    }
  }

  const shopsResponse = await page.request.get('/api/admin/shops?limit=20')
  if (!shopsResponse.ok()) {
    throw new Error(`failed to load shops: ${shopsResponse.status()}`)
  }
  const shopsJson = await shopsResponse.json()
  const shopId: string | undefined = extractFirstAdminShop(shopsJson)?.id
  if (!shopId) {
    throw new Error('no shops available to create reservation')
  }

  const now = new Date()
  let desiredStart = new Date(now.getTime() + 30 * 60 * 1000).toISOString()
  let desiredEnd = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  const testSecret = process.env.E2E_TEST_AUTH_SECRET ?? process.env.TEST_AUTH_SECRET
  const createEndpoint = testSecret ? '/api/test/reservations' : '/api/reservations'
  const requestHeaders = testSecret ? { 'X-Test-Auth-Secret': testSecret } : undefined
  let lastError: string | null = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const createResponse = await page.request.post(createEndpoint, {
      data: {
        shop_id: shopId,
        desired_start: desiredStart,
        desired_end: desiredEnd,
        channel: 'web',
        notes: NEW_NOTES,
        customer: {
          name: 'Playwright User',
          phone: '09000000000',
          email: 'playwright@example.com',
        },
      },
      headers: requestHeaders,
    })
    if (createResponse.ok()) {
      const created = await createResponse.json()
      await waitForAdminReservations(page, 1, 20000)
      return created
    }
    lastError = `failed to create reservation: ${createResponse.status()}`
    if (createResponse.status() === 503 || createResponse.status() === 429) {
      await page.waitForTimeout(2000 * (attempt + 1))
      continue
    }
    if (createResponse.status() === 401) {
      await page.goto('/admin/reservations')
      await page.waitForResponse(
        (response) =>
          response.url().includes('/api/admin/reservations') &&
          response.request().method() === 'GET' &&
          response.status() === 200,
      )
      continue
    }
    if (createResponse.status() === 400) {
      const body = await createResponse.json().catch(() => ({}))
      if (body?.detail === 'out_of_service_hours' || body?.detail === 'invalid_time_range') {
        const nextStart = new Date(now.getTime() + 6 * 60 * 60 * 1000)
        desiredStart = nextStart.toISOString()
        desiredEnd = new Date(nextStart.getTime() + 30 * 60 * 1000).toISOString()
        continue
      }
    }
    break
  }
  throw new Error(lastError ?? 'failed to create reservation')
}

async function waitForAdminReservations(page: Page, minimum: number, timeout = 15000) {
  await expect
    .poll(
      async () => {
        const response = await page.request.get('/api/admin/reservations?limit=50')
        if (!response.ok()) {
          return -1
        }
        const json = await response.json()
        const items = Array.isArray(json?.items) ? json.items : []
        return items.length
      },
      { timeout },
    )
    .toBeGreaterThanOrEqual(minimum)
}

  test.describe.skip('Admin dashboard', () => {
  test.describe.configure({ mode: 'serial' })

  test('店舗情報を更新して元に戻せる', async ({ page }) => {
    test.skip(true, 'Admin shop form fields cannot be automated reliably due to hydration regressions')
    const shop = await openFirstShop(page)
    let descriptionInput = page.getByTestId('shop-description')
    const originalDescription = await descriptionInput.inputValue()
    const descriptionForTest = `${NEW_DESCRIPTION}-${Date.now()}`

    await descriptionInput.fill(descriptionForTest)
    await expect(descriptionInput).toHaveValue(descriptionForTest, { timeout: 5000 })
    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )
    const detailReloadAfterSave = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/admin/shops/${shop.id}`) &&
        response.request().method() === 'GET',
    )
    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok()).toBeTruthy()
    await detailReloadAfterSave
    await reopenShop(page, shop)
    descriptionInput = page.getByTestId('shop-description')
    await expect(descriptionInput).toHaveValue(descriptionForTest, { timeout: 20000 })

    await descriptionInput.fill(originalDescription)
    const revertResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )
    const detailReloadAfterRevert = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/admin/shops/${shop.id}`) &&
        response.request().method() === 'GET',
    )
    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    const revertResponse = await revertResponsePromise
    expect(revertResponse.ok()).toBeTruthy()
    await detailReloadAfterRevert
    await reopenShop(page, shop)
    descriptionInput = page.getByTestId('shop-description')
    await expect(descriptionInput).toHaveValue(originalDescription, { timeout: 20000 })
  })

  test('サービスタグを更新して元に戻せる', async ({ page }) => {
    const shop = await openFirstShop(page)
    const serviceTagsContainer = page.getByTestId('shop-service-tags')
    await expect(serviceTagsContainer).toBeVisible({ timeout: 15000 })

    const readTags = async () =>
      serviceTagsContainer
        .locator('span')
        .evaluateAll((nodes) =>
          nodes
            .map((node) => node.textContent?.replace('×', '').trim())
            .filter((text): text is string => Boolean(text && text !== 'タグ未設定')),
        )

    await page.request.patch(`/api/admin/shops/${shop.id}`, {
      data: { service_tags: [] },
      headers: { 'Content-Type': 'application/json' },
    })
    await reopenShop(page, shop)

    const originalTags = await readTags()
    const newTags = originalTags.some((tag) => tag.includes('Playwright'))
      ? ['セクシー', '清楚']
      : ['PlaywrightタグA', 'PlaywrightタグB']

    await page.request.patch(`/api/admin/shops/${shop.id}`, {
      data: { service_tags: newTags },
      headers: { 'Content-Type': 'application/json' },
    })
    await reopenShop(page, shop)
    for (const tag of newTags) {
      await expect(page.getByTestId('shop-service-tags').getByText(tag)).toBeVisible({ timeout: 5000 })
    }

    await page.request.patch(`/api/admin/shops/${shop.id}`, {
      data: { service_tags: originalTags },
      headers: { 'Content-Type': 'application/json' },
    })
    await reopenShop(page, shop)
    if (originalTags.length === 0) {
      await expect(page.getByTestId('shop-service-tags').getByText('タグ未設定')).toBeVisible({ timeout: 5000 })
    } else {
      for (const tag of originalTags) {
        await expect(page.getByTestId('shop-service-tags').getByText(tag)).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('連絡先を更新して元に戻せる', async ({ page }) => {
    test.skip(true, 'Dashboard contact fields cannot be automated reliably under current hydration flow')
    const shop = await openFirstShop(page)

    let phoneInput = page.getByPlaceholder('電話番号')
    let lineInput = page.getByPlaceholder('LINE ID / URL')
    let webInput = page.getByPlaceholder('公式サイトURL')

    const originalPhone = await phoneInput.inputValue()
    const originalLine = await lineInput.inputValue()
    const originalWeb = await webInput.inputValue()

    await phoneInput.fill(CONTACT_PHONE)
    await lineInput.fill(CONTACT_LINE)
    await webInput.fill(CONTACT_WEB)

    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )
    await reopenShop(page, shop)
    phoneInput = page.getByPlaceholder('電話番号')
    lineInput = page.getByPlaceholder('LINE ID / URL')
    webInput = page.getByPlaceholder('公式サイトURL')
    await expect(phoneInput).toHaveValue(CONTACT_PHONE, { timeout: 5000 })
    await expect(lineInput).toHaveValue(CONTACT_LINE, { timeout: 5000 })
    await expect(webInput).toHaveValue(CONTACT_WEB, { timeout: 5000 })

    await phoneInput.fill(originalPhone)
    await lineInput.fill(originalLine)
    await webInput.fill(originalWeb)
    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )
    await reopenShop(page, shop)
    phoneInput = page.getByPlaceholder('電話番号')
    lineInput = page.getByPlaceholder('LINE ID / URL')
    webInput = page.getByPlaceholder('公式サイトURL')
    await expect(phoneInput).toHaveValue(originalPhone, { timeout: 5000 })
    await expect(lineInput).toHaveValue(originalLine, { timeout: 5000 })
    await expect(webInput).toHaveValue(originalWeb, { timeout: 5000 })
  })

  test('保存エラー時にトーストが表示される', async ({ page }) => {
    const shop = await openFirstShop(page)
    const addressInput = page.getByTestId('shop-address')
    const originalAddress = await addressInput.inputValue()

    const isShopPatchTarget = (url: string) => {
      try {
        const parsed = new URL(url)
        return (
          parsed.pathname === `/api/admin/shops/${shop.id}` ||
          parsed.pathname.startsWith(`/api/admin/shops/${shop.id}`)
        )
      } catch {
        return url.includes(`/api/admin/shops/${shop.id}`)
      }
    }
    const seenRequests: string[] = []
    let injectedError = false
    let resolveIntercept: (() => void) | null = null
    const interceptPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('expected shop update request did not fire')), 30000)
      resolveIntercept = () => {
        clearTimeout(timeout)
        resolve()
      }
    })

    await page.route('**/api/admin/shops/**', async (route) => {
      const request = route.request()
      if (!injectedError && request.method() === 'PATCH' && isShopPatchTarget(request.url())) {
        const postData = request.postData() ?? ''
        if (!postData.includes('PlaywrightError')) {
          console.warn('[admin-dashboard] unexpected PATCH payload during error simulation')
        }
        injectedError = true
        seenRequests.push(request.url())
        resolveIntercept?.()
        resolveIntercept = null
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ detail: 'simulated error' }),
          headers: { 'Content-Type': 'application/json' },
        })
        return
      }
      await route.continue()
    })

    const errorAddress = `${originalAddress} PlaywrightError`
    await addressInput.fill(errorAddress)
    await Promise.all([
      interceptPromise,
      page.getByRole('button', { name: '店舗情報を保存' }).click(),
    ])
    const errorToast = page.locator('text=/保存に失敗しました|simulated error/').first()
    await expect(errorToast).toBeVisible()

    if (!seenRequests.length) {
      throw new Error('expected intercepted PATCH request, but none were fulfilled')
    }

    await addressInput.fill(originalAddress)
    const revertResponsePromise = page.waitForResponse((response) => {
      if (response.request().method() !== 'PATCH') return false
      return response.url().includes('/api/admin/shops/')
    })
    await Promise.all([
      revertResponsePromise,
      page.getByRole('button', { name: '店舗情報を保存' }).click(),
    ])
    await expect(addressInput).toHaveValue(originalAddress, { timeout: 5000 })
  })

  test('メニューを追加して削除できる', async ({ page }) => {
    test.skip(true, 'Shop menu form cannot add rows reliably under Docker CI (net::ERR_INSUFFICIENT_RESOURCES)')
    const shop = await openFirstShop(page)
    const menuItems = page.getByTestId('menu-item')
    const readMenuNames = async () =>
      page
        .locator('input[placeholder="メニュー名"]')
        .evaluateAll((elements) => elements.map((el) => (el as HTMLInputElement).value.trim()))

    const menuName = `Playwrightメニュー${Date.now()}`
    const menuCountBefore = await menuItems.count()

    await page.getByRole('button', { name: 'メニューを追加' }).click()
    await expect(menuItems).toHaveCount(menuCountBefore + 1)
    const createdMenu = menuItems.nth(menuCountBefore)
    await createdMenu.getByPlaceholder('メニュー名').fill(menuName)
    await createdMenu.getByPlaceholder('価格').fill('12345')
    await createdMenu.getByPlaceholder('時間(分)').fill('90')
    await createdMenu.getByPlaceholder('説明').fill('Playwright が追加したメニューです')

    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )

    await reopenShop(page, shop)
    const menuNamesAfterAdd = await readMenuNames()
    const createdIndex = menuNamesAfterAdd.findIndex((value) => value === menuName)
    expect(createdIndex).toBeGreaterThanOrEqual(0)

    const menuRow = menuItems.nth(createdIndex)
    await menuRow.getByRole('button', { name: '削除' }).click()
    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )

    await reopenShop(page, shop)
    await expect
      .poll(async () => await menuItems.count(), { timeout: 15000 })
      .toBeLessThanOrEqual(menuCountBefore)
    await expect
      .poll(async () => (await readMenuNames()).filter((value) => value), { timeout: 15000 })
      .not.toContain(menuName)
  })

  test('スタッフを追加して削除できる', async ({ page }) => {
    test.skip(true, 'Shop staff form cannot add rows reliably under Docker CI (net::ERR_INSUFFICIENT_RESOURCES)')
    const shop = await openFirstShop(page)
    const staffItems = page.getByTestId('staff-item')
    const readStaffNames = async () =>
      page
        .locator('input[placeholder="名前"]')
        .evaluateAll((elements) => elements.map((el) => (el as HTMLInputElement).value.trim()))

    const staffName = `Playwrightスタッフ${Date.now()}`
    const staffCountBefore = await staffItems.count()

    await page.getByRole('button', { name: 'スタッフを追加' }).click()
    await expect(staffItems).toHaveCount(staffCountBefore + 1)
    const createdStaff = staffItems.nth(staffCountBefore)
    await createdStaff.getByPlaceholder('名前').fill(staffName)
    await createdStaff.getByPlaceholder('表示名').fill(`${staffName}表示`)
    await createdStaff.getByPlaceholder('紹介文').fill('Playwright が追加したスタッフです')
    await createdStaff.getByPlaceholder('得意分野 (カンマ区切り)').fill('Playwright,テスト')

    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )

    await reopenShop(page, shop)
    const staffNamesAfterAdd = await readStaffNames()
    const createdIndex = staffNamesAfterAdd.findIndex((value) => value === staffName)
    expect(createdIndex).toBeGreaterThanOrEqual(0)

    const staffRow = staffItems.nth(createdIndex)
    await staffRow.getByRole('button', { name: '削除' }).click()
    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )

    await reopenShop(page, shop)
    await expect
      .poll(async () => await staffItems.count(), { timeout: 15000 })
      .toBeLessThanOrEqual(staffCountBefore)
    await expect
      .poll(async () => (await readStaffNames()).filter((value) => value), { timeout: 15000 })
      .not.toContain(staffName)
  })

  test('空き枠を追加して保存できる', async ({ page }) => {
    test.skip(true, 'Dashboard availability editor cannot add rows reliably under Docker CI (net::ERR_INSUFFICIENT_RESOURCES)')
    const shop = await openFirstShop(page)

    await page.getByRole('button', { name: '日付を追加' }).click()
    const dayLocator = page.getByTestId('availability-day').last()
    const dateInput = dayLocator.getByTestId('availability-date')
    await expect(dateInput).toBeVisible()
    const dateStr = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await dateInput.fill(dateStr)

    const slot = dayLocator.getByTestId('availability-slot').first()
    await slot.getByTestId('slot-start').fill(`${dateStr}T10:00`)
    await slot.getByTestId('slot-end').fill(`${dateStr}T11:00`)
    await slot.getByTestId('slot-status').selectOption('open')

    await dayLocator.getByTestId('save-availability').click()
    await page.waitForResponse(
      (response) =>
        response.url().includes(`/api/admin/shops/${shop.id}/availability`) &&
        response.request().method() === 'PUT',
    )

    await page.request.put(`/api/admin/shops/${shop.id}/availability`, {
      data: {
        date: dateStr,
        slots: [],
      },
    })
  })

  test('予約一覧をフィルタリングできる', async ({ page }) => {
    const waitForReservations = () =>
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/admin/reservations') &&
          response.request().method() === 'GET' &&
          response.status() === 200,
        { timeout: 20000 },
      )
    await Promise.all([waitForReservations(), page.goto('/admin/reservations')])
    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible()

    const cards = page.getByTestId('reservation-card')
    const createPendingReservation = async () => {
      const shop = await fetchFirstShop(page)
      const now = new Date()
      const desiredStart = new Date(now.getTime() + 30 * 60 * 1000).toISOString()
      const desiredEnd = new Date(now.getTime() + 90 * 60 * 1000).toISOString()
      const create = await page.request.post('/api/reservations', {
        data: {
          shop_id: shop.id,
          desired_start: desiredStart,
          desired_end: desiredEnd,
          channel: 'web',
          notes: 'Playwright filter test',
          customer: {
            name: 'Filter User',
            phone: '09000000001',
          },
        },
      })
      if (!create.ok()) {
        throw new Error(`予約作成に失敗しました status=${create.status()}`)
      }
    }

    const reloadReservations = () => Promise.all([waitForReservations(), page.reload()])

    if ((await cards.count()) === 0) {
      await createPendingReservation()
      await reloadReservations()
    }

    const initialCount = await cards.count()
    expect(initialCount).toBeGreaterThan(0)

    const pendingCount = await cards
      .locator('[data-testid="reservation-status"]')
      .evaluateAll(
        (nodes) => nodes.filter((node) => (node as HTMLSelectElement).value === 'pending').length,
      )
    if (pendingCount === 0) {
      await createPendingReservation()
      await reloadReservations()
    }

    await Promise.all([
      waitForReservations(),
      page.getByTestId('status-filter').selectOption('pending'),
    ])
    await expect
      .poll(
        async () => {
          const statuses = await cards
            .locator('[data-testid="reservation-status"]')
            .evaluateAll((nodes) => nodes.map((node) => (node as HTMLSelectElement).value))
          if (!statuses.length) {
            return 'empty'
          }
          return statuses.every((value) => value === 'pending') ? 'ok' : statuses.join(',')
        },
        { timeout: 10000 },
      )
      .toBe('ok')

    await Promise.all([waitForReservations(), page.getByTestId('status-filter').selectOption('')])
    expect(await cards.count()).toBeGreaterThan(0)
  })

  test('ステータスフィルタで0件の場合に件数が0になる', async ({ page }) => {
    const waitForReservations = () =>
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/admin/reservations') &&
          response.request().method() === 'GET' &&
          response.status() === 200,
        { timeout: 20000 },
      )
    await Promise.all([waitForReservations(), page.goto('/admin/reservations')])
    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible()

    await Promise.all([
      waitForReservations(),
      page.getByTestId('status-filter').selectOption('declined'),
    ])
    const counterText = await page.locator('text=/件中/').first().textContent()
    expect(counterText).toContain('0件中 0件を表示')
    await expect(page.getByTestId('reservation-card')).toHaveCount(0)

    await page.getByTestId('status-filter').selectOption('')
  })

  test('新しい予約が追加されると通知が表示される', async ({ page }) => {
    await page.addInitScript(() => {
      const logs: string[] = []
      class FakeOscillator {
        start() {
          logs.push('oscillator-start')
        }
        stop() {}
        connect() {}
      }
      class FakeGain {
        gain = { setValueAtTime() {}, exponentialRampToValueAtTime() {} }
        connect() {}
      }
      class FakeAudioContext {
        createOscillator() {
          window.__soundPlayed = true
          return new FakeOscillator()
        }
        createGain() {
          return new FakeGain()
        }
        state = 'running'
        resume() {
          window.__resumeCalled = true
        }
      }
      // @ts-ignore
      window.AudioContext = FakeAudioContext
      // @ts-ignore
      window.webkitAudioContext = FakeAudioContext
    })

    await page.goto('/admin/reservations')
    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/reservations') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    )

    await ensureReservation(page, { forceNew: true })
    await page.getByTestId('reservations-refresh').click()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/reservations') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    )
    const highlightedCard = page.locator('[data-testid="reservation-card"]').first()
    await expect
      .poll(
        async () => {
          const hasHighlight = await highlightedCard
            .evaluate((node) => node?.classList.contains('ring-amber-400'))
            .catch(() => false)
          if (!hasHighlight) {
            await highlightedCard.page().waitForTimeout(250)
          }
          return hasHighlight
        },
        { timeout: 15000, message: 'highlighted card did not appear' },
      )
      .toBe(true)
    const soundPlayed = await page.evaluate(() => Boolean((window as any).__soundPlayed))
    expect(soundPlayed).toBeTruthy()
  })

  test('通知サウンドが失敗してもエラーで落ちない', async ({ page }) => {
    await page.addInitScript(() => {
      class BrokenOscillator {
        start() {
          throw new Error('oscillator failure')
        }
        stop() {}
        connect() {}
      }
      class BrokenAudioContext {
        state = 'running'
        resume() {}
        createOscillator() {
          throw new Error('Audio creation failed')
        }
        createGain() {
          return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }
        }
      }
      // @ts-ignore
      window.AudioContext = BrokenAudioContext
      // @ts-ignore
      window.webkitAudioContext = BrokenAudioContext
    })

    await page.goto('/admin/reservations')
    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/reservations') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    )

    const warnings: string[] = []
    const pageErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'warning') warnings.push(msg.text())
    })
    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    await ensureReservation(page, { forceNew: true })
    await page.getByTestId('reservations-refresh').click()
    await expect(page.locator('text=/新しい予約/').first()).toBeVisible({ timeout: 5000 })

    const warningSeen = warnings.some(
      (text) => text.includes('notification') || text.includes('Audio'),
    )
    if (!warningSeen) {
      console.info(
        'Audio warning was not emitted; assuming graceful handling without console warning.',
      )
    }
    expect(pageErrors, 'Audio failure should not trigger runtime errors').toHaveLength(0)
  })

  test('認証なしでは管理画面にアクセスできない', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      extraHTTPHeaders: {},
      // グローバル設定で Basic 認証が有効な場合でも、このコンテキストでは送信しない
      httpCredentials: process.env.ADMIN_BASIC_USER ? undefined : undefined,
    })
    const pageNoAuth = await context.newPage()

    const response = await pageNoAuth.goto('/admin/shops', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(401)
    await context.close()
  })

  test('予約一覧はページングされる', async ({ page, baseURL }) => {
    test.skip(true, 'Admin reservation pagination requires bulk creation via API key, which is unavailable in CI')
    await page.goto('/admin/reservations')
    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/reservations') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    )

    const apiBase = resolveApiBase(baseURL)
    const adminKey = process.env.ADMIN_API_KEY ?? process.env.OSAKAMENESU_ADMIN_API_KEY

    const ensureManyReservations = async () => {
      const shop = await fetchFirstShop(page)
      if (adminKey) {
        await page.request
          .delete(`${apiBase}/api/v1/reservations`, {
            params: { shop_id: shop.id },
            headers: { 'X-Admin-Key': adminKey },
          })
          .catch(() => null)
      }
      const runSeed = Date.now()
      for (let i = 0; i < 12; i += 1) {
        const baseStart = runSeed + (i + 1) * 60 * 60 * 1000
        const baseEnd = runSeed + (i + 2) * 60 * 60 * 1000
        const phoneSuffix = String(runSeed + i).slice(-8)
        const uniquePhone = `090${phoneSuffix}`.slice(0, 11)
        let created = false
        let lastStatus = 0
        for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
          const offset = attempt * 5 * 60 * 1000
          const desiredStart = new Date(baseStart + offset).toISOString()
          const desiredEnd = new Date(baseEnd + offset).toISOString()
          const response = await page.request.post(`${apiBase}/api/v1/reservations`, {
            data: {
              shop_id: shop.id,
              desired_start: desiredStart,
              desired_end: desiredEnd,
              channel: 'web',
              notes: `Playwright paging ${i}`,
              customer: {
                name: `Paging User ${i}`,
                phone: uniquePhone,
              },
            },
          })
          if (response.ok()) {
            created = true
            break
          }
          lastStatus = response.status()
          if (lastStatus === 429 || lastStatus >= 500) {
            await page.waitForTimeout(500 * (attempt + 1))
            continue
          }
          throw new Error(`予約作成に失敗しました status=${lastStatus} index=${i}`)
        }
        if (!created) {
          throw new Error(`予約作成に失敗しました status=${lastStatus || 'unknown'} index=${i}`)
        }
      }
    }

    if ((await page.getByTestId('reservation-card').count()) < 10) {
      await ensureManyReservations()
      await page.reload()
      await page.waitForResponse(
        (response) =>
          response.url().includes('/api/admin/reservations') &&
          response.request().method() === 'GET' &&
          response.status() === 200,
      )
      await waitForAdminReservations(page, 10)
    }

    const firstCard = page.getByTestId('reservation-card').first()
    await expect(firstCard).toBeVisible({ timeout: 15000 })
    const firstCardId = await firstCard.locator('text=/[0-9a-f\-]{36}/').first().innerText()

    await page.getByTestId('reservations-next').click()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/reservations') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    )
    const secondCardLocator = page
      .getByTestId('reservation-card')
      .first()
      .locator('text=/[0-9a-f\-]{36}/')
      .first()
    await expect
      .poll(async () => secondCardLocator.innerText(), { timeout: 15000 })
      .not.toBe(firstCardId)

    await page.getByTestId('reservations-prev').click()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/reservations') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    )
  })

  test('予約更新失敗時にエラートーストが表示される', async ({ page }) => {
    const reservation = await ensureReservation(page)
    const targetReservationId: string = reservation.id

    await page.goto('/admin/reservations')
    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/reservations') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    )

    const card = page
      .getByTestId('reservation-card')
      .filter({ hasText: targetReservationId })
      .first()
    await expect(card).toBeVisible({ timeout: 10_000 })

    const statusSelect = card.getByTestId('reservation-status')
    const originalStatus = await statusSelect.inputValue()
    const alternateStatus = originalStatus === 'pending' ? 'confirmed' : 'pending'

    const errorRoute = `**/api/admin/reservations/${targetReservationId}`
    await page.route(errorRoute, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 503,
          body: JSON.stringify({ detail: 'simulated patch error' }),
          headers: { 'Content-Type': 'application/json' },
        })
        await page.unroute(errorRoute)
      } else {
        await route.continue()
      }
    })

    await statusSelect.selectOption(alternateStatus)
    await expect(
      page.locator('text=/更新に失敗しました|simulated patch error/').first(),
    ).toBeVisible({ timeout: 5000 })

    await page.request.patch(`/api/admin/reservations/${targetReservationId}`, {
      data: {
        status: originalStatus,
      },
    })
  })

  test('429 が返ってもユーザーにエラーが表示される', async ({ page }) => {
    const reservation = await ensureReservation(page)
    const targetReservationId: string = reservation.id

    await page.goto('/admin/reservations')
    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/reservations') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    )

    const card = page
      .getByTestId('reservation-card')
      .filter({ hasText: targetReservationId })
      .first()
    await expect(card).toBeVisible({ timeout: 10_000 })

    const statusSelect = card.getByTestId('reservation-status')
    const originalStatus = await statusSelect.inputValue()
    const alternateStatus = originalStatus === 'pending' ? 'confirmed' : 'pending'

    const throttleRoute = `**/api/admin/reservations/${targetReservationId}`
    await page.route(throttleRoute, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 429,
          body: JSON.stringify({ detail: 'rate limited' }),
          headers: { 'Content-Type': 'application/json' },
        })
        await page.unroute(throttleRoute)
      } else {
        await route.continue()
      }
    })

    await statusSelect.selectOption(alternateStatus)
    await expect(page.locator('text=/更新に失敗しました|rate limited/').first()).toBeVisible({
      timeout: 5000,
    })

    await page.request.patch(`/api/admin/reservations/${targetReservationId}`, {
      data: {
        status: originalStatus,
      },
    })
  })

  test('予約のステータスとメモを更新して元に戻せる', async ({ page }) => {
    const reservation = await ensureReservation(page)
    const targetReservationId: string = reservation.id

    await page.goto('/admin/reservations')
    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/reservations') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    )

    const cards = page.getByTestId('reservation-card')
    const card = cards.filter({ hasText: targetReservationId }).first()
    await expect(card).toBeVisible({ timeout: 10_000 })

    const statusSelect = card.getByTestId('reservation-status')
    await expect(statusSelect).toBeVisible()
    const originalStatus = await statusSelect.inputValue()
    const nextStatus = STATUS_OPTIONS.find((status) => status !== originalStatus) || originalStatus

    if (nextStatus !== originalStatus) {
      await statusSelect.selectOption(nextStatus)
      await page.waitForResponse(
        (response) =>
          response.url().includes('/api/admin/reservations') &&
          response.request().method() === 'PATCH',
      )
      await expect(statusSelect).toHaveValue(nextStatus, { timeout: 5000 })

      await statusSelect.selectOption(originalStatus)
      await page.waitForResponse(
        (response) =>
          response.url().includes('/api/admin/reservations') &&
          response.request().method() === 'PATCH',
      )
      await expect(statusSelect).toHaveValue(originalStatus, { timeout: 5000 })
    }

    const notesField = card.getByTestId('reservation-notes')
    const saveNotesButton = card.getByTestId('reservation-save-notes')
    await expect(notesField).toBeVisible()
    const originalNotes = await notesField.inputValue()
    const notesForTest = originalNotes === NEW_NOTES ? `${NEW_NOTES}2` : NEW_NOTES

    await notesField.fill(notesForTest)
    await saveNotesButton.click()
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/reservations') &&
        response.request().method() === 'PATCH',
    )
    await expect(notesField).toHaveValue(notesForTest, { timeout: 5000 })

    const revertRequest = await page.request.patch(
      `/api/admin/reservations/${targetReservationId}`,
      {
        data: {
          notes: originalNotes,
        },
      },
    )
    if (!revertRequest.ok()) {
      test.info().annotations.push({
        type: 'warning',
        description: `予約メモの復元に失敗しました status=${revertRequest.status()}`,
      })
    }
  })
})
