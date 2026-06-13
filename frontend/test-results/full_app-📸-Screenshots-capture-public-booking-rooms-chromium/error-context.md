# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full_app.spec.ts >> 📸 Screenshots >> capture public booking rooms
- Location: tests\e2e\full_app.spec.ts:660:3

# Error details

```
TimeoutError: page.goto: Timeout 20000ms exceeded.
Call log:
  - navigating to "https://app.staybooker.ai/book/powerhouse/rooms", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - generic [ref=e8]: S
          - generic [ref=e9]: Staybooker
          - generic [ref=e10]: · Secure Booking
        - generic [ref=e11]:
          - img [ref=e12]
          - generic [ref=e14]: 256-bit SSL Secured
    - main [ref=e15]:
      - generic [ref=e16]:
        - generic [ref=e19]:
          - generic [ref=e21] [cursor=pointer]:
            - img [ref=e23]
            - generic [ref=e25]: Search
          - generic [ref=e27]:
            - generic [ref=e28]: "2"
            - generic [ref=e29]: Select Rooms
          - generic [ref=e31]:
            - generic [ref=e32]: "3"
            - generic [ref=e33]: Enhance Stay
          - generic [ref=e35]:
            - generic [ref=e36]: "4"
            - generic [ref=e37]: Guest Info
        - generic [ref=e38]:
          - img "Power House - 2" [ref=e39]
          - generic [ref=e42]:
            - heading "Power House" [level=1] [ref=e43]
            - generic [ref=e45]: 4 Star Property
          - button [ref=e46] [cursor=pointer]:
            - img [ref=e47]
          - button [ref=e49] [cursor=pointer]:
            - img [ref=e50]
          - generic [ref=e52]:
            - button [ref=e53] [cursor=pointer]
            - button [ref=e54] [cursor=pointer]
            - button [ref=e55] [cursor=pointer]
            - button [ref=e56] [cursor=pointer]
        - generic [ref=e57]:
          - generic [ref=e58]:
            - generic [ref=e60]:
              - button "Rooms" [ref=e61] [cursor=pointer]:
                - img [ref=e62]
                - text: Rooms
              - button "Packages" [ref=e65] [cursor=pointer]:
                - img [ref=e66]
                - text: Packages
            - generic [ref=e68]:
              - button "Check In 13 Jun 2026 Saturday Check Out 14 Jun 2026 Sunday" [ref=e69] [cursor=pointer]:
                - generic [ref=e70]:
                  - img [ref=e72]
                  - generic [ref=e74]:
                    - generic [ref=e75]: Check In
                    - generic [ref=e76]: 13 Jun 2026
                    - generic [ref=e77]: Saturday
                - img [ref=e78]
                - generic [ref=e80]:
                  - img [ref=e82]
                  - generic [ref=e84]:
                    - generic [ref=e85]: Check Out
                    - generic [ref=e86]: 14 Jun 2026
                    - generic [ref=e87]: Sunday
              - button "Guests & Rooms 2 Guests 1 Room, 2 Adults" [ref=e88] [cursor=pointer]:
                - img [ref=e90]
                - generic [ref=e93]:
                  - generic [ref=e94]: Guests & Rooms
                  - generic [ref=e95]: 2 Guests
                  - generic [ref=e96]: 1 Room, 2 Adults
                - img [ref=e97]
              - generic [ref=e99]:
                - generic [ref=e100]: Promo Code
                - textbox "Optional" [ref=e101]
              - button "Search" [ref=e102] [cursor=pointer]:
                - img [ref=e103]
                - text: Search
            - generic [ref=e106]:
              - checkbox "Flexible Dates" [ref=e107] [cursor=pointer]
              - generic [ref=e108] [cursor=pointer]: Flexible Dates
          - generic [ref=e109]:
            - generic [ref=e110]:
              - img [ref=e112]
              - generic [ref=e114]:
                - heading "Staybooker Loyalty Program" [level=3] [ref=e115]
                - paragraph [ref=e116]: Enter your email to unlock exclusive member rates & redeem your points.
            - generic [ref=e118]:
              - textbox "Enter email address" [ref=e119]
              - button "Check" [disabled]
          - generic [ref=e120]:
            - generic [ref=e123]:
              - heading "Filter Rooms" [level=3] [ref=e124]:
                - img [ref=e125]
                - text: Filter Rooms
              - generic [ref=e128]:
                - generic [ref=e129]:
                  - generic [ref=e130]: Price Range
                  - generic [ref=e131]:
                    - slider [ref=e132] [cursor=pointer]: "20000"
                    - generic [ref=e133]:
                      - generic [ref=e134]: ₹0
                      - generic [ref=e135]: Up to ₹20,000
                - generic [ref=e136]:
                  - generic [ref=e137]: Meal Plan
                  - generic [ref=e138]:
                    - generic [ref=e139] [cursor=pointer]:
                      - checkbox "Room Only (EP)" [ref=e140]
                      - generic [ref=e141]: Room Only (EP)
                    - generic [ref=e142] [cursor=pointer]:
                      - checkbox "With Breakfast (CP)" [ref=e143]
                      - generic [ref=e144]: With Breakfast (CP)
                    - generic [ref=e145] [cursor=pointer]:
                      - checkbox "Half Board (MAP)" [ref=e146]
                      - generic [ref=e147]: Half Board (MAP)
                    - generic [ref=e148] [cursor=pointer]:
                      - checkbox "Full Board (AP)" [ref=e149]
                      - generic [ref=e150]: Full Board (AP)
              - button "Reset All Filters" [ref=e151] [cursor=pointer]
            - generic [ref=e152]:
              - generic [ref=e153]:
                - heading "4 Categories Available" [level=2] [ref=e154]:
                  - img [ref=e156]
                  - text: 4 Categories Available
                - generic [ref=e159]:
                  - generic [ref=e160]: Sort By
                  - combobox [ref=e161] [cursor=pointer]:
                    - option "Recommended" [selected]
                    - 'option "Price: Low to High"'
                    - 'option "Price: High to Low"'
              - generic [ref=e162]:
                - generic [ref=e164]:
                  - generic [ref=e165]:
                    - generic [ref=e166]:
                      - img "Executive Room - Romantic Lonavala Getaway Package" [ref=e167] [cursor=pointer]
                      - button [ref=e168] [cursor=pointer]:
                        - img [ref=e169]
                      - button [ref=e171] [cursor=pointer]:
                        - img [ref=e172]
                    - generic [ref=e184]: Available
                  - generic [ref=e185]:
                    - generic [ref=e186]:
                      - generic [ref=e187]:
                        - heading "Executive Room - Romantic Lonavala Getaway Package" [level=3] [ref=e188]
                        - generic [ref=e189]:
                          - generic [ref=e190]:
                            - img [ref=e191]
                            - text: 2 Adults
                          - generic [ref=e194]: •
                          - generic [ref=e195]:
                            - img [ref=e196]
                            - text: 317 ft²
                      - button "Room Details" [ref=e201] [cursor=pointer]
                    - generic [ref=e202]:
                      - generic "Free WiFi" [ref=e203]:
                        - img [ref=e204]
                        - generic [ref=e208]: Free WiFi
                      - generic "Air Conditioning" [ref=e209]:
                        - img [ref=e210]
                        - generic [ref=e215]: Air Conditioning
                      - generic "Smart TV" [ref=e216]:
                        - img [ref=e217]
                        - generic [ref=e220]: Smart TV
                    - generic [ref=e221]:
                      - generic [ref=e222]:
                        - generic [ref=e224]:
                          - generic [ref=e226]: EP
                          - generic [ref=e227]:
                            - generic [ref=e228]: Room Only
                            - generic [ref=e229]: Free cancellation up to 168 hours before check-in
                        - generic [ref=e230]:
                          - generic [ref=e231]:
                            - generic [ref=e232]:
                              - generic [ref=e233]: ₹15,000
                              - generic [ref=e234]: total
                            - paragraph [ref=e235]: ₹18,000
                          - button "Select" [ref=e236] [cursor=pointer]
                      - generic [ref=e237]:
                        - generic [ref=e239]:
                          - generic [ref=e241]: CP
                          - generic [ref=e242]:
                            - generic [ref=e243]: CP
                            - generic [ref=e244]: Free cancellation up to 24 hours before check-in
                        - generic [ref=e245]:
                          - generic [ref=e246]:
                            - generic [ref=e247]:
                              - generic [ref=e248]: ₹15,500
                              - generic [ref=e249]: total
                            - paragraph [ref=e250]: ₹18,000
                          - button "Select" [ref=e251] [cursor=pointer]
                - generic [ref=e253]:
                  - generic [ref=e254]:
                    - generic [ref=e255]:
                      - img "Executive Room" [ref=e256] [cursor=pointer]
                      - button [ref=e257] [cursor=pointer]:
                        - img [ref=e258]
                      - button [ref=e260] [cursor=pointer]:
                        - img [ref=e261]
                    - generic [ref=e272]: Available
                  - generic [ref=e273]:
                    - generic [ref=e274]:
                      - generic [ref=e275]:
                        - heading "Executive Room" [level=3] [ref=e276]
                        - generic [ref=e277]:
                          - generic [ref=e278]:
                            - img [ref=e279]
                            - text: 6 Adults
                          - generic [ref=e282]: •
                          - generic [ref=e283]:
                            - img [ref=e284]
                            - text: 220 ft²
                      - button "Room Details" [ref=e289] [cursor=pointer]
                    - generic "Air Conditioning" [ref=e291]:
                      - img [ref=e292]
                      - generic [ref=e297]: Air Conditioning
                    - generic [ref=e298]:
                      - generic [ref=e299]:
                        - generic [ref=e301]:
                          - generic [ref=e303]: EP
                          - generic [ref=e304]:
                            - generic [ref=e305]: Room Only
                            - generic [ref=e306]: Free cancellation up to 72 hours before check-in
                        - generic [ref=e307]:
                          - generic [ref=e309]:
                            - generic [ref=e310]: ₹10,000
                            - generic [ref=e311]: total
                          - button "Select" [ref=e312] [cursor=pointer]
                      - generic [ref=e313]:
                        - generic [ref=e315]:
                          - generic [ref=e317]: CP
                          - generic [ref=e318]:
                            - generic [ref=e319]: CP
                            - generic [ref=e320]: Non-Refundable
                        - generic [ref=e321]:
                          - generic [ref=e323]:
                            - generic [ref=e324]: ₹10,500
                            - generic [ref=e325]: total
                          - button "Select" [ref=e326] [cursor=pointer]
                - generic [ref=e328]:
                  - generic [ref=e329]:
                    - generic [ref=e330]:
                      - img "Romantic Lonavala Getaway" [ref=e331] [cursor=pointer]
                      - button [ref=e332] [cursor=pointer]:
                        - img [ref=e333]
                      - button [ref=e335] [cursor=pointer]:
                        - img [ref=e336]
                    - generic [ref=e347]: Available
                  - generic [ref=e348]:
                    - generic [ref=e349]:
                      - generic [ref=e350]:
                        - heading "Romantic Lonavala Getaway" [level=3] [ref=e351]
                        - generic [ref=e352]:
                          - generic [ref=e353]:
                            - img [ref=e354]
                            - text: 2 Adults
                          - generic [ref=e357]: •
                          - generic [ref=e358]:
                            - img [ref=e359]
                            - text: 300 ft²
                      - button "Room Details" [ref=e364] [cursor=pointer]
                    - generic [ref=e365]:
                      - generic "Free WiFi" [ref=e366]:
                        - img [ref=e367]
                        - generic [ref=e371]: Free WiFi
                      - generic "Air Conditioning" [ref=e372]:
                        - img [ref=e373]
                        - generic [ref=e378]: Air Conditioning
                      - generic "Smart TV" [ref=e379]:
                        - img [ref=e380]
                        - generic [ref=e383]: Smart TV
                    - generic [ref=e384]:
                      - generic [ref=e385]:
                        - generic [ref=e387]:
                          - generic [ref=e389]: EP
                          - generic [ref=e390]:
                            - generic [ref=e391]: Room Only
                            - generic [ref=e392]: Free cancellation up to 48 hours before check-in
                        - generic [ref=e393]:
                          - generic [ref=e395]:
                            - generic [ref=e396]: ₹5,800
                            - generic [ref=e397]: total
                          - button "Select" [ref=e398] [cursor=pointer]
                      - generic [ref=e399]:
                        - generic [ref=e401]:
                          - generic [ref=e403]: CP
                          - generic [ref=e404]:
                            - generic [ref=e405]: CP
                            - generic [ref=e406]: Non-Refundable
                        - generic [ref=e407]:
                          - generic [ref=e409]:
                            - generic [ref=e410]: ₹6,300
                            - generic [ref=e411]: total
                          - button "Select" [ref=e412] [cursor=pointer]
                - generic [ref=e414]:
                  - generic [ref=e415]:
                    - generic [ref=e416]:
                      - img "Deluxe" [ref=e417] [cursor=pointer]
                      - button [ref=e418] [cursor=pointer]:
                        - img [ref=e419]
                      - button [ref=e421] [cursor=pointer]:
                        - img [ref=e422]
                    - generic [ref=e433]: Available
                  - generic [ref=e434]:
                    - generic [ref=e435]:
                      - generic [ref=e436]:
                        - heading "Deluxe" [level=3] [ref=e437]
                        - generic [ref=e438]:
                          - generic [ref=e439]:
                            - img [ref=e440]
                            - text: 2 Adults
                          - generic [ref=e443]: •
                          - generic [ref=e444]:
                            - img [ref=e445]
                            - text: 297 ft²
                      - button "Room Details" [ref=e450] [cursor=pointer]
                    - generic "Free WiFi" [ref=e452]:
                      - img [ref=e453]
                      - generic [ref=e457]: Free WiFi
                    - generic [ref=e458]:
                      - generic [ref=e459]:
                        - generic [ref=e461]:
                          - generic [ref=e463]: EP
                          - generic [ref=e464]:
                            - generic [ref=e465]: Room Only
                            - generic [ref=e466]: Free cancellation up to 48 hours before check-in
                        - generic [ref=e467]:
                          - generic [ref=e469]:
                            - generic [ref=e470]: ₹420
                            - generic [ref=e471]: total
                          - button "Select" [ref=e472] [cursor=pointer]
                      - generic [ref=e473]:
                        - generic [ref=e475]:
                          - generic [ref=e477]: CP
                          - generic [ref=e478]:
                            - generic [ref=e479]: CP
                            - generic [ref=e480]: Free cancellation up to 48 hours before check-in
                        - generic [ref=e481]:
                          - generic [ref=e483]:
                            - generic [ref=e484]: ₹920
                            - generic [ref=e485]: total
                          - button "Select" [ref=e486] [cursor=pointer]
        - button "Chat Live Concierge How can I help?" [ref=e488] [cursor=pointer]:
          - img "Chat" [ref=e491]
          - generic [ref=e492]:
            - generic [ref=e493]: Live Concierge
            - generic [ref=e494]: How can I help?
    - generic [ref=e496]:
      - generic [ref=e498]:
        - generic [ref=e499]:
          - img "Power House" [ref=e502]
          - generic [ref=e503]:
            - generic [ref=e504]:
              - heading "Power House" [level=2] [ref=e505]
              - generic [ref=e506]:
                - img [ref=e507]
                - generic [ref=e510]: vasai, maharashtra
              - paragraph [ref=e511]: Nestled in a prime location, our hotel offers a perfect blend of comfort, elegance, and modern hospitality. Designed for both business and leisure travelers, we provide well-appointed rooms, premium amenities, seamless service, and a relaxing atmosphere to ensure a memorable stay. Guests can enjoy spacious accommodations, high-speed Wi-Fi, in-room dining, and easy access to nearby attractions and transportation hubs. Whether you are visiting for work, vacation, or a weekend getaway, we are committed to delivering exceptional comfort and personalized experiences throughout your stay.
            - generic [ref=e512]:
              - link "Home" [ref=e513] [cursor=pointer]:
                - /url: https://www.rydges.com/accommodation/regional-nsw/powerhouse-hotel-tamworth
              - button "Privacy Policy" [ref=e514] [cursor=pointer]
              - button "Payment Terms" [ref=e515] [cursor=pointer]
        - generic [ref=e516]:
          - generic [ref=e517]:
            - img [ref=e518]
            - heading "Important Info" [level=3] [ref=e521]
          - generic [ref=e522]:
            - generic [ref=e523]:
              - paragraph [ref=e524]: Cancellation Policy
              - paragraph [ref=e526]: Free cancellation up to 24 hours before check-in. Cancellations made within 24 hours of arrival may incur a one-night charge.
            - generic [ref=e527]:
              - paragraph [ref=e528]: Payment Policy
              - paragraph [ref=e530]: Guests may pay online at the time of booking or at the property, subject to availability and hotel rules.
            - generic [ref=e531]:
              - paragraph [ref=e532]: Child Policy
              - paragraph [ref=e534]: Children below 5 years stay free when using existing bedding. Extra beds are subject to availability and additional charges.
            - generic [ref=e535]:
              - paragraph [ref=e536]: Privacy Policy
              - paragraph [ref=e538]: Guest information is collected solely for booking and hospitality purposes and is not shared with third parties except where required by law.
            - generic [ref=e539]:
              - paragraph [ref=e540]: Important Information
              - paragraph [ref=e542]: Valid government-issued photo identification is required at check-in. Early check-in and late check-out are subject to availability. The hotel reserves the right to refuse service in accordance with applicable laws and regulations.
      - generic [ref=e543]:
        - generic [ref=e544]:
          - img [ref=e545]
          - generic [ref=e548]: Power House, vasai west dattani prism it park 308, vasai, maharashtra, india , 401207
        - generic [ref=e550]: "Business/GST No: 32erfgbv32ewdscx 21wq"
    - contentinfo [ref=e551]:
      - generic [ref=e552]:
        - paragraph [ref=e553]: Powered by Staybooker.ai
        - generic [ref=e554]:
          - link "Cancel Booking" [ref=e555] [cursor=pointer]:
            - /url: /book/powerhouse/cancel
          - generic [ref=e556]: ·
          - generic [ref=e557]:
            - img [ref=e558]
            - text: Secure Payments
          - generic [ref=e560]: ·
          - generic [ref=e561]: Privacy Protected
          - generic [ref=e562]: ·
          - generic [ref=e563]: Best Price Guaranteed
```

# Test source

```ts
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
  626 |       expect(onLogin || showsForm).toBeTruthy();
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
> 661 |     await page.goto(`${BASE}/book/powerhouse/rooms`, { waitUntil: 'networkidle', timeout: API_TIMEOUT });
      |                ^ TimeoutError: page.goto: Timeout 20000ms exceeded.
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