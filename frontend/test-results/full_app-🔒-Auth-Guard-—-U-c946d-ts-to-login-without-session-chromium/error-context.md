# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full_app.spec.ts >> 🔒 Auth Guard — Unauthenticated Redirects >> /analytics → redirects to /login without session
- Location: tests\e2e\full_app.spec.ts:619:5

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [active]:
  - generic:
    - region "Notifications (F8)":
      - list
    - region "Notifications alt+T"
```

# Test source

```ts
  526 |     expect(overflow).toBeFalsy();
  527 |   });
  528 | 
  529 |   test('promo code input accepts text', async ({ page }) => {
  530 |     const promoInput = page.locator('input[placeholder*="Optional"], input[placeholder*="Promo"]').first();
  531 |     if (await promoInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
  532 |       await promoInput.fill('TESTCODE');
  533 |       await expect(promoInput).toHaveValue('TESTCODE');
  534 |     }
  535 |   });
  536 | });
  537 | 
  538 | // ════════════════════════════════════════════════════════════
  539 | //  9. WIDGET — MOBILE VIEW (390px viewport)
  540 | // ════════════════════════════════════════════════════════════
  541 | 
  542 | test.describe('📱 Widget — Mobile Responsive', () => {
  543 |   test.use({ viewport: { width: 390, height: 844 } });
  544 | 
  545 |   const SLUG = 'powerhouse';
  546 | 
  547 |   test('widget is mobile-friendly (no horizontal overflow)', async ({ page }) => {
  548 |     await page.goto(`${BASE}/book/${SLUG}/widget`, { waitUntil: 'networkidle', timeout: API_TIMEOUT });
  549 |     await page.waitForTimeout(3000);
  550 | 
  551 |     const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
  552 |     expect(overflow).toBeFalsy();
  553 |     await noCrash(page);
  554 |   });
  555 | 
  556 |   test('mobile calendar opens inline (not popover)', async ({ page }) => {
  557 |     await page.goto(`${BASE}/book/${SLUG}/widget`, { waitUntil: 'networkidle', timeout: API_TIMEOUT });
  558 |     await page.waitForTimeout(3000);
  559 | 
  560 |     const dateTrigger = page.getByText(/Check.?in/i).first();
  561 |     await dateTrigger.click();
  562 |     await page.waitForTimeout(1000);
  563 | 
  564 |     // Mobile calendar renders inline — should see calendar grid
  565 |     const cal = page.getByRole('grid').first();
  566 |     const hasCalendar = await cal.isVisible({ timeout: 5_000 }).catch(() => false);
  567 |     expect(hasCalendar).toBeTruthy();
  568 |     await noCrash(page);
  569 |   });
  570 | 
  571 |   test('mobile guest picker works', async ({ page }) => {
  572 |     await page.goto(`${BASE}/book/${SLUG}/widget`, { waitUntil: 'networkidle', timeout: API_TIMEOUT });
  573 |     await page.waitForTimeout(3000);
  574 | 
  575 |     const guestTrigger = page.getByText(/Guests.*rooms|Guests & rooms/i).first();
  576 |     if (await guestTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
  577 |       await guestTrigger.click();
  578 |       await page.waitForTimeout(500);
  579 |       // Adults label should be visible
  580 |       const hasAdults = await page.getByText('Adults').isVisible({ timeout: 3_000 }).catch(() => false);
  581 |       expect(hasAdults).toBeTruthy();
  582 |     }
  583 |     await noCrash(page);
  584 |   });
  585 | });
  586 | 
  587 | // ════════════════════════════════════════════════════════════
  588 | //  10. LEGAL & STATIC PAGES
  589 | // ════════════════════════════════════════════════════════════
  590 | 
  591 | test.describe('📄 Legal Pages', () => {
  592 |   const pages = [
  593 |     { path: '/privacy-policy',  name: 'Privacy Policy' },
  594 |     { path: '/terms-of-service',name: 'Terms of Service' },
  595 |     { path: '/refund-policy',   name: 'Refund Policy' },
  596 |     { path: '/cookie-policy',   name: 'Cookie Policy' },
  597 |     { path: '/contact-us',      name: 'Contact Us' },
  598 |     { path: '/data-deletion',   name: 'Data Deletion' },
  599 |   ];
  600 | 
  601 |   for (const { path, name } of pages) {
  602 |     test(`${name} loads without crash`, async ({ page }) => {
  603 |       await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
  604 |       await page.waitForTimeout(1000);
  605 |       expect(await page.title()).toBeTruthy();
  606 |       await noCrash(page);
  607 |     });
  608 |   }
  609 | });
  610 | 
  611 | // ════════════════════════════════════════════════════════════
  612 | //  11. UNAUTHENTICATED REDIRECT (Auth Guard)
  613 | // ════════════════════════════════════════════════════════════
  614 | 
  615 | test.describe('🔒 Auth Guard — Unauthenticated Redirects', () => {
  616 |   const guarded = ['/dashboard', '/rooms', '/bookings', '/analytics', '/settings'];
  617 | 
  618 |   for (const route of guarded) {
  619 |     test(`${route} → redirects to /login without session`, async ({ page }) => {
  620 |       await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
  621 |       await page.waitForTimeout(3500); // Auth context needs time to check session
  622 | 
  623 |       const url = page.url();
  624 |       const onLogin = url.includes('/login');
  625 |       const showsForm = await page.locator('input[type="email"]').isVisible({ timeout: 3_000 }).catch(() => false);
> 626 |       expect(onLogin || showsForm).toBeTruthy();
      |                                    ^ Error: expect(received).toBeTruthy()
  627 |     });
  628 |   }
  629 | });
  630 | 
  631 | // ════════════════════════════════════════════════════════════
  632 | //  12. VISUAL SCREENSHOTS (for manual review)
  633 | // ════════════════════════════════════════════════════════════
  634 | 
  635 | test.describe('📸 Screenshots', () => {
  636 |   test('capture login page', async ({ page }) => {
  637 |     await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: LOAD_TIMEOUT });
  638 |     await page.waitForSelector('input[type="email"]', { timeout: LOAD_TIMEOUT });
  639 |     await page.screenshot({ path: 'playwright-report/screenshots/01_login.png', fullPage: true });
  640 |   });
  641 | 
  642 |   test('capture dashboard', async ({ page }) => {
  643 |     await login(page);
  644 |     await page.waitForTimeout(3000);
  645 |     await page.screenshot({ path: 'playwright-report/screenshots/02_dashboard.png', fullPage: true });
  646 |   });
  647 | 
  648 |   test('capture bookings page', async ({ page }) => {
  649 |     await login(page);
  650 |     await goTo(page, '/bookings');
  651 |     await page.screenshot({ path: 'playwright-report/screenshots/03_bookings.png', fullPage: true });
  652 |   });
  653 | 
  654 |   test('capture rooms page', async ({ page }) => {
  655 |     await login(page);
  656 |     await goTo(page, '/rooms');
  657 |     await page.screenshot({ path: 'playwright-report/screenshots/04_rooms.png', fullPage: true });
  658 |   });
  659 | 
  660 |   test('capture public booking rooms', async ({ page }) => {
  661 |     await page.goto(`${BASE}/book/powerhouse/rooms`, { waitUntil: 'networkidle', timeout: API_TIMEOUT });
  662 |     await page.waitForTimeout(3000);
  663 |     await page.screenshot({ path: 'playwright-report/screenshots/05_booking_rooms.png', fullPage: true });
  664 |   });
  665 | 
  666 |   test('capture widget desktop', async ({ page }) => {
  667 |     await page.goto(`${BASE}/book/powerhouse/widget`, { waitUntil: 'networkidle', timeout: API_TIMEOUT });
  668 |     await page.waitForTimeout(4000);
  669 |     await page.screenshot({ path: 'playwright-report/screenshots/06_widget_desktop.png', fullPage: true });
  670 |   });
  671 | 
  672 |   test('capture widget with calendar open', async ({ page }) => {
  673 |     await page.goto(`${BASE}/book/powerhouse/widget`, { waitUntil: 'networkidle', timeout: API_TIMEOUT });
  674 |     await page.waitForTimeout(3000);
  675 |     const dateTrigger = page.getByText(/Check.?in/i).first();
  676 |     await dateTrigger.click();
  677 |     await page.waitForTimeout(2500); // Wait for calendar data to load
  678 |     await page.screenshot({ path: 'playwright-report/screenshots/07_widget_calendar.png', fullPage: true });
  679 |   });
  680 | 
  681 |   test('capture widget mobile', async ({ page }) => {
  682 |     await page.setViewportSize({ width: 390, height: 844 });
  683 |     await page.goto(`${BASE}/book/powerhouse/widget`, { waitUntil: 'networkidle', timeout: API_TIMEOUT });
  684 |     await page.waitForTimeout(4000);
  685 |     await page.screenshot({ path: 'playwright-report/screenshots/08_widget_mobile.png', fullPage: true });
  686 |   });
  687 | });
  688 | 
```