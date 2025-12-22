import { test, expect } from '@playwright/test'

/**
 * API Routes Existence Test
 *
 * This test verifies that critical frontend API routes exist and respond correctly.
 * These routes proxy requests to the backend API.
 *
 * This prevents issues like the one where /api/guest/reservations was missing,
 * causing silent failures in the reservation flow.
 */

const API_ROUTES = [
  { path: '/api/guest/reservations', method: 'POST', expectedStatus: [400, 401, 422] },
  // Add other critical API routes here as needed
]

test.describe('Frontend API Routes Existence', () => {
  for (const route of API_ROUTES) {
    test(`${route.method} ${route.path} should exist and respond`, async ({ request }) => {
      let response

      if (route.method === 'POST') {
        response = await request.post(route.path, {
          data: {},
          headers: { 'Content-Type': 'application/json' },
        })
      } else if (route.method === 'GET') {
        response = await request.get(route.path)
      } else {
        throw new Error(`Unsupported method: ${route.method}`)
      }

      // Route should not return 404 (missing route)
      expect(response.status()).not.toBe(404)

      // Route should return one of the expected statuses
      // (400/422 for invalid input is fine - it means the route exists)
      expect(
        route.expectedStatus.includes(response.status()),
        `Expected status ${route.expectedStatus.join(' or ')}, got ${response.status()}`
      ).toBeTruthy()
    })
  }
})
