import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright Test Agents configuration
 *
 * This configuration is specifically for using Playwright Test Agents
 * to explore the site and generate test plans.
 */
export default defineConfig({
  testDir: './tests/agents',

  // Test Agents need longer timeouts for exploration
  timeout: 60 * 1000,

  // Global test timeout
  globalTimeout: 30 * 60 * 1000,

  // Expect configuration
  expect: {
    timeout: 10000
  },

  // Full parallel execution
  fullyParallel: true,

  // Retry on failure
  retries: 1,

  // Number of workers
  workers: 1,

  // Reporter configuration
  reporter: [
    ['line'],
    ['html', { open: 'never' }]
  ],

  // Shared settings
  use: {
    // Base URL for tests
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://osakamenesu.com',

    // Trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Viewport
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,

    // Locale
    locale: 'ja-JP',

    // Timezone
    timezoneId: 'Asia/Tokyo',
  },

  // Project configuration
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Disable headless for agent exploration
        headless: false,
      },
    },
  ],

  // Output folder
  outputDir: 'test-results-agents/',
})