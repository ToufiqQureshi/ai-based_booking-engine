# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full_app.spec.ts >> 📊 Dashboard >> "Recent Bookings" card exists with "View All" link
- Location: tests\e2e\full_app.spec.ts:180:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('link', { name: /View All/i })
Expected: visible
Error: strict mode violation: getByRole('link', { name: /View All/i }) resolved to 2 elements:
    1) <a href="/bookings" class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md px-3 h-8">View All</a> aka getByRole('link', { name: 'View All', exact: true })
    2) <a href="/bookings?status=pending" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary-foreground px-4 py-2 w-full bg-blue-600 hover:bg-blue-700 h-9 text-xs font-bold">Review All</a> aka getByRole('link', { name: 'Review All' })

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('link', { name: /View All/i })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - region "Notifications (F8)":
      - list [ref=e4]:
        - status [ref=e5]:
          - generic [ref=e6]:
            - generic [ref=e7]: Welcome back!
            - generic [ref=e8]: You have successfully logged in.
          - button [ref=e9] [cursor=pointer]:
            - img [ref=e10]
    - region "Notifications alt+T"
    - generic [ref=e15]:
      - generic [ref=e19]:
        - generic [ref=e21]:
          - img "Logo" [ref=e23]
          - generic [ref=e24]:
            - generic [ref=e25]: Power House
            - generic [ref=e26]: Super Admin
        - generic [ref=e27]:
          - generic [ref=e28]:
            - generic [ref=e29]: Main Menu
            - list [ref=e31]:
              - listitem [ref=e32]:
                - link "Brand Console" [ref=e33] [cursor=pointer]:
                  - /url: /chain/dashboard
                  - img [ref=e34]
                  - generic [ref=e38]: Brand Console
              - listitem [ref=e39]:
                - link "Dashboard" [ref=e40] [cursor=pointer]:
                  - /url: /dashboard
                  - img [ref=e41]
                  - generic [ref=e46]: Dashboard
              - listitem [ref=e48]:
                - link "Analytics" [ref=e49] [cursor=pointer]:
                  - /url: /analytics
                  - img [ref=e50]
                  - generic [ref=e53]: Analytics
              - listitem [ref=e54]:
                - link "AI Assistant" [ref=e55] [cursor=pointer]:
                  - /url: /agent
                  - img [ref=e56]
                  - generic [ref=e59]: AI Assistant
              - listitem [ref=e60]:
                - link "Rooms" [ref=e61] [cursor=pointer]:
                  - /url: /rooms
                  - img [ref=e62]
                  - generic [ref=e64]: Rooms
              - listitem [ref=e65]:
                - link "Rate Plans" [ref=e66] [cursor=pointer]:
                  - /url: /rates
                  - img [ref=e67]
                  - generic [ref=e70]: Rate Plans
              - listitem [ref=e71]:
                - link "Rate Shopper" [ref=e72] [cursor=pointer]:
                  - /url: /rate-shopper
                  - img [ref=e73]
                  - generic [ref=e76]: Rate Shopper
              - listitem [ref=e77]:
                - link "Calendar" [ref=e78] [cursor=pointer]:
                  - /url: /availability
                  - img [ref=e79]
                  - generic [ref=e81]: Calendar
              - listitem [ref=e82]:
                - link "Bookings" [ref=e83] [cursor=pointer]:
                  - /url: /bookings
                  - img [ref=e84]
                  - generic [ref=e86]: Bookings
              - listitem [ref=e87]:
                - link "Taxes" [ref=e88] [cursor=pointer]:
                  - /url: /taxes
                  - img [ref=e89]
                  - generic [ref=e93]: Taxes
              - listitem [ref=e94]:
                - link "Guests" [ref=e95] [cursor=pointer]:
                  - /url: /guests
                  - img [ref=e96]
                  - generic [ref=e101]: Guests
              - listitem [ref=e102]:
                - link "Payments" [ref=e103] [cursor=pointer]:
                  - /url: /payments
                  - img [ref=e104]
                  - generic [ref=e106]: Payments
              - listitem [ref=e107]:
                - link "Experiences & Activities" [ref=e108] [cursor=pointer]:
                  - /url: /addons
                  - img [ref=e109]
                  - generic [ref=e111]: Experiences & Activities
              - listitem [ref=e112]:
                - link "Loyalty Program" [ref=e113] [cursor=pointer]:
                  - /url: /loyalty
                  - img [ref=e114]
                  - generic [ref=e118]: Loyalty Program
              - listitem [ref=e119]:
                - link "Google Reviews" [ref=e120] [cursor=pointer]:
                  - /url: /reviews
                  - img [ref=e121]
                  - generic [ref=e123]: Google Reviews
              - listitem [ref=e124]:
                - link "Channel Manager" [ref=e125] [cursor=pointer]:
                  - /url: /channel-settings
                  - img [ref=e126]
                  - generic [ref=e129]: Channel Manager
          - generic [ref=e130]:
            - generic [ref=e131]: System
            - list [ref=e133]:
              - listitem [ref=e134]:
                - link "Integration" [ref=e135] [cursor=pointer]:
                  - /url: /integration
                  - img [ref=e136]
                  - generic [ref=e138]: Integration
              - listitem [ref=e139]:
                - link "Settings" [ref=e140] [cursor=pointer]:
                  - /url: /settings
                  - img [ref=e141]
                  - generic [ref=e144]: Settings
        - generic [ref=e146]:
          - generic [ref=e148]: TR
          - generic [ref=e149]:
            - generic [ref=e150]: toufiq revmerito
            - generic [ref=e151]: tech.revmerito@gmail.com
          - button [ref=e152] [cursor=pointer]:
            - img
      - main [ref=e153]:
        - generic [ref=e154]:
          - button "Toggle Sidebar" [ref=e155] [cursor=pointer]:
            - img
            - generic [ref=e156]: Toggle Sidebar
          - button "Power House Main Branch" [ref=e157] [cursor=pointer]:
            - generic [ref=e158]:
              - img
            - generic [ref=e159]:
              - generic [ref=e160]: Power House
              - generic [ref=e161]: Main Branch
            - img
          - generic [ref=e163]:
            - img [ref=e164]
            - searchbox "Search bookings, rooms, guests..." [ref=e167]
          - generic [ref=e168]:
            - button "Switch to Dark Mode" [ref=e169] [cursor=pointer]:
              - img
            - button [ref=e170] [cursor=pointer]:
              - img
            - button "Notifications" [ref=e171] [cursor=pointer]:
              - img
              - generic [ref=e172]: Notifications
            - button "TR toufiq revmerito SUPER_ADMIN" [ref=e173] [cursor=pointer]:
              - generic [ref=e175]: TR
              - generic [ref=e176]:
                - generic [ref=e177]: toufiq revmerito
                - generic [ref=e178]: SUPER_ADMIN
              - img
        - main [ref=e179]:
          - generic [ref=e181]:
            - generic [ref=e183]:
              - heading "Dashboard" [level=1] [ref=e184]
              - paragraph [ref=e185]: Welcome back, toufiq. Here's what's happening today at Power House.
            - generic [ref=e186]:
              - generic [ref=e189]:
                - generic [ref=e190]: 🚀
                - generic [ref=e191]:
                  - heading "Status Update" [level=3] [ref=e192]
                  - paragraph [ref=e193]: Have a productive day managing your hotel! 👋
              - generic [ref=e194]:
                - generic [ref=e195]:
                  - generic [ref=e196]:
                    - heading "Arrivals" [level=3] [ref=e197]
                    - img [ref=e198]
                  - generic [ref=e204]: vs yesterday
                - generic [ref=e205]:
                  - generic [ref=e206]:
                    - heading "Departures" [level=3] [ref=e207]
                    - img [ref=e208]
                  - generic [ref=e215]: 0 scheduled today
                - generic [ref=e216]:
                  - generic [ref=e217]:
                    - heading "Occupancy" [level=3] [ref=e218]
                    - img [ref=e219]
                  - generic [ref=e224]: 0 rooms occupied
                - generic [ref=e225]:
                  - generic [ref=e226]:
                    - heading "Revenue" [level=3] [ref=e227]
                    - img [ref=e228]
                  - generic [ref=e233]: Today's total earnings
              - generic [ref=e234]:
                - generic [ref=e236]:
                  - generic [ref=e237]:
                    - generic [ref=e238]:
                      - heading "Recent Bookings" [level=3] [ref=e239]
                      - paragraph [ref=e240]: Latest guest activity
                    - link "View All" [ref=e241] [cursor=pointer]:
                      - /url: /bookings
                  - generic [ref=e243]: No bookings found
                - generic [ref=e245]:
                  - heading "Action Needed" [level=3] [ref=e247]
                  - generic [ref=e248]:
                    - generic [ref=e249]:
                      - generic [ref=e250]: "0"
                      - generic [ref=e251]: Pending
                    - paragraph [ref=e252]: Confirm bookings to secure your revenue.
                    - link "Review All" [ref=e253] [cursor=pointer]:
                      - /url: /bookings?status=pending
  - status [ref=e254]: Notification Welcome back!You have successfully logged in.
```

# Test source

```ts
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
> 182 |     await expect(page.getByRole('link', { name: /View All/i })).toBeVisible({ timeout: LOAD_TIMEOUT });
      |                                                                 ^ Error: expect(locator).toBeVisible() failed
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
  223 |     await expect(page.getByPlaceholder(/Search rooms/i)).toBeVisible({ timeout: LOAD_TIMEOUT });
  224 |   });
  225 | 
  226 |   test('clicking Packages tab changes title to Packages', async ({ page }) => {
  227 |     await page.getByRole('button', { name: /^Packages$/i }).click();
  228 |     await expect(page.getByRole('heading', { name: /Packages/i })).toBeVisible({ timeout: 5_000 });
  229 |     await expect(page.getByRole('button', { name: /Add Package/i })).toBeVisible({ timeout: 5_000 });
  230 |   });
  231 | 
  232 |   test('grid/list view toggle buttons exist', async ({ page }) => {
  233 |     // Grid and List buttons are icon-only buttons
  234 |     const gridBtn = page.locator('[title*="grid"], button:has(svg.lucide-grid)').first();
  235 |     const listBtn = page.locator('[title*="list"], button:has(svg.lucide-list)').first();
  236 |     // At least one should be present
  237 |     const gridVisible = await gridBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  238 |     const listVisible = await listBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  239 |     expect(gridVisible || listVisible).toBeTruthy();
  240 |   });
  241 | 
  242 |   test('no crash on rooms page', async ({ page }) => {
  243 |     await noCrash(page);
  244 |   });
  245 | });
  246 | 
  247 | // ════════════════════════════════════════════════════════════
  248 | //  4. BOOKINGS PAGE
  249 | // ════════════════════════════════════════════════════════════
  250 | 
  251 | test.describe('📋 Bookings', () => {
  252 |   test.beforeEach(async ({ page }) => {
  253 |     await login(page);
  254 |     await goTo(page, '/bookings');
  255 |   });
  256 | 
  257 |   test('page title is Bookings', async ({ page }) => {
  258 |     await expect(page.getByRole('heading', { name: /^Bookings$/i })).toBeVisible({ timeout: LOAD_TIMEOUT });
  259 |   });
  260 | 
  261 |   test('subtitle text present', async ({ page }) => {
  262 |     await expect(page.getByText(/View and manage all reservations/i)).toBeVisible({ timeout: LOAD_TIMEOUT });
  263 |   });
  264 | 
  265 |   test('tabs: Confirmed Bookings & AI Enquiries', async ({ page }) => {
  266 |     await expect(page.getByRole('tab', { name: /Confirmed Bookings/i })).toBeVisible({ timeout: LOAD_TIMEOUT });
  267 |     await expect(page.getByRole('tab', { name: /AI Enquiries/i })).toBeVisible({ timeout: LOAD_TIMEOUT });
  268 |   });
  269 | 
  270 |   test('table column headers are correct', async ({ page }) => {
  271 |     const headers = ['Booking ID', 'Guest', 'Room', 'Check In', 'Check Out', 'Source', 'Status', 'Total'];
  272 |     for (const h of headers) {
  273 |       await expect(page.getByRole('columnheader', { name: h })).toBeVisible({ timeout: LOAD_TIMEOUT });
  274 |     }
  275 |   });
  276 | 
  277 |   test('search input is present with correct placeholder', async ({ page }) => {
  278 |     await expect(
  279 |       page.getByPlaceholder('Search name, booking ID, email, phone...')
  280 |     ).toBeVisible({ timeout: LOAD_TIMEOUT });
  281 |   });
  282 | 
```