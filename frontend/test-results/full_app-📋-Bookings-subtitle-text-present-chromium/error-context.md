# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full_app.spec.ts >> 📋 Bookings >> subtitle text present
- Location: tests\e2e\full_app.spec.ts:261:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/View and manage all reservations/i)
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText(/View and manage all reservations/i)

```

```yaml
- region "Notifications (F8)":
  - list
- region "Notifications alt+T"
- img
- text: Loading…
```

# Test source

```ts
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
> 262 |     await expect(page.getByText(/View and manage all reservations/i)).toBeVisible({ timeout: LOAD_TIMEOUT });
      |                                                                       ^ Error: expect(locator).toBeVisible() failed
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
  283 |   test('status filter dropdown is present', async ({ page }) => {
  284 |     // "All Status" trigger text
  285 |     await expect(page.getByText('All Status').first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  286 |   });
  287 | 
  288 |   test('Export CSV button is visible', async ({ page }) => {
  289 |     await expect(page.getByRole('button', { name: /Export CSV/i }).first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  290 |   });
  291 | 
  292 |   test('filtering by non-existent query shows empty state', async ({ page }) => {
  293 |     const searchInput = page.getByPlaceholder('Search name, booking ID, email, phone...');
  294 |     await searchInput.fill('ZZZNOMATCH99999');
  295 |     await page.waitForTimeout(600);
  296 |     const body = await page.textContent('body') || '';
  297 |     expect(
  298 |       body.includes('No Bookings Found') || body.includes('Showing 0')
  299 |     ).toBeTruthy();
  300 |   });
  301 | 
  302 |   test('AI Enquiries tab shows leads columns', async ({ page }) => {
  303 |     await page.getByRole('tab', { name: /AI Enquiries/i }).click();
  304 |     await page.waitForTimeout(1000);
  305 |     await expect(page.getByText('Guest Name').first()).toBeVisible({ timeout: 8_000 });
  306 |     await noCrash(page);
  307 |   });
  308 | 
  309 |   test('no crash on bookings page', async ({ page }) => {
  310 |     await noCrash(page);
  311 |   });
  312 | });
  313 | 
  314 | // ════════════════════════════════════════════════════════════
  315 | //  5. GUESTS PAGE
  316 | // ════════════════════════════════════════════════════════════
  317 | 
  318 | test.describe('👥 Guests', () => {
  319 |   test.beforeEach(async ({ page }) => {
  320 |     await login(page);
  321 |     await goTo(page, '/guests');
  322 |   });
  323 | 
  324 |   test('guests page loads without crash', async ({ page }) => {
  325 |     await expect(page.getByRole('heading').first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  326 |     await noCrash(page);
  327 |   });
  328 | 
  329 |   test('search or filter input exists', async ({ page }) => {
  330 |     const hasSearch = await page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]').first()
  331 |       .isVisible({ timeout: 8_000 }).catch(() => false);
  332 |     // OK if no search visible — just ensure no crash
  333 |     await noCrash(page);
  334 |     // suppress unused variable
  335 |     void hasSearch;
  336 |   });
  337 | });
  338 | 
  339 | // ════════════════════════════════════════════════════════════
  340 | //  6. ALL PROTECTED ROUTES (Auth + No-Crash)
  341 | // ════════════════════════════════════════════════════════════
  342 | 
  343 | test.describe('🔗 All Protected Routes', () => {
  344 |   test.beforeEach(async ({ page }) => {
  345 |     await login(page);
  346 |   });
  347 | 
  348 |   const routes: Array<{ path: string; name: string }> = [
  349 |     { path: '/dashboard',        name: 'Dashboard' },
  350 |     { path: '/rooms',            name: 'Rooms' },
  351 |     { path: '/rates',            name: 'Rates' },
  352 |     { path: '/rate-shopper',     name: 'Rate Shopper' },
  353 |     { path: '/availability',     name: 'Availability' },
  354 |     { path: '/analytics',        name: 'Analytics' },
  355 |     { path: '/bookings',         name: 'Bookings' },
  356 |     { path: '/guests',           name: 'Guests' },
  357 |     { path: '/payments',         name: 'Payments' },
  358 |     { path: '/addons',           name: 'Add-ons' },
  359 |     { path: '/taxes',            name: 'Taxes' },
  360 |     { path: '/reviews',          name: 'Reviews' },
  361 |     { path: '/loyalty',          name: 'Loyalty' },
  362 |     { path: '/agent',            name: 'AI Agent' },
```