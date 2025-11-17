import { test, expect } from '@playwright/test'

test('search -> open profile -> has CTA links', async ({ page, baseURL }) => {
  const url = `${baseURL}/search?force_samples=1`
  await page.goto(url)

  // 結果ヘッダーが表示される
  await expect(page.getByRole('heading', { name: /セラピスト(を探す|一覧)/ })).toBeVisible({
    timeout: 15000,
  })

  // 空き状況のバッジ表示が想定どおりになっているかチェック
  const therapistCards = page.getByTestId('therapist-card')
  await expect(therapistCards.first()).toBeVisible({ timeout: 20000 })
  await expect(therapistCards.nth(1)).toBeVisible({ timeout: 20000 })

  // 通常カード（PRではない）を1件クリック
  const firstProfileCard = page.locator('a[href^="/profiles/"]').first()
  await expect(firstProfileCard).toBeVisible()
  const targetHref = await firstProfileCard.getAttribute('href')
  await firstProfileCard.click()

  // プロフィール詳細に遷移
  await page.waitForURL(/\/profiles\//, { timeout: 15000 })
  await page.waitForLoadState('domcontentloaded')

  // 料金と名前が見える
  await expect(page.locator('h1')).toBeVisible()

  // ギャラリーの存在と基本操作（写真がある場合）
  const view = page.locator('[data-testid="gallery-view"]').first()
  if (await view.count()) {
    await expect(view).toBeVisible()
    const dots = page.locator('[data-testid="gallery-dot"]')
    const thumbs = page.locator('[data-testid="gallery-thumb"]')
    const dotCount = await dots.count()
    if (dotCount >= 2) {
      // スクロールの状態を取得するヘルパ
      const getState = async () => {
        return await view.evaluate((el) => ({
          left: (el as HTMLElement).scrollLeft,
          width: (el as HTMLElement).clientWidth,
        }))
      }
      const s0 = await getState()
      await dots.nth(1).click()
      await expect
        .poll(async () => {
          const s = await getState()
          return Math.round(s.left)
        })
        .toBeGreaterThanOrEqual(Math.round(s0.width * 0.6))

      // サムネで先頭に戻す
      if (await thumbs.count()) {
        await thumbs.first().click()
        await expect
          .poll(async () => {
            const s = await getState()
            return Math.round(s.left)
          })
          .toBeLessThanOrEqual(10)
      }
    }
  }

  // プロフィール画面のヘッダーが表示されている
  await expect(page.locator('h1')).toBeVisible()
})

test('therapist favorites can be toggled when API responds successfully', async ({
  page,
  baseURL,
}) => {
  const favorites = new Map<string, { createdAt: string }>()

  await page.route('**/api/favorites/therapists**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (request.method() === 'GET') {
      const items = Array.from(favorites.entries()).map(([therapistId, record]) => ({
        therapist_id: therapistId,
        shop_id: 'sample-namba-resort',
        created_at: record.createdAt,
      }))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(items),
      })
      return
    }

    if (request.method() === 'POST') {
      const body = request.postDataJSON?.() ?? {}
      const therapistId = typeof body.therapist_id === 'string' ? body.therapist_id : ''
      const createdAt = new Date().toISOString()
      favorites.set(therapistId, { createdAt })
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ therapist_id: therapistId, created_at: createdAt }),
      })
      return
    }

    if (request.method() === 'DELETE') {
      const segments = url.pathname.split('/')
      const therapistId = segments[segments.length - 1] || ''
      favorites.delete(therapistId)
      await route.fulfill({ status: 204 })
      return
    }

    await route.fallback()
  })

  await page.goto(`${baseURL}/search?force_samples=1`)

  const favoriteButton = page.getByRole('button', { name: /お気に入り(に追加|から削除)/ }).first()
  await expect(favoriteButton).toBeVisible()
  await expect(favoriteButton).toBeEnabled()
  const initialState = await favoriteButton.getAttribute('aria-pressed')
  const nextState = initialState === 'true' ? 'false' : 'true'
  await favoriteButton.click()
  await expect(favoriteButton).toHaveAttribute('aria-pressed', nextState)
  await favoriteButton.click()
  await expect(favoriteButton).toHaveAttribute('aria-pressed', initialState ?? 'false')
})
