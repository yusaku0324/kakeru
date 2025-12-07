import 'dotenv/config'
import { defineConfig } from '@playwright/test'

const port = Number(process.env.E2E_PORT || 3000)
const resolvedBaseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`

/**
 * Site QA Config
 *
 * This config is for public site E2E tests that don't require admin API seeding.
 * It uses sample data built into the frontend.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: ['site-qa.spec.ts', 'spec-based.spec.ts'],
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  // No globalSetup - skip admin seeding
  use: {
    baseURL: resolvedBaseURL,
    trace: 'retain-on-failure',
    headless: true,
  },
  webServer: {
    command: `npx next dev -p ${port} --hostname 127.0.0.1`,
    url: resolvedBaseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
