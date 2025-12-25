import { test, expect } from '@playwright/test';

/**
 * Seed test for Playwright Test Agents - Planner
 *
 * This test is the starting point for the Planner to explore the Osakamenesu site.
 * It opens the homepage and verifies basic page elements are loaded.
 */
test.describe('Osakamenesu Site Exploration', () => {
  test('Open homepage and verify structure', async ({ page }) => {
    // Navigate to Osakamenesu site
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'https://osakamenesu.com';
    await page.goto(baseUrl);

    // Verify page title contains expected text
    await expect(page).toHaveTitle(/大阪メンエス/);

    // Verify main navigation is visible
    await expect(page.locator('nav')).toBeVisible();

    // Verify main content area is loaded
    await expect(page.locator('main')).toBeVisible();

    // Wait for any dynamic content to load
    await page.waitForLoadState('networkidle');
  });
});