import { test, expect, Page } from '@playwright/test'

const STATUS_OPTIONS = ['pending', 'confirmed', 'declined', 'cancelled', 'expired'] as const

const NEW_ADDRESS = 'Playwrightテスト住所'
const NEW_NOTES = 'Playwrightテストメモ'
const CONTACT_PHONE = '08000001111'
const CONTACT_LINE = 'playwright_line'
const CONTACT_WEB = 'https://playwright.example.com'

async function fetchFirstShop(page: Page) {
  const shopsResponse = await page.request.get('/api/admin/shops')
  if (!shopsResponse.ok()) {
    test.info().skip(`管理画面APIが利用できないためスキップ: /api/admin/shops -> ${shopsResponse.status()}`)
  }
  const shopsJson = await shopsResponse.json()
  const firstShop = shopsJson.items?.[0]
  if (!firstShop) {
    test.info().skip('管理画面用の店舗データが存在しないためスキップします')
  }
  return firstShop
}

async function openFirstShop(page: Page) {
  const firstShop = await fetchFirstShop(page)

  await page.goto('/admin/shops')
  await expect(page.getByRole('heading', { name: '店舗管理' })).toBeVisible()
  await page.getByRole('button', { name: firstShop.name, exact: false }).first().click()
  await expect(page.getByTestId('shop-address')).toBeVisible()
  return firstShop
}

async function reopenShop(page: Page, shopName: string) {
  await page.goto('/admin/shops')
  await expect(page.getByRole('heading', { name: '店舗管理' })).toBeVisible()
  await page.getByRole('button', { name: shopName, exact: false }).first().click()
  await expect(page.getByTestId('shop-address')).toBeVisible()
}

async function ensureReservation(page: Page) {
  const listResponse = await page.request.get('/api/admin/reservations?limit=1')
  if (listResponse.ok()) {
    const listJson = await listResponse.json()
    if (Array.isArray(listJson.items) && listJson.items.length > 0) {
      return listJson.items[0]
    }
  }

  const shopsResponse = await page.request.get('/api/admin/shops')
  if (!shopsResponse.ok()) {
    throw new Error(`failed to load shops: ${shopsResponse.status()}`)
  }
  const shopsJson = await shopsResponse.json()
  const shopId: string | undefined = shopsJson.items?.[0]?.id
  if (!shopId) {
    throw new Error('no shops available to create reservation')
  }

  const now = new Date()
  const desiredStart = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  const desiredEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
    const createResponse = await page.request.post('/api/reservations', {
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
  })
  if (!createResponse.ok()) {
    throw new Error(`failed to create reservation: ${createResponse.status()}`)
  }
  const createdReservation = await createResponse.json()
  return createdReservation
}

