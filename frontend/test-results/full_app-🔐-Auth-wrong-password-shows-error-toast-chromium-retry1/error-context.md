# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full_app.spec.ts >> 🔐 Auth >> wrong password shows error toast
- Location: tests\e2e\full_app.spec.ts:113:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Login failed|Invalid email or password|not reachable/i)
Expected: visible
Error: strict mode violation: getByText(/Login failed|Invalid email or password|not reachable/i) resolved to 2 elements:
    1) <div class="text-sm font-semibold">Login failed</div> aka getByText('Login failed')
    2) <div class="text-sm opacity-90">Invalid email or password</div> aka getByText('Invalid email or password')

Call log:
  - Expect "toBeVisible" with timeout 12000ms
  - waiting for getByText(/Login failed|Invalid email or password|not reachable/i)

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - region "Notifications (F8)":
      - list [ref=e4]:
        - status [ref=e5]:
          - generic [ref=e6]:
            - generic [ref=e7]: Login failed
            - generic [ref=e8]: Invalid email or password
          - button [ref=e9] [cursor=pointer]:
            - img [ref=e10]
    - region "Notifications alt+T"
    - generic [ref=e15]:
      - generic [ref=e16]:
        - img "Staybooker Logo" [ref=e18]
        - heading "Staybooker" [level=1] [ref=e19]
        - paragraph [ref=e20]: Multi-tenant hotel management platform
      - generic [ref=e21]:
        - generic [ref=e22]:
          - heading "Sign in" [level=3] [ref=e23]
          - paragraph [ref=e24]: Enter your credentials to access your dashboard
        - generic [ref=e25]:
          - generic [ref=e26]:
            - generic [ref=e27]:
              - text: Email
              - textbox "Email" [ref=e28]:
                - /placeholder: owner@hotel.com
                - text: tech.revmerito@gmail.com
            - generic [ref=e29]:
              - generic [ref=e30]:
                - generic [ref=e31]: Password
                - link "Forgot password?" [ref=e32] [cursor=pointer]:
                  - /url: /forgot-password
              - generic [ref=e33]:
                - textbox "Password" [ref=e34]:
                  - /placeholder: ••••••••
                  - text: WRONG_PASSWORD_XYZ
                - button [ref=e35] [cursor=pointer]:
                  - img
          - generic [ref=e36]:
            - button "Sign in" [ref=e37] [cursor=pointer]
            - generic [ref=e38]:
              - paragraph [ref=e39]:
                - text: Don't have an account?
                - link "Create account" [ref=e40] [cursor=pointer]:
                  - /url: /signup
              - paragraph [ref=e41]:
                - text: By signing in, you agree to our
                - link "Terms of Service" [ref=e42] [cursor=pointer]:
                  - /url: /terms-of-service
                - text: and
                - link "Privacy Policy" [ref=e43] [cursor=pointer]:
                  - /url: /privacy-policy
      - contentinfo [ref=e44]:
        - generic [ref=e45]:
          - link "Privacy Policy" [ref=e46] [cursor=pointer]:
            - /url: /privacy-policy
          - generic [ref=e47]: •
          - link "Terms of Service" [ref=e48] [cursor=pointer]:
            - /url: /terms-of-service
          - generic [ref=e49]: •
          - link "Refund Policy" [ref=e50] [cursor=pointer]:
            - /url: /refund-policy
          - generic [ref=e51]: •
          - link "Cookie Policy" [ref=e52] [cursor=pointer]:
            - /url: /cookie-policy
          - generic [ref=e53]: •
          - link "Contact Us" [ref=e54] [cursor=pointer]:
            - /url: /contact-us
        - paragraph [ref=e55]: © 2026 Staybooker by Revmerito. All rights reserved.
  - status [ref=e56]: Notification Login failedInvalid email or password
```

# Test source

```ts
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
  48  |   await page.waitForURL(`${BASE}/dashboard`, { timeout: API_TIMEOUT });
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
> 122 |     ).toBeVisible({ timeout: 12_000 });
      |       ^ Error: expect(locator).toBeVisible() failed
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
  149 |     await page.waitForTimeout(3000);
  150 |     // Either URL is /login OR the login form email input is visible
  151 |     const redirected = page.url().includes('/login');
  152 |     const showsLoginForm = await page.locator('input[type="email"]').isVisible({ timeout: 3_000 }).catch(() => false);
  153 |     expect(redirected || showsLoginForm).toBeTruthy();
  154 |   });
  155 | });
  156 | 
  157 | // ════════════════════════════════════════════════════════════
  158 | //  2. DASHBOARD
  159 | // ════════════════════════════════════════════════════════════
  160 | 
  161 | test.describe('📊 Dashboard', () => {
  162 |   test.beforeEach(async ({ page }) => {
  163 |     await login(page);
  164 |   });
  165 | 
  166 |   test('page heading is Dashboard', async ({ page }) => {
  167 |     // PageShell renders a heading with title="Dashboard"
  168 |     await expect(page.getByRole('heading', { name: /Dashboard/i }).first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  169 |   });
  170 | 
  171 |   test('4 stat cards are visible (Arrivals, Departures, Occupancy, Revenue)', async ({ page }) => {
  172 |     // Cards use uppercase CSS class — check text content case-insensitively
  173 |     for (const label of ['Arrivals', 'Departures', 'Occupancy', 'Revenue']) {
  174 |       await expect(
  175 |         page.getByText(new RegExp(label, 'i')).first()
  176 |       ).toBeVisible({ timeout: LOAD_TIMEOUT });
  177 |     }
  178 |   });
  179 | 
  180 |   test('"Recent Bookings" card exists with "View All" link', async ({ page }) => {
  181 |     await expect(page.getByText('Recent Bookings').first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  182 |     await expect(page.getByRole('link', { name: /View All/i })).toBeVisible({ timeout: LOAD_TIMEOUT });
  183 |   });
  184 | 
  185 |   test('"Action Needed" card exists', async ({ page }) => {
  186 |     await expect(page.getByText('Action Needed').first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  187 |   });
  188 | 
  189 |   test('sidebar / nav is visible', async ({ page }) => {
  190 |     const nav = page.locator('aside, nav, [data-sidebar], [role="navigation"]').first();
  191 |     await expect(nav).toBeVisible({ timeout: LOAD_TIMEOUT });
  192 |   });
  193 | 
  194 |   test('no JS crash on dashboard', async ({ page }) => {
  195 |     await noCrash(page);
  196 |   });
  197 | });
  198 | 
  199 | // ════════════════════════════════════════════════════════════
  200 | //  3. ROOMS PAGE
  201 | // ════════════════════════════════════════════════════════════
  202 | 
  203 | test.describe('🛏 Rooms', () => {
  204 |   test.beforeEach(async ({ page }) => {
  205 |     await login(page);
  206 |     await goTo(page, '/rooms');
  207 |   });
  208 | 
  209 |   test('page title is Room Types', async ({ page }) => {
  210 |     await expect(page.getByRole('heading', { name: /Room Types/i })).toBeVisible({ timeout: LOAD_TIMEOUT });
  211 |   });
  212 | 
  213 |   test('"Add Room Type" button is present', async ({ page }) => {
  214 |     await expect(page.getByRole('button', { name: /Add Room Type/i })).toBeVisible({ timeout: LOAD_TIMEOUT });
  215 |   });
  216 | 
  217 |   test('"Rooms" and "Packages" tab buttons exist', async ({ page }) => {
  218 |     await expect(page.getByRole('button', { name: /^Rooms$/i })).toBeVisible({ timeout: LOAD_TIMEOUT });
  219 |     await expect(page.getByRole('button', { name: /^Packages$/i })).toBeVisible({ timeout: LOAD_TIMEOUT });
  220 |   });
  221 | 
  222 |   test('search input has correct placeholder', async ({ page }) => {
```