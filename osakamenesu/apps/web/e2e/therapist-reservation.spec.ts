import { test, expect } from '@playwright/test'

/**
 * This spec verifies that therapist cards on the search page navigate to the
 * staff detail view and that the reservation form can be submitted (with the
 * network call mocked).
 */
test('therapist card navigates to staff page and reservation can be sent', async ({ page, baseURL }) => {
  await page.route('**/api/reservations', async (route) => {
    await route.fulfill({ status: 201, body: JSON.stringify({ id: 'e2e-reservation' }) })
  })

  await page.goto(`${baseURL}/search?force_samples=1`)

  const therapistCards = page.getByTestId('therapist-card')
  const cardCount = await therapistCards.count()
  if (!cardCount) {
    test.info().skip('セラピストカードが表示されなかったためスキップします（サンプルデータ未設定）')
  }
  const therapistCard = therapistCards.first()
  await expect(therapistCard).toBeVisible()

  const staffLink = therapistCard.locator('a').first()
  const targetHref = await staffLink.getAttribute('href')
  await expect(targetHref).toContain('/profiles/')
  await expect(targetHref).toContain('/staff/')

  await staffLink.click()
  await expect(page).toHaveURL(/\/profiles\/.+\/staff\//)
  await page.waitForLoadState('networkidle')
  const currentStaffUrl = page.url()
  const staffUrlWithOverride = currentStaffUrl.includes('?')
    ? `${currentStaffUrl}&force_demo_submit=1`
    : `${currentStaffUrl}?force_demo_submit=1`
  await page.goto(staffUrlWithOverride)
  await expect(page).toHaveURL(/force_demo_submit=1/)
  await expect(page.getByText('WEB予約リクエスト')).toBeVisible({ timeout: 15000 })

  const nameField = page.getByPlaceholder('例: 山田 太郎')
  await expect(nameField).toBeVisible()
  await nameField.fill('E2E テスター')

  const phoneField = page.getByPlaceholder('090...')
  await expect(phoneField).toBeVisible()
  await phoneField.fill('09012345678')

  await page.getByRole('button', { name: '予約リクエストを送信' }).click()

  await expect(page.getByText('送信が完了しました。店舗からの折り返しをお待ちください。')).toBeVisible()
})
