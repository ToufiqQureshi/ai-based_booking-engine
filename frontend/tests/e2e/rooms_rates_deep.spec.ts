import { test, expect } from '@playwright/test';

const requiresAuth = async (page: any) => {
  if (page.url().includes('login')) return false;
  return await page.locator('aside, nav, [data-sidebar]').first().isVisible({ timeout: 3000 }).catch(() => false);
};

test.describe('Exhaustive Rooms & Rates Verification', () => {
  test('Rooms Page - Tabs, Search and Dialogs', async ({ page }) => {
    await page.goto('/rooms');
    if (!await requiresAuth(page)) test.skip(true, 'Requires live auth');

    const roomsTab = page.getByRole('button', { name: 'Rooms' });
    const packagesTab = page.getByRole('button', { name: 'Packages' });

    await packagesTab.click();
    await expect(page.getByText(/Manage stay packages/i).or(page.getByText(/No packages found/i))).toBeVisible();

    await roomsTab.click();
    await expect(page.getByText(/Manage hotel room categories/i).or(page.getByText(/No rooms found/i))).toBeVisible();

    const listViewBtn = page.locator('button').filter({ has: page.locator('svg.lucide-list') });
    const gridViewBtn = page.locator('button').filter({ has: page.locator('svg.lucide-grid') });

    await listViewBtn.click();
    await expect(listViewBtn).toHaveClass(/bg-muted/);

    await gridViewBtn.click();
    await expect(gridViewBtn).toHaveClass(/bg-muted/);

    await page.getByRole('button', { name: /Add Room Type/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/Create Room Category/i)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Rates Page - Table and Dialog', async ({ page }) => {
    await page.goto('/finance/rates');
    if (!await requiresAuth(page)) test.skip(true, 'Requires live auth');

    await expect(page.getByText(/Active Rate Plans/i)).toBeVisible();

    await page.getByRole('button', { name: /Add Rate Plan/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
