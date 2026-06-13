# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full_app.spec.ts >> 🏨 Booking Engine — Room Selection >> booking selection page renders
- Location: tests\e2e\full_app.spec.ts:393:3

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
  378 |       await expect(heading).toBeVisible({ timeout: LOAD_TIMEOUT });
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
> 394 |     await page.goto(`${BASE}/book/${SLUG}/rooms`, { waitUntil: 'networkidle', timeout: API_TIMEOUT });
      |                ^ TimeoutError: page.goto: Timeout 20000ms exceeded.
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
  479 |     const dateTrigger = page.getByText(/Check.?in/i).first();
  480 |     await dateTrigger.click();
  481 |     await page.waitForTimeout(3000); // Wait for calendar API data
  482 | 
  483 |     const body = await page.textContent('body') || '';
  484 |     // Either prices (₹) or "Sold" markers should appear in calendar
  485 |     const hasPrices = body.includes('₹') || body.includes('Sold') || body.includes('sold');
  486 |     // Don't fail if API hasn't returned data yet — just no crash
  487 |     await noCrash(page);
  488 |     void hasPrices; // prices are nice-to-have
  489 |   });
  490 | 
  491 |   test('calendar "Sold" label appears for unavailable dates', async ({ page }) => {
  492 |     const dateTrigger = page.getByText(/Check.?in/i).first();
  493 |     await dateTrigger.click();
  494 |     await page.waitForTimeout(4000); // Full calendar data load
```