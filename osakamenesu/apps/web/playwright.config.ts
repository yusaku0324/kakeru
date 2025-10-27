import 'dotenv/config'
import { defineConfig } from '@playwright/test'

const adminUser = process.env.ADMIN_BASIC_USER
const adminPass = process.env.ADMIN_BASIC_PASS
const adminKey = process.env.ADMIN_API_KEY
const port = Number(process.env.E2E_PORT || 3000)
const resolvedBaseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`
const isCI = !!process.env.CI && process.env.CI !== '0' && process.env.CI !== 'false'
const prodServerCommand = `npm run build && npm run start -- --hostname 127.0.0.1 -p ${port}`
const devServerCommand = `npx next dev -p ${port} --hostname 127.0.0.1`
const webServerCommand = isCI ? prodServerCommand : devServerCommand

const basicAuthHeader = adminUser && adminPass
  ? `Basic ${Buffer.from(`${adminUser}:${adminPass}`).toString('base64')}`
  : undefined

if (!basicAuthHeader) {
  // eslint-disable-next-line no-console
  console.warn('[playwright] ADMIN_BASIC_USER / ADMIN_BASIC_PASS が設定されていないため、管理画面テストは認証エラーになります')
}

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  globalSetup: './e2e/global-setup.cjs',
  use: {
    baseURL: resolvedBaseURL,
    trace: 'on-first-retry',
    headless: true,
    extraHTTPHeaders: basicAuthHeader
      ? {
          Authorization: basicAuthHeader,
          ...(adminKey ? { 'X-Admin-Key': adminKey } : {}),
        }
      : adminKey
      ? {
          'X-Admin-Key': adminKey,
        }
      : {},
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: webServerCommand,
        port,
        reuseExistingServer: !isCI,
        timeout: isCI ? 240_000 : 120_000,
      },
})
