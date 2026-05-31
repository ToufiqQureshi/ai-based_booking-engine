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
