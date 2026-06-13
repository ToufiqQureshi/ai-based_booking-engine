# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full_app.spec.ts >> 📊 Dashboard >> "Recent Bookings" card exists with "View All" link
- Location: tests\e2e\full_app.spec.ts:180:3

# Error details

```
TimeoutError: page.waitForURL: Timeout 20000ms exceeded.
=========================== logs ===========================
waiting for navigation to "https://app.staybooker.ai/dashboard" until "load"
============================================================
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
              - text: tech.revmerito@gmail.com
          - generic [ref=e18]:
            - generic [ref=e19]:
              - generic [ref=e20]: Password
              - link "Forgot password?" [ref=e21] [cursor=pointer]:
                - /url: /forgot-password
            - generic [ref=e22]:
              - textbox "Password" [ref=e23]:
                - /placeholder: ••••••••
                - text: Toufiq@651
              - button [ref=e24] [cursor=pointer]:
                - img
        - generic [ref=e25]:
          - button "Signing in..." [disabled]:
            - img
            - text: Signing in...
          - generic [ref=e26]:
            - paragraph [ref=e27]:
              - text: Don't have an account?
              - link "Create account" [ref=e28] [cursor=pointer]:
                - /url: /signup
            - paragraph [ref=e29]:
              - text: By signing in, you agree to our
              - link "Terms of Service" [ref=e30] [cursor=pointer]:
                - /url: /terms-of-service
              - text: and
              - link "Privacy Policy" [ref=e31] [cursor=pointer]:
                - /url: /privacy-policy
    - contentinfo [ref=e32]:
      - generic [ref=e33]:
        - link "Privacy Policy" [ref=e34] [cursor=pointer]:
          - /url: /privacy-policy
        - generic [ref=e35]: •
        - link "Terms of Service" [ref=e36] [cursor=pointer]:
          - /url: /terms-of-service
        - generic [ref=e37]: •
        - link "Refund Policy" [ref=e38] [cursor=pointer]:
          - /url: /refund-policy
        - generic [ref=e39]: •
        - link "Cookie Policy" [ref=e40] [cursor=pointer]:
          - /url: /cookie-policy
        - generic [ref=e41]: •
        - link "Contact Us" [ref=e42] [cursor=pointer]:
          - /url: /contact-us
      - paragraph [ref=e43]: © 2026 Staybooker by Revmerito. All rights reserved.
```

# Test source

```ts
  1   | /**
  2   |  * ════════════════════════════════════════════════════════════
  3   |  *  STAYBOOKER — COMPLETE PLAYWRIGHT TEST SUITE (v2)
  4   |  * ════════════════════════════════════════════════════════════
  5   |  *
  6   |  *  Run against LIVE site:
  7   |  *    $env:PLAYWRIGHT_BASE_URL="https://app.staybooker.ai"
  8   |  *    $env:TEST_EMAIL="tech.revmerito@gmail.com"
  9   |  *    $env:TEST_PASSWORD="Toufiq@651"
  10  |  *    npx playwright test tests/e2e/full_app.spec.ts --headed
  11  |  *
  12  |  *  Run against local dev:
  13  |  *    npx playwright test tests/e2e/full_app.spec.ts
  14  |  * ════════════════════════════════════════════════════════════
  15  |  */
  16  | 
  17  | import { test, expect, Page, BrowserContext } from '@playwright/test';
  18  | 
  19  | // ── Config ────────────────────────────────────────────────────────────────────
  20  | 
  21  | const BASE = (typeof process !== 'undefined' && process.env.PLAYWRIGHT_BASE_URL)
  22  |   ? process.env.PLAYWRIGHT_BASE_URL.replace(/\/$/, '')
  23  |   : 'https://app.staybooker.ai';
  24  | 
  25  | const EMAIL = (typeof process !== 'undefined' && process.env.TEST_EMAIL)
  26  |   ? process.env.TEST_EMAIL
  27  |   : 'tech.revmerito@gmail.com';
  28  | 
  29  | const PASSWORD = (typeof process !== 'undefined' && process.env.TEST_PASSWORD)
  30  |   ? process.env.TEST_PASSWORD
  31  |   : 'Toufiq@651';
  32  | 
  33  | // Generous timeouts for SPA + Supabase on live site
  34  | const LOAD_TIMEOUT = 15_000;
  35  | const API_TIMEOUT  = 20_000;
  36  | 
  37  | // ── Helpers ────────────────────────────────────────────────────────────────────
  38  | 
  39  | /** Fill login form and wait for dashboard */
  40  | async function login(page: Page) {
  41  |   await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: LOAD_TIMEOUT });
  42  |   // Wait for the Vite SPA to render the login form
  43  |   await page.waitForSelector('input[type="email"]', { timeout: LOAD_TIMEOUT });
  44  |   await page.locator('input[type="email"]').fill(EMAIL);
  45  |   await page.locator('input[type="password"]').fill(PASSWORD);
  46  |   await page.locator('button[type="submit"]').click();
  47  |   // Wait for redirect to dashboard
> 48  |   await page.waitForURL(`${BASE}/dashboard`, { timeout: API_TIMEOUT });
      |              ^ TimeoutError: page.waitForURL: Timeout 20000ms exceeded.
  49  |   // Wait for dashboard content to settle
  50  |   await page.waitForLoadState('networkidle', { timeout: API_TIMEOUT });
  51  | }
  52  | 
  53  | /** Assert no JS crash markers in body */
  54  | async function noCrash(page: Page) {
  55  |   const body = await page.textContent('body') || '';
  56  |   expect(body).not.toContain('TypeError');
  57  |   expect(body).not.toContain('[object Object]');
  58  |   expect(body).not.toContain('Internal Server Error');
  59  |   expect(body).not.toContain('Unexpected token');
  60  |   expect(body).not.toContain('Cannot read properties');
  61  | }
  62  | 
  63  | /** Navigate to a route after login and wait for load */
  64  | async function goTo(page: Page, path: string) {
  65  |   await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
  66  |   await page.waitForLoadState('networkidle', { timeout: API_TIMEOUT }).catch(() => {/* ok if slow */});
  67  | }
  68  | 
  69  | // ════════════════════════════════════════════════════════════
  70  | //  1. AUTH TESTS
  71  | // ════════════════════════════════════════════════════════════
  72  | 
  73  | test.describe('🔐 Auth', () => {
  74  | 
  75  |   test('login page renders correctly', async ({ page }) => {
  76  |     await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: LOAD_TIMEOUT });
  77  |     await page.waitForSelector('input[type="email"]', { timeout: LOAD_TIMEOUT });
  78  | 
  79  |     // Branding
  80  |     await expect(page.locator('h1')).toContainText('Staybooker');
  81  |     await expect(page.getByText('Sign in')).toBeVisible();
  82  |     await expect(page.getByText('Enter your credentials to access your dashboard')).toBeVisible();
  83  | 
  84  |     // Email field
  85  |     await expect(page.locator('input[type="email"]')).toBeVisible();
  86  |     await expect(page.locator('input[type="email"]')).toHaveAttribute('placeholder', 'owner@hotel.com');
  87  | 
  88  |     // Password field
  89  |     await expect(page.locator('input[type="password"]')).toBeVisible();
  90  | 
  91  |     // Submit button
  92  |     await expect(page.locator('button[type="submit"]')).toBeVisible();
  93  |     await expect(page.locator('button[type="submit"]')).toContainText('Sign in');
  94  | 
  95  |     // Links
  96  |     await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
  97  |     await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible();
  98  |     await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
  99  |   });
  100 | 
  101 |   test('empty form shows validation errors', async ({ page }) => {
  102 |     await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: LOAD_TIMEOUT });
  103 |     await page.waitForSelector('button[type="submit"]', { timeout: LOAD_TIMEOUT });
  104 |     await page.locator('button[type="submit"]').click();
  105 |     // Zod validation — at least one error message should appear
  106 |     await page.waitForTimeout(800);
  107 |     const body = await page.textContent('body') || '';
  108 |     expect(
  109 |       body.includes('valid email') || body.includes('required') || body.includes('characters')
  110 |     ).toBeTruthy();
  111 |   });
  112 | 
  113 |   test('wrong password shows error toast', async ({ page }) => {
  114 |     await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: LOAD_TIMEOUT });
  115 |     await page.waitForSelector('input[type="email"]', { timeout: LOAD_TIMEOUT });
  116 |     await page.locator('input[type="email"]').fill(EMAIL);
  117 |     await page.locator('input[type="password"]').fill('WRONG_PASSWORD_XYZ');
  118 |     await page.locator('button[type="submit"]').click();
  119 |     // Should show destructive toast
  120 |     await expect(
  121 |       page.getByText(/Login failed|Invalid email or password|not reachable/i)
  122 |     ).toBeVisible({ timeout: 12_000 });
  123 |     expect(page.url()).toContain('/login');
  124 |   });
  125 | 
  126 |   test('successful login redirects to /dashboard', async ({ page }) => {
  127 |     await login(page);
  128 |     expect(page.url()).toContain('/dashboard');
  129 |     await noCrash(page);
  130 |   });
  131 | 
  132 |   test('forgot password page loads', async ({ page }) => {
  133 |     await page.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle', timeout: LOAD_TIMEOUT });
  134 |     await page.waitForSelector('input[type="email"]', { timeout: LOAD_TIMEOUT });
  135 |     await expect(page.locator('input[type="email"]')).toBeVisible();
  136 |     await noCrash(page);
  137 |   });
  138 | 
  139 |   test('signup page loads with form', async ({ page }) => {
  140 |     await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle', timeout: LOAD_TIMEOUT });
  141 |     // Signup may require hotel name, email, password fields
  142 |     const hasInput = await page.locator('input').first().isVisible({ timeout: LOAD_TIMEOUT });
  143 |     expect(hasInput).toBeTruthy();
  144 |     await noCrash(page);
  145 |   });
  146 | 
  147 |   test('unauthenticated /dashboard redirects to login', async ({ page }) => {
  148 |     await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
```