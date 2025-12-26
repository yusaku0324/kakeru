/**
 * Lighthouse CI Configuration
 *
 * Runs performance audits on the web app during CI to ensure
 * performance regressions are caught before deployment.
 */
module.exports = {
  ci: {
    collect: {
      // Use built Next.js app with static server
      startServerCommand: 'pnpm start',
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 60000,
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/search',
        'http://localhost:3000/shops',
      ],
      numberOfRuns: 3, // Run multiple times for more reliable results
      settings: {
        preset: 'desktop',
        // Skip some audits that are less relevant for CI
        skipAudits: [
          'uses-http2',
          'uses-long-cache-ttl',
        ],
      },
    },
    assert: {
      // Performance budget assertions
      assertions: {
        // Performance Score (out of 100)
        'categories:performance': ['warn', { minScore: 0.7 }],
        // Accessibility Score
        'categories:accessibility': ['error', { minScore: 0.9 }],
        // Best Practices Score
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        // SEO Score
        'categories:seo': ['warn', { minScore: 0.9 }],

        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }], // 2s
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }], // 2.5s
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }], // 300ms
        'speed-index': ['warn', { maxNumericValue: 3500 }], // 3.5s

        // Resource budgets
        'resource-summary:script:size': ['warn', { maxNumericValue: 500000 }], // 500KB
        'resource-summary:total:size': ['warn', { maxNumericValue: 2000000 }], // 2MB
      },
    },
    upload: {
      // Use temporary public storage (no server needed)
      target: 'temporary-public-storage',
    },
  },
}
