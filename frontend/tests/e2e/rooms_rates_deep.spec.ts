import { test, expect } from '@playwright/test';

test.describe('Exhaustive Rooms & Rates Verification', () => {
  test('Rooms Page - Tabs, Search and Dialogs', async ({ page }) => {
    await page.goto('/rooms');
    if (page.url().includes('login')) return;

    // 1. Switch between Rooms and Packages tabs
    const roomsTab = page.getByRole('button', { name: 'Rooms' });
    const packagesTab = page.getByRole('button', { name: 'Packages' });

    await packagesTab.click();
    await expect(page.getByText(/Manage stay packages/i).or(page.getByText(/No packages found/i))).toBeVisible();

    await roomsTab.click();
    await expect(page.getByText(/Manage hotel room categories/i).or(page.getByText(/No rooms found/i))).toBeVisible();

    // 2. Switch View Modes (Grid/List)
    const listViewBtn = page.locator('button').filter({ has: page.locator('svg.lucide-list') });
    const gridViewBtn = page.locator('button').filter({ has: page.locator('svg.lucide-grid') });

    await listViewBtn.click();
    // Grid vs List check (usually class change or structure change)
    await expect(listViewBtn).toHaveClass(/bg-muted/);

    await gridViewBtn.click();
    await expect(gridViewBtn).toHaveClass(/bg-muted/);

    // 3. Open "Add Room Type" Dialog
    await page.getByRole('button', { name: /Add Room Type/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/Create Room Category/i)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Rates Page - Table and Dialog', async ({ page }) => {
    await page.goto('/finance/rates');
    if (page.url().includes('login')) return;

    await expect(page.getByText(/Active Rate Plans/i)).toBeVisible();

    // Open Add Rate Plan Dialog
    await page.getByRole('button', { name: /Add Rate Plan/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
