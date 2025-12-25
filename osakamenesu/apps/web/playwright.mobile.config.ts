import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/mobile-*.spec.ts',
  timeout: 90 * 1000, // Mobile tests may take longer
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  workers: 1, // Mobile tests should run sequentially
  retries: 2, // Mobile tests might be flakier
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on',
    screenshot: 'on',
    video: 'retain-on-failure',
    // Emulate mobile network conditions
    offline: false,
    // Slower network on mobile
    extraHTTPHeaders: {
      'X-Test-Mobile': 'true'
    }
  },
  projects: [
    // Phones
    {
      name: 'Mobile Chrome iPhone 13',
      use: {
        ...devices['iPhone 13'],
        // Override specific settings for PWA testing
        permissions: ['notifications'],
        locale: 'ja-JP',
      },
    },
    {
      name: 'Mobile Chrome Pixel 5',
      use: {
        ...devices['Pixel 5'],
        permissions: ['notifications'],
        locale: 'ja-JP',
      },
    },
    // Tablets
    {
      name: 'Mobile Safari iPad',
      use: {
        ...devices['iPad (gen 7)'],
        permissions: ['notifications'],
        locale: 'ja-JP',
      },
    },
    {
      name: 'Mobile Chrome iPad Pro',
      use: {
        ...devices['iPad Pro 11'],
        permissions: ['notifications'],
        locale: 'ja-JP',
      },
    },
    // Landscape orientations
    {
      name: 'Mobile Landscape iPhone',
      use: {
        ...devices['iPhone 13 landscape'],
        permissions: ['notifications'],
        locale: 'ja-JP',
      },
    },
  ],
})