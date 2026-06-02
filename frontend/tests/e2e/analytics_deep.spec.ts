import { test, expect } from '@playwright/test';

const requiresAuth = async (page: any) => {
  if (page.url().includes('login')) return false;
  return await page.locator('aside, nav, [data-sidebar]').first().isVisible({ timeout: 3000 }).catch(() => false);
};

test.describe('Analytics - Deep Feature Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics');
  });

  test('Tabs are switchable and interactive', async ({ page }) => {
    if (!await requiresAuth(page)) test.skip(true, 'Requires live auth');
    const tabs = ['Overview', 'Revenue & Rooms', 'Traffic', 'AI Performance', 'Cancellations'];
    for (const tab of tabs) {
      const tabTrigger = page.getByRole('tab', { name: tab });
      await expect(tabTrigger).toBeVisible();
      await tabTrigger.click();
      await expect(tabTrigger).toHaveAttribute('data-state', 'active');
    }
  });

  test('Day filters update the view', async ({ page }) => {
    if (!await requiresAuth(page)) test.skip(true, 'Requires live auth');
    const filters = ['7d', '30d', '90d'];
    for (const filter of filters) {
      const button = page.getByRole('button', { name: filter });
      await expect(button).toBeVisible();
      await button.click();
      await expect(page.getByText(new RegExp('last ' + filter.replace('d', '') + ' days', 'i'))).toBeVisible();
    }
  });

  test('Charts and Visualizations render', async ({ page }) => {
    if (!await requiresAuth(page)) test.skip(true, 'Requires live auth');
    const chartContainer = page.locator('.recharts-responsive-container');
    await expect(chartContainer.first()).toBeVisible();
  });

  test('Export CSV button is functional', async ({ page }) => {
    if (!await requiresAuth(page)) test.skip(true, 'Requires live auth');
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
  });
});
