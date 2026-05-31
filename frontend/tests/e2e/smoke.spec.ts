import { test, expect } from '@playwright/test';

test('landing page loads correctly', async ({ page }) => {
  await page.goto('/');
  // Basic check: Title ya koi specific text hona chahiye
  await expect(page).toHaveTitle(/Staybooker/i);
});

test('login page is accessible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
});

test('public search page loads', async ({ page }) => {
  // Assuming a test hotel exists or just checking route stability
  await page.goto('/book/test-hotel');
  // Check if dates or search button are visible
  await expect(page.getByText(/check-in/i)).toBeVisible();
});

test('analytics dashboard requires auth', async ({ page }) => {
  await page.goto('/analytics');
  // Should redirect to login if not authenticated
  await expect(page).toHaveURL(/.*login.*/);
});

test('rooms management requires auth', async ({ page }) => {
  await page.goto('/rooms');
  await expect(page).toHaveURL(/.*login.*/);
});

test('rates management requires auth', async ({ page }) => {
  await page.goto('/finance/rates');
  await expect(page).toHaveURL(/.*login.*/);
});

test('bookings list requires auth', async ({ page }) => {
  await page.goto('/bookings');
  await expect(page).toHaveURL(/.*login.*/);
});

test('payments page requires auth', async ({ page }) => {
  await page.goto('/finance/payments');
  await expect(page).toHaveURL(/.*login.*/);
});

test('settings page requires auth', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/.*login.*/);
});
