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

  const staffSlug = 'sample-namba-resort'
  const staffId = '11111111-1111-1111-8888-111111111111'
  const staffUrlWithSamples = `${baseURL}/profiles/${staffSlug}/staff/${staffId}?force_samples=1&force_demo_submit=1`
  await page.goto(staffUrlWithSamples)
  await expect(page).toHaveURL(/force_samples=1/)
  await page.waitForLoadState('load')

  const reserveButton = page.getByRole('button', { name: /の予約詳細を開く/ }).first()

  await expect(reserveButton).toBeVisible({ timeout: 15000 })
  await reserveButton.click()

  const overlay = page.getByRole('dialog', { name: /の予約詳細/ }).first()
  await expect(overlay).toBeVisible({ timeout: 15000 })

  await overlay.getByRole('button', { name: '空き状況・予約' }).click()

  const slotButton = overlay.locator('[aria-label*="予約可"], [aria-label*="要確認"]').first()
  await slotButton.click()

  await expect(overlay.getByText(/第1候補/)).toBeVisible()

  const formOpenButton = overlay
    .getByRole('button', { name: /予約フォーム(へ|に)進む|予約フォームを開く/ })
    .first()
  await formOpenButton.click()

  const formDialog = page.getByRole('dialog', { name: /の予約フォーム/ }).first()
  await expect(formDialog).toBeVisible({ timeout: 15000 })

  const nameField = formDialog.getByPlaceholder('例: 山田 太郎')
  await expect(nameField).toBeVisible()
  await nameField.fill('E2E テスター')

  const phoneField = formDialog.getByPlaceholder('090-1234-5678')
  await expect(phoneField).toBeVisible()
  await phoneField.fill('09012345678')

  await formDialog.getByRole('button', { name: '予約リクエストを送信' }).click()

  await expect(page.getByText('送信が完了しました。店舗からの折り返しをお待ちください。')).toBeVisible()
})
