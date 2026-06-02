import { test, expect } from '@playwright/test';

// Deep feature tests require a live authenticated session.
// In CI without a real Supabase backend these tests are skipped automatically.
const requiresAuth = async (page: any) => {
  // Consider authenticated if the URL is NOT the login page AND a sidebar/nav element is visible
  if (page.url().includes('login')) return false;
  const hasSidebar = await page.locator('aside, nav, [data-sidebar]').first().isVisible({ timeout: 3000 }).catch(() => false);
  return hasSidebar;
};

test.describe('Dashboard - Deep Feature Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('Critical Stats Cards are present', async ({ page }) => {
    if (!await requiresAuth(page)) test.skip(true, 'Requires live auth');
    const stats = ['Arrivals', 'Departures', 'Occupancy', 'Revenue'];
    for (const stat of stats) {
      await expect(page.locator('div:has-text("' + stat + '")')).toBeVisible();
    }
  });

  test('Recent Bookings section exists', async ({ page }) => {
    if (!await requiresAuth(page)) test.skip(true, 'Requires live auth');
    await expect(page.getByText(/Recent Bookings/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /View All/i })).toBeVisible();
  });

  test('Market Insight card is functional', async ({ page }) => {
    if (!await requiresAuth(page)) test.skip(true, 'Requires live auth');
    await expect(page.getByText(/Market Insight/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /View Competitors/i })).toBeVisible();
  });
});
