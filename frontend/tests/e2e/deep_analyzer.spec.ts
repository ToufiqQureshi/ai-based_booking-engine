import { test, expect } from '@playwright/test';

const pages = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Analytics', path: '/analytics' },
  { name: 'Bookings', path: '/bookings' },
  { name: 'Rooms', path: '/rooms' },
  { name: 'Rates', path: '/finance/rates' },
  { name: 'Payments', path: '/finance/payments' },
  { name: 'Settings', path: '/settings' },
];

test.describe('Deep Page Analyzer - Health Checks', () => {
  for (const pageInfo of pages) {
    test(`Verify ${pageInfo.name} stability`, async ({ page }) => {
      await page.goto(pageInfo.path);

      // Allow time for auth redirect if Supabase is available
      await page.waitForTimeout(1500);

      const url = page.url();
      const bodyText = await page.textContent('body') || '';

      if (url.includes('login')) {
        // Redirected to login — security guard working correctly
        await expect(page).toHaveURL(/.*login.*/);
      } else {
        // No redirect (CI without backend) — just verify no crash
        expect(bodyText).not.toContain('Internal Server Error');
        // A loading/skeleton state is fine; raw "404" text in body is not
        const has404Text = bodyText.trim() === '404' || bodyText.includes('404 Not Found');
        expect(has404Text).toBeFalsy();
      }
    });
  }
});

test('Public Booking Widget Health', async ({ page }) => {
  await page.goto('/book/test-hotel');
  const title = await page.title();
  expect(title).toBeTruthy();
});
