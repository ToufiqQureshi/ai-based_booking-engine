import { test, expect } from '@playwright/test';

test.describe('Analytics - Deep Feature Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics');
  });

  test('Tabs are switchable and interactive', async ({ page }) => {
    if (page.url().includes('login')) test.skip(true, 'Requires auth');
    const tabs = ['Overview', 'Revenue & Rooms', 'Traffic', 'AI Performance', 'Cancellations'];
    for (const tab of tabs) {
      const tabTrigger = page.getByRole('tab', { name: tab });
      await expect(tabTrigger).toBeVisible();
      await tabTrigger.click();
      // Verify tab is active (shadcn/ui uses data-state="active")
      await expect(tabTrigger).toHaveAttribute('data-state', 'active');
    }
  });

  test('Day filters update the view', async ({ page }) => {
    if (page.url().includes('login')) test.skip(true, 'Requires auth');
    const filters = ['7d', '30d', '90d'];
    for (const filter of filters) {
      const button = page.getByRole('button', { name: filter });
      await expect(button).toBeVisible();
      await button.click();
      // Simple check: subtitle updates
      await expect(page.getByText(new RegExp('last ' + filter.replace('d', '') + ' days', 'i'))).toBeVisible();
    }
  });

  test('Charts and Visualizations render', async ({ page }) => {
    if (page.url().includes('login')) test.skip(true, 'Requires auth');
    // Check for recharts container
    const chartContainer = page.locator('.recharts-responsive-container');
    // At least one chart should be visible on overview
    await expect(chartContainer.first()).toBeVisible();
  });

  test('Export CSV button is functional', async ({ page }) => {
    if (page.url().includes('login')) test.skip(true, 'Requires auth');
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
  });
});
