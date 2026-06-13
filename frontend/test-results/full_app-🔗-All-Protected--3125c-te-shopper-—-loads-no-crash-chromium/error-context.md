# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full_app.spec.ts >> 🔗 All Protected Routes >> Rate Shopper (/rate-shopper) — loads, no crash
- Location: tests\e2e\full_app.spec.ts:370:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading').first()
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('heading').first()

```

```yaml
- region "Notifications (F8)":
  - list
- region "Notifications alt+T"
- img "Logo"
- text: Power House Super Admin Main Menu
- list:
  - listitem:
    - link "Brand Console":
      - /url: /chain/dashboard
      - img
      - text: Brand Console
  - listitem:
    - link "Dashboard":
      - /url: /dashboard
      - img
      - text: Dashboard
  - listitem:
    - link "Analytics":
      - /url: /analytics
      - img
      - text: Analytics
  - listitem:
    - link "AI Assistant":
      - /url: /agent
      - img
      - text: AI Assistant
  - listitem:
    - link "Rooms":
      - /url: /rooms
      - img
      - text: Rooms
  - listitem:
    - link "Rate Plans":
      - /url: /rates
      - img
      - text: Rate Plans
  - listitem:
    - link "Rate Shopper":
      - /url: /rate-shopper
      - img
      - text: Rate Shopper
  - listitem:
    - link "Calendar":
      - /url: /availability
      - img
      - text: Calendar
  - listitem:
    - link "Bookings":
      - /url: /bookings
      - img
      - text: Bookings
  - listitem:
    - link "Taxes":
      - /url: /taxes
      - img
      - text: Taxes
  - listitem:
    - link "Guests":
      - /url: /guests
      - img
      - text: Guests
  - listitem:
    - link "Payments":
      - /url: /payments
      - img
      - text: Payments
  - listitem:
    - link "Experiences & Activities":
      - /url: /addons
      - img
      - text: Experiences & Activities
  - listitem:
    - link "Loyalty Program":
      - /url: /loyalty
      - img
      - text: Loyalty Program
  - listitem:
    - link "Google Reviews":
      - /url: /reviews
      - img
      - text: Google Reviews
  - listitem:
    - link "Channel Manager":
      - /url: /channel-settings
      - img
      - text: Channel Manager
- text: System
- list:
  - listitem:
    - link "Integration":
      - /url: /integration
      - img
      - text: Integration
  - listitem:
    - link "Settings":
      - /url: /settings
      - img
      - text: Settings
- text: TR toufiq revmerito tech.revmerito@gmail.com
- button:
  - img
- main:
  - button "Toggle Sidebar":
    - img
    - text: Toggle Sidebar
  - button "Power House Main Branch":
    - img
    - text: Power House Main Branch
    - img
  - img
  - searchbox "Search bookings, rooms, guests..."
  - button "Switch to Dark Mode":
    - img
  - button:
    - img
  - button "Notifications":
    - img
    - text: Notifications
  - button "TR toufiq revmerito SUPER_ADMIN":
    - text: TR toufiq revmerito SUPER_ADMIN
    - img
  - main
