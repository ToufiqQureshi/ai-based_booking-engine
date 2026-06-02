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

test('public booking page renders without crash', async ({ page }) => {
  await page.goto('/book/test-hotel/rooms');
  // Page must not be a white screen - title must exist
  const title = await page.title();
  expect(title).toBeTruthy();
  // Must not show raw JS errors
  const body = await page.textContent('body');
  expect(body).not.toContain('[object Object]');
  expect(body).not.toContain('TypeError');
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
