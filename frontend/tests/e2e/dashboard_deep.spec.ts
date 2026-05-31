import { test, expect } from '@playwright/test';

test.describe('Dashboard - Deep Feature Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Note: In real setup, we'd log in first.
    // Here we assume it's protected or we are testing visibility of protection.
    await page.goto('/dashboard');
  });

  test('Critical Stats Cards are present', async ({ page }) => {
    const stats = ['Arrivals', 'Departures', 'Occupancy', 'Revenue'];
    for (const stat of stats) {
      await expect(page.locator('div:has-text("' + stat + '")')).toBeVisible();
    }
  });

  test('Recent Bookings section exists', async ({ page }) => {
    await expect(page.getByText(/Recent Bookings/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /View All/i })).toBeVisible();
  });

  test('Market Insight card is functional', async ({ page }) => {
    await expect(page.getByText(/Market Insight/i)).toBeVisible();
    // Check for "View Competitors" link
    await expect(page.getByRole('link', { name: /View Competitors/i })).toBeVisible();
  });
});