```

# Test source

```ts
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
  363 |     { path: '/settings',         name: 'Settings' },
  364 |     { path: '/integration',      name: 'Integrations' },
  365 |     { path: '/channel-settings', name: 'Channel Settings' },
  366 |     { path: '/admin',            name: 'Admin' },
  367 |   ];
  368 | 
  369 |   for (const { path, name } of routes) {
  370 |     test(`${name} (${path}) — loads, no crash`, async ({ page }) => {
  371 |       await goTo(page, path);
  372 | 
  373 |       // Must not bounce back to login
  374 |       expect(page.url()).not.toContain('/login');
  375 | 
  376 |       // Page should have some content
  377 |       const heading = page.getByRole('heading').first();
> 378 |       await expect(heading).toBeVisible({ timeout: LOAD_TIMEOUT });
      |                             ^ Error: expect(locator).toBeVisible() failed
  379 | 
  380 |       await noCrash(page);
  381 |     });
  382 |   }
  383 | });
  384 | 
  385 | // ════════════════════════════════════════════════════════════
  386 | //  7. PUBLIC BOOKING ENGINE — Room Selection
  387 | // ════════════════════════════════════════════════════════════
  388 | 
  389 | test.describe('🏨 Booking Engine — Room Selection', () => {
  390 |   // Use a slug that exists in production
  391 |   const SLUG = 'powerhouse';
  392 | 
  393 |   test('booking selection page renders', async ({ page }) => {
  394 |     await page.goto(`${BASE}/book/${SLUG}/rooms`, { waitUntil: 'networkidle', timeout: API_TIMEOUT });
  395 |     const title = await page.title();
  396 |     expect(title).toBeTruthy();
  397 |     await noCrash(page);
  398 |   });
  399 | 
  400 |   test('search / date bar is visible', async ({ page }) => {
  401 |     await page.goto(`${BASE}/book/${SLUG}/rooms`, { waitUntil: 'networkidle', timeout: API_TIMEOUT });
  402 |     // The booking selection page has check-in / check-out somewhere
  403 |     const hasDateBar = await page.getByText(/Check.?in/i).first().isVisible({ timeout: 10_000 }).catch(() => false);
  404 |     expect(hasDateBar).toBeTruthy();
  405 |   });
  406 | 
  407 |   test('unknown hotel slug does not crash', async ({ page }) => {
  408 |     await page.goto(`${BASE}/book/no-such-hotel-xyz/rooms`, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
  409 |     await page.waitForTimeout(2000);
  410 |     await noCrash(page);
  411 |   });
  412 | 
  413 |   test('confirmation page renders without crash', async ({ page }) => {
  414 |     await page.goto(`${BASE}/book/${SLUG}/confirmation`, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
  415 |     await page.waitForTimeout(1500);
  416 |     await noCrash(page);
  417 |   });
  418 | 
  419 |   test('cancel page renders without crash', async ({ page }) => {
  420 |     await page.goto(`${BASE}/book/${SLUG}/cancel`, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
  421 |     await page.waitForTimeout(1500);
  422 |     await noCrash(page);
  423 |   });
  424 | });
  425 | 
  426 | // ════════════════════════════════════════════════════════════
  427 | //  8. BOOKING WIDGET (iframe embed) — FULL CALENDAR TEST
  428 | // ════════════════════════════════════════════════════════════
  429 | 
  430 | test.describe('📅 Booking Widget & Calendar', () => {
  431 |   const SLUG = 'powerhouse';
  432 | 
  433 |   test.beforeEach(async ({ page }) => {
  434 |     await page.goto(`${BASE}/book/${SLUG}/widget`, { waitUntil: 'networkidle', timeout: API_TIMEOUT });
  435 |     // Wait for React to mount + calendar data to load
  436 |     await page.waitForTimeout(3000);
  437 |   });
  438 | 
  439 |   test('widget renders without crash', async ({ page }) => {
  440 |     await noCrash(page);
  441 |   });
  442 | 
  443 |   test('Check-in and Check-out labels visible', async ({ page }) => {
  444 |     await expect(page.getByText(/Check.?in/i).first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  445 |     await expect(page.getByText(/Check.?out/i).first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  446 |   });
  447 | 
  448 |   test('Guests & Rooms label visible', async ({ page }) => {
  449 |     await expect(page.getByText(/Guests.*rooms|Guests & rooms/i).first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  450 |   });
  451 | 
  452 |   test('Search button is visible and clickable', async ({ page }) => {
  453 |     const searchBtn = page.getByRole('button', { name: /^Search$/i }).first();
  454 |     await expect(searchBtn).toBeVisible({ timeout: LOAD_TIMEOUT });
  455 |     await searchBtn.click();
  456 |     await page.waitForTimeout(1000);
  457 |     await noCrash(page);
  458 |   });
  459 | 
  460 |   test('calendar opens on check-in click (desktop)', async ({ page }) => {
  461 |     // Click the date trigger
  462 |     const dateTrigger = page.getByText(/Check.?in/i).first();
  463 |     await dateTrigger.click();
  464 |     // Calendar header with month name should appear
  465 |     await expect(page.getByRole('grid').first()).toBeVisible({ timeout: 8_000 });
  466 |   });
  467 | 
  468 |   test('calendar shows month navigation buttons', async ({ page }) => {
  469 |     const dateTrigger = page.getByText(/Check.?in/i).first();
  470 |     await dateTrigger.click();
  471 |     await page.waitForTimeout(800);
  472 |     // Next month button
  473 |     const nextBtn = page.locator('button[name="next-month"], button[aria-label*="next"], nav button').last();
  474 |     const hasNav = await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  475 |     expect(hasNav).toBeTruthy();
  476 |   });
  477 | 
  478 |   test('calendar shows prices on dates (or loading state)', async ({ page }) => {
```