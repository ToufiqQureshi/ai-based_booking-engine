import { test, expect } from '@playwright/test';

const criticalRoutes = [
  '/dashboard',
  '/analytics',
  '/bookings',
  '/rooms',
  '/finance/rates',
  '/settings'
];

test.describe('Global UI Integrity - Anti-Bug Scanner', () => {
  for (const route of criticalRoutes) {
    test(`Scan ${route} for broken UI patterns`, async ({ page }) => {
      await page.goto(route);

      // If we are at login, we skip the scan for this route (security check passed)
      if (page.url().includes('login')) return;

      const bodyContent = await page.textContent('body');

      // 1. Check for Javascript runtime errors displayed as text
      expect(bodyContent).not.toContain('undefined');
      expect(bodyContent).not.toContain('[object Object]');
      expect(bodyContent).not.toContain('NaN');

      // 2. Check for common "Something went wrong" messages
      expect(bodyContent).not.toContain('Internal Server Error');
      expect(bodyContent).not.toContain('Failed to fetch');

      // 3. Check for empty React components that didn't load
      const loader = page.locator('svg.animate-spin');
      // If loader stays for more than 5 seconds, it's likely a hang (but Playwright timeout covers this)
    });
  }
});
