# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> login page is accessible
- Location: tests\e2e\smoke.spec.ts:8:1

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - generic [ref=e4]:
    - generic [ref=e5]:
      - img "Staybooker Logo" [ref=e7]
      - heading "Staybooker" [level=1] [ref=e8]
      - paragraph [ref=e9]: Multi-tenant hotel management platform
    - generic [ref=e10]:
      - generic [ref=e11]:
        - heading "Sign in" [level=3] [ref=e12]
        - paragraph [ref=e13]: Enter your credentials to access your dashboard
      - generic [ref=e14]:
        - generic [ref=e15]:
          - generic [ref=e16]:
            - text: Email
            - textbox "Email" [ref=e17]:
              - /placeholder: owner@hotel.com
          - generic [ref=e18]:
            - generic [ref=e19]:
              - generic [ref=e20]: Password
              - link "Forgot password?" [ref=e21] [cursor=pointer]:
                - /url: /forgot-password
            - generic [ref=e22]:
              - textbox "Password" [ref=e23]:
                - /placeholder: ••••••••
              - button [ref=e24] [cursor=pointer]:
                - img
        - generic [ref=e25]:
          - button "Sign in" [ref=e26] [cursor=pointer]
          - generic [ref=e27]:
            - paragraph [ref=e28]:
              - text: Don't have an account?
              - link "Create account" [ref=e29] [cursor=pointer]:
                - /url: /signup
            - paragraph [ref=e30]:
              - text: By signing in, you agree to our
              - link "Terms of Service" [ref=e31] [cursor=pointer]:
                - /url: /terms-of-service
              - text: and
              - link "Privacy Policy" [ref=e32] [cursor=pointer]:
                - /url: /privacy-policy
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('landing page loads correctly', async ({ page }) => {
  4  |   await page.goto('/');
  5  |   await expect(page).toHaveTitle(/Staybooker/i);
  6  | });
  7  | 
  8  | test('login page is accessible', async ({ page }) => {
  9  |   await page.goto('/login');
  10 |   // Accept any sign-in button text (Sign In, Log In, Login, etc.) or email input
  11 |   const hasLoginForm =
  12 |     await page.locator('input[type="email"], input[name="email"]').isVisible({ timeout: 5000 }).catch(() => false) ||
  13 |     await page.getByRole('button', { name: /sign.?in|log.?in|login|continue/i }).isVisible({ timeout: 3000 }).catch(() => false);
> 14 |   expect(hasLoginForm).toBeTruthy();
     |                        ^ Error: expect(received).toBeTruthy()
  15 | });
  16 | 
  17 | test('public booking page renders without crash', async ({ page }) => {
  18 |   await page.goto('/book/test-hotel/rooms');
  19 |   const title = await page.title();
  20 |   expect(title).toBeTruthy();
  21 |   const body = await page.textContent('body');
  22 |   expect(body).not.toContain('[object Object]');
  23 |   expect(body).not.toContain('TypeError');
  24 | });
  25 | 
  26 | // Auth-guard tests — pass if redirected to login OR if page loads without crashing.
  27 | // In CI there is no real Supabase backend so redirect timing is unpredictable;
  28 | // we only care that the app does not crash or expose raw errors.
  29 | const protectedRoutes = [
  30 |   '/analytics',
  31 |   '/rooms',
  32 |   '/finance/rates',
  33 |   '/bookings',
  34 |   '/finance/payments',
  35 |   '/settings',
  36 | ];
  37 | 
  38 | for (const route of protectedRoutes) {
  39 |   test(`protected route does not crash: ${route}`, async ({ page }) => {
  40 |     await page.goto(route);
  41 |     // Allow time for a redirect if auth is available
  42 |     await page.waitForTimeout(1500);
  43 |     const title = await page.title();
  44 |     expect(title).toBeTruthy();
  45 |     const body = await page.textContent('body') || '';
  46 |     expect(body).not.toContain('Internal Server Error');
  47 |     expect(body).not.toContain('[object Object]');
  48 |   });
  49 | }
  50 | 
```