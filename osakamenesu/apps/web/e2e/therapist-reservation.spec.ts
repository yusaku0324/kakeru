import { test, expect } from '@playwright/test'

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

  const nameField = page.getByLabel('お名前 *')
  await expect(nameField).toBeVisible({ timeout: 15000 })
  await nameField.fill('E2E テスター')

  const phoneField = page.getByLabel('お電話番号 *')
  await phoneField.fill('09012345678')

  const emailField = page.getByLabel('メールアドレス')
  await emailField.fill('tester@example.com')

  const durationSelect = page.getByLabel('利用時間 *')
  await durationSelect.selectOption({ label: '120分' })

  const noteField = page.getByLabel('ご要望・指名など 任意', { exact: false }).or(
    page.getByPlaceholder('指名やオプションの希望などがあればご記入ください'),
  )
  await noteField.fill('Playwright からのリクエストです')

  await page.getByRole('button', { name: '予約リクエストを送信' }).click()

  await expect(page.getByText('送信が完了しました。店舗からの折り返しをお待ちください。')).toBeVisible()
})
