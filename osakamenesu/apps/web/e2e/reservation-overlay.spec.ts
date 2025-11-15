import { test, expect } from '@playwright/test'

test.describe('Reservation overlay interactions', () => {
  test('selecting availability opens form and persists selection', async ({ page, baseURL }) => {
    await page.route('**/api/reservations', async (route) => {
      await route.fulfill({ status: 201, body: JSON.stringify({ id: 'overlay-e2e' }) })
    })

    const shopId = process.env.E2E_SAMPLE_SHOP_ID || 'sample-namba-resort'
    await page.goto(`${baseURL}/profiles/${shopId}`)

    const overlayTrigger = page.getByRole('button', { name: /Web予約する|空き状況を問い合わせる/ })
    await expect(overlayTrigger).toBeVisible({ timeout: 15000 })
    await overlayTrigger.click()

    const overlay = page.getByRole('dialog', { name: /の予約詳細/ }).first()
    await expect(overlay).toBeVisible({ timeout: 15000 })

    await overlay.getByRole('button', { name: '空き状況・予約' }).click()

    const slotButton = overlay.locator('[aria-label*="予約可"], [aria-label*="要確認"]').first()
    await expect(slotButton).toBeVisible({ timeout: 15000 })
    await slotButton.click()

    await expect(overlay.getByText(/第1候補/)).toBeVisible()

    const formOpenButton = overlay
      .getByRole('button', { name: /予約フォーム(へ|に)進む|予約フォームを開く/ })
      .first()
    await formOpenButton.click()

    const formDialog = page.getByRole('dialog', { name: /の予約フォーム/ }).first()
    await expect(formDialog).toBeVisible({ timeout: 15000 })

    await expect(formDialog.getByText(/第1候補/)).toBeVisible()

    await formDialog.getByRole('button', { name: '予約フォームを閉じる' }).click()
    await expect(formDialog).not.toBeVisible()

    await overlay.getByRole('button', { name: '予約パネルを閉じる' }).click()
    await expect(overlay).not.toBeVisible()
  })
})