test.describe('Admin dashboard', () => {
  test.skip(!process.env.ADMIN_BASIC_USER || !process.env.ADMIN_BASIC_PASS, 'ADMIN_BASIC_USER / ADMIN_BASIC_PASS が必要です')
  test.describe.configure({ mode: 'serial' })

  test('店舗情報を更新して元に戻せる', async ({ page }) => {
    const shop = await openFirstShop(page)
    let addressInput = page.getByTestId('shop-address')

    const originalAddress = await addressInput.inputValue()
    const addressForTest = `${NEW_ADDRESS}-${Date.now()}`

    await addressInput.fill(addressForTest)
    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    const saveResponse = await page.waitForResponse(
      (response) => response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )
    expect(saveResponse.ok()).toBeTruthy()
    await reopenShop(page, shop.name)
    addressInput = page.getByTestId('shop-address')
    await expect.poll(async () => await addressInput.inputValue(), { timeout: 20000 }).toBe(addressForTest)

    await addressInput.fill(originalAddress)
    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    const revertResponse = await page.waitForResponse(
      (response) => response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )
    expect(revertResponse.ok()).toBeTruthy()
    await reopenShop(page, shop.name)
    addressInput = page.getByTestId('shop-address')
    await expect.poll(async () => await addressInput.inputValue(), { timeout: 20000 }).toBe(originalAddress)
  })

  test('サービスタグを更新して元に戻せる', async ({ page }) => {
    const shop = await openFirstShop(page)
    const serviceTagsContainer = page.getByTestId('shop-service-tags')
    const serviceTagInput = page.getByPlaceholder('例: 指圧, アロマ')
    const addTagButton = page.getByRole('button', { name: /^追加$/ })

    await expect(serviceTagsContainer).toBeVisible({ timeout: 15000 })
    await expect(serviceTagInput).toBeVisible({ timeout: 15000 })

    const readTags = async () =>
      serviceTagsContainer.locator('span').evaluateAll((nodes) =>
        nodes
          .map((node) => node.textContent?.replace('×', '').trim())
          .filter((text): text is string => Boolean(text && text !== 'タグ未設定')),
      )

    const clearTags = async () => {
      const removeButtons = serviceTagsContainer.getByRole('button', { name: /を削除$/ })
      while ((await removeButtons.count()) > 0) {
        const before = await removeButtons.count()
        await removeButtons.first().click()
        await expect(removeButtons).toHaveCount(Math.max(before - 1, 0), { timeout: 5000 })
      }
      await expect(removeButtons).toHaveCount(0, { timeout: 5000 })
    }

    const setTags = async (tags: string[]) => {
      await clearTags()
      for (const tag of tags) {
        await serviceTagInput.fill(tag)
        await addTagButton.click()
        await expect(serviceTagsContainer.locator('span').filter({ hasText: tag }).first()).toBeVisible({ timeout: 5000 })
      }
    }

    const originalTags = await readTags()
    const newTags = originalTags.some((tag) => tag.includes('Playwright'))
      ? ['セクシー', '清楚']
      : ['PlaywrightタグA', 'PlaywrightタグB']

    await setTags(newTags)
    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    await page.waitForResponse(
      (response) => response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )
    await reopenShop(page, shop.name)
    const serviceTagsAfterSave = page.getByTestId('shop-service-tags')
    await expect
      .poll(async () =>
        serviceTagsAfterSave.locator('span').evaluateAll((nodes) =>
          nodes
            .map((node) => node.textContent?.replace('×', '').trim())
            .filter((text): text is string => Boolean(text)),
        ),
      )
      .toEqual(newTags)

    await setTags(originalTags)
    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    await page.waitForResponse(
      (response) => response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )
    await reopenShop(page, shop.name)
    const serviceTagsAfterRevert = page.getByTestId('shop-service-tags')
    await expect
      .poll(async () =>
        serviceTagsAfterRevert.locator('span').evaluateAll((nodes) =>
          nodes
            .map((node) => node.textContent?.replace('×', '').trim())
            .filter((text): text is string => Boolean(text)),
        ),
      )
      .toEqual(originalTags)
  })

  test('連絡先を更新して元に戻せる', async ({ page }) => {
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
      (response) => response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )
    await reopenShop(page, shop.name)
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
      (response) => response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )
    await reopenShop(page, shop.name)
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

    const errorRoute = `**/api/admin/shops/${shop.id}`
    const handler = async (route: any) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ detail: 'simulated error' }),
          headers: { 'Content-Type': 'application/json' },
        })
        await page.unroute(errorRoute, handler)
      } else {
        await route.continue()
      }
    }
    await page.route(errorRoute, handler)

    await addressInput.fill(`${originalAddress} PlaywrightError`)
    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    const errorResponse = await page.waitForResponse((response) =>
      response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )
    expect(errorResponse.status()).toBe(500)
    const errorToast = page.locator('text=/保存に失敗しました|simulated error/').first()
    await expect(errorToast).toBeVisible()

    await addressInput.fill(originalAddress)
    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    await page.waitForResponse(
      (response) => response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )
    await expect(addressInput).toHaveValue(originalAddress, { timeout: 5000 })
  })

  test('メニューを追加して削除できる', async ({ page }) => {
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
      (response) => response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )

    await reopenShop(page, shop.name)
    const menuNamesAfterAdd = await readMenuNames()
    const createdIndex = menuNamesAfterAdd.findIndex((value) => value === menuName)
    expect(createdIndex).toBeGreaterThanOrEqual(0)

    const menuRow = menuItems.nth(createdIndex)
    await menuRow.getByRole('button', { name: '削除' }).click()
    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    await page.waitForResponse(
      (response) => response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )

    await reopenShop(page, shop.name)
    await expect
      .poll(async () => await menuItems.count(), { timeout: 15000 })
      .toBeLessThanOrEqual(menuCountBefore)
    await expect
      .poll(async () => (await readMenuNames()).filter((value) => value), { timeout: 15000 })
      .not.toContain(menuName)
  })

  test('スタッフを追加して削除できる', async ({ page }) => {
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
      (response) => response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )

    await reopenShop(page, shop.name)
    const staffNamesAfterAdd = await readStaffNames()
    const createdIndex = staffNamesAfterAdd.findIndex((value) => value === staffName)
    expect(createdIndex).toBeGreaterThanOrEqual(0)

    const staffRow = staffItems.nth(createdIndex)
    await staffRow.getByRole('button', { name: '削除' }).click()
    await page.getByRole('button', { name: '店舗情報を保存' }).click()
    await page.waitForResponse(
      (response) => response.url().includes('/api/admin/shops/') && response.request().method() === 'PATCH',
    )

    await reopenShop(page, shop.name)
    await expect
      .poll(async () => await staffItems.count(), { timeout: 15000 })
      .toBeLessThanOrEqual(staffCountBefore)
    await expect
      .poll(async () => (await readStaffNames()).filter((value) => value), { timeout: 15000 })
      .not.toContain(staffName)
  })

  test('空き枠を追加して保存できる', async ({ page }) => {
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
    if ((await cards.count()) === 0) {
      const shop = await openFirstShop(page)
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
        test.skip(true, `予約作成に失敗しました status=${create.status()}`)
      }
      await Promise.all([waitForReservations(), page.reload()])
    }

    const initialCount = await cards.count()
    expect(initialCount).toBeGreaterThan(0)

    await Promise.all([
      waitForReservations(),
      page.getByTestId('status-filter').selectOption('pending'),
    ])
    const filteredCount = await cards.count()
    expect(filteredCount).toBeGreaterThan(0)
    for (let i = 0; i < filteredCount; i += 1) {
      await expect(cards.nth(i).getByTestId('reservation-status')).toHaveValue('pending')
    }

    await Promise.all([
      waitForReservations(),
      page.getByTestId('status-filter').selectOption(''),
    ])
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
        start() { logs.push('oscillator-start') }
        stop() {}
        connect() {}
      }
      class FakeGain {
        gain = { setValueAtTime() {}, exponentialRampToValueAtTime() {} }
        connect() {}
      }
      class FakeAudioContext {
        createOscillator() { window.__soundPlayed = true; return new FakeOscillator() }
        createGain() { return new FakeGain() }
        state = 'running'
        resume() { window.__resumeCalled = true }
      }
      // @ts-ignore
      window.AudioContext = FakeAudioContext
      // @ts-ignore
      window.webkitAudioContext = FakeAudioContext
    })

    await page.goto('/admin/reservations')
    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible()
    await page.waitForResponse((response) =>
      response.url().includes('/api/admin/reservations') && response.request().method() === 'GET' && response.status() === 200,
    )

    await ensureReservation(page)
    await page.getByTestId('reservations-refresh').click()
    await expect(page.locator('text=/新しい予約/').first()).toBeVisible({ timeout: 5000 })
    const soundPlayed = await page.evaluate(() => Boolean((window as any).__soundPlayed))
    expect(soundPlayed).toBeTruthy()
  })

  test('通知サウンドが失敗してもエラーで落ちない', async ({ page }) => {
    await page.addInitScript(() => {
      class BrokenOscillator {
        start() { throw new Error('oscillator failure') }
        stop() {}
        connect() {}
      }
      class BrokenAudioContext {
        state = 'running'
        resume() {}
        createOscillator() { throw new Error('Audio creation failed') }
        createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } }
      }
      // @ts-ignore
      window.AudioContext = BrokenAudioContext
      // @ts-ignore
      window.webkitAudioContext = BrokenAudioContext
    })

    await page.goto('/admin/reservations')
    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible()
    await page.waitForResponse((response) =>
      response.url().includes('/api/admin/reservations') && response.request().method() === 'GET' && response.status() === 200,
    )

    const warnings: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'warning') warnings.push(msg.text())
    })

    await ensureReservation(page)
    await page.getByTestId('reservations-refresh').click()
    await expect(page.locator('text=/新しい予約/').first()).toBeVisible({ timeout: 5000 })

    expect(warnings.some((text) => text.includes('notification') || text.includes('Audio'))).toBeTruthy()
  })

  test('認証なしでは管理画面にアクセスできない', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, extraHTTPHeaders: {} })
    const pageNoAuth = await context.newPage()

    const response = await pageNoAuth.goto('/admin/shops', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(401)
    await context.close()
  })

  test('予約一覧はページングされる', async ({ page }) => {
    await page.goto('/admin/reservations')
    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible()
    await page.waitForResponse((response) =>
      response.url().includes('/api/admin/reservations') && response.request().method() === 'GET' && response.status() === 200,
    )

    const ensureManyReservations = async () => {
      const shop = await fetchFirstShop(page)
      for (let i = 0; i < 12; i += 1) {
        const now = new Date()
        const desiredStart = new Date(now.getTime() + (i + 1) * 60 * 60 * 1000).toISOString()
        const desiredEnd = new Date(now.getTime() + (i + 2) * 60 * 60 * 1000).toISOString()
        await page.request.post('/api/reservations', {
          data: {
            shop_id: shop.id,
            desired_start: desiredStart,
            desired_end: desiredEnd,
            channel: 'web',
            notes: `Playwright paging ${i}`,
            customer: {
              name: `Paging User ${i}`,
              phone: `09000000${(100 + i).toString().slice(-3)}`,
            },
          },
        })
      }
    }

    if (await page.getByTestId('reservation-card').count() < 10) {
      await ensureManyReservations()
      await page.reload()
      await page.waitForLoadState('networkidle')
    }

    const firstCardId = await page.getByTestId('reservation-card').first().locator('text=/[0-9a-f\-]{36}/').first().innerText()

    await page.getByTestId('reservations-next').click()
    await page.waitForResponse((response) =>
      response.url().includes('/api/admin/reservations') && response.request().method() === 'GET' && response.status() === 200,
    )
    const secondCardId = await page.getByTestId('reservation-card').first().locator('text=/[0-9a-f\-]{36}/').first().innerText()
    expect(secondCardId).not.toBe(firstCardId)

    await page.getByTestId('reservations-prev').click()
    await page.waitForResponse((response) =>
      response.url().includes('/api/admin/reservations') && response.request().method() === 'GET' && response.status() === 200,
    )
  })

  test('予約更新失敗時にエラートーストが表示される', async ({ page }) => {
    const reservation = await ensureReservation(page)
    const targetReservationId: string = reservation.id

    await page.goto('/admin/reservations')
    await expect(page.getByRole('heading', { name: '予約管理' })).toBeVisible()
    await page.waitForResponse((response) =>
      response.url().includes('/api/admin/reservations') && response.request().method() === 'GET' && response.status() === 200,
    )

    const card = page.getByTestId('reservation-card').filter({ hasText: targetReservationId }).first()
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
    await expect(page.locator('text=/更新に失敗しました|simulated patch error/').first()).toBeVisible({ timeout: 5000 })

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
    await page.waitForResponse((response) =>
      response.url().includes('/api/admin/reservations') && response.request().method() === 'GET' && response.status() === 200,
    )

    const card = page.getByTestId('reservation-card').filter({ hasText: targetReservationId }).first()
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
    await expect(page.locator('text=/更新に失敗しました|rate limited/').first()).toBeVisible({ timeout: 5000 })

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
    await page.waitForResponse((response) =>
      response.url().includes('/api/admin/reservations') && response.request().method() === 'GET' && response.status() === 200,
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
        (response) => response.url().includes('/api/admin/reservations') && response.request().method() === 'PATCH',
      )
      await expect(statusSelect).toHaveValue(nextStatus, { timeout: 5000 })

      await statusSelect.selectOption(originalStatus)
      await page.waitForResponse(
        (response) => response.url().includes('/api/admin/reservations') && response.request().method() === 'PATCH',
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
      (response) => response.url().includes('/api/admin/reservations') && response.request().method() === 'PATCH',
    )
    await expect(notesField).toHaveValue(notesForTest, { timeout: 5000 })

    const revertRequest = await page.request.patch(`/api/admin/reservations/${targetReservationId}`, {
      data: {
        notes: originalNotes,
      },
    })
    if (!revertRequest.ok()) {
      test.info().annotations.push({
        type: 'warning',
        description: `予約メモの復元に失敗しました status=${revertRequest.status()}`,
      })
    }
  })
})
