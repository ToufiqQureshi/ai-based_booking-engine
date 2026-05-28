// Scraper.js - Injected into MMT or Agoda Page
// Supports: MakeMyTrip, Agoda
// Updated: Robust Agoda Support (Hash Dates + Regex Price)

(function () {
    const HOST = window.location.hostname;
    const DEBUG = true; // Set to true to show visual banners during scraping

    if (DEBUG) console.log("[Extension] Scraper Injected on:", HOST);

    // 1. ADD VISUAL BANNER (Debug Only)
    let banner = null;
    if (DEBUG) {
        banner = document.createElement("div");
        banner.style.position = "fixed";
        banner.style.top = "0";
        banner.style.left = "0";
        banner.style.width = "100%";
        banner.style.backgroundColor = "red";
        banner.style.color = "white";
        banner.style.zIndex = "2147483647"; // Max Z-Index
        banner.style.textAlign = "center";
        banner.style.padding = "15px";
        banner.style.fontSize = "18px";
        banner.style.fontWeight = "bold";
        banner.style.fontFamily = "monospace";
        banner.innerText = `STAYBOOKER: Loading... (${HOST})`;
        document.body.prepend(banner);
    }

    // 2. HUMAN BEHAVIOR SIMULATION
    function simulateHumanScroll() {
        return new Promise(resolve => {
            let totalHeight = 0;
            let distance = 100;
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                // Scroll down a bit, then stop
                if (totalHeight >= 600 || totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    window.scrollTo(0, 0); // Go back up slightly
                    resolve();
                }
            }, 100);
        });
    }

    function getElementByXpath(path) {
        return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }

    // =========================================================================
    // HELPER: DATE PARSER (CRITICAL FOR AGODA)
    // =========================================================================
    function getCheckinDateFromUrl() {
        // 1. Try Query Params (Standard)
        const urlParams = new URLSearchParams(window.location.search);
        let checkin = urlParams.get('checkin') || urlParams.get('checkIn') || urlParams.get('checkinDate');

        // 2. Try Hash Params (Agoda often uses #checkIn=...)
        // e.g., #checkIn=2026-02-02
        if (!checkin && window.location.hash) {
            // Hash might act like query string
            try {
                const hashStr = window.location.hash.substring(1); // Remove #
                const hashParams = new URLSearchParams(hashStr);
                checkin = hashParams.get('checkin') || hashParams.get('checkIn');
            } catch (e) { console.warn("Hash Parse Fail", e); }
        }

        if (!checkin) {
            console.log("[Extension] No Checkin Found. Defaulting to Today.");
            return new Date().toISOString().split('T')[0];
        }

        // Normalize MMT 02022026 to 2026-02-02
        if (checkin.length === 8 && !checkin.includes('-')) {
            const m = checkin.substring(0, 2);
            const d = checkin.substring(2, 4);
            const y = checkin.substring(4, 8);
            return `${y}-${m}-${d}`;
        }

        return checkin;
    }

    // =========================================================================
    // STRATEGY: MAKEMYTRIP / GOIBIBO
    // =========================================================================
    function scrapeMMT() {
        let price = 0;
        let roomName = "Standard Room";
        let isSoldOut = false;

        // 1. Sold Out Check
        const soldOutSelectors = [
            ".htlSoldOutNew.soldOut", ".soldOutTxt",
            "//h4[contains(text(),'You Just Missed It')]",
            "//div[contains(@class,'hdrContainer__right--soldOut')]", 
            ".soldOut", ".sold-out-tag", ".not-available-msg"
        ];
        for (let sel of soldOutSelectors) {
            try {
                let el = sel.startsWith("//") ? getElementByXpath(sel) : document.querySelector(sel);
                if (el && el.offsetParent !== null) {
                    isSoldOut = true;
                    roomName = "Sold Out";
                    break;
                }
            } catch (e) { }
        }

        const bodyText = document.body.innerText;
        if (!isSoldOut && (bodyText.includes("You Just Missed It") || bodyText.includes("Sold Out"))) {
            isSoldOut = true;
            roomName = "Sold Out";
        }

        if (isSoldOut) return { is_sold_out: true, price: 0, room_type: "Sold Out" };

        // 2. Price Check
        const priceSelectors = [
            "#hlistpg_hotel_shown_price", "[id^='hlistpg_hotel_shown_price']",
            ".latoBlack.font28", ".font22.latoBlack", ".font26.latoBlack",
            "p[id*='hlistpg_hotel_shown_price']",
            ".pd-price__price-value", // Goibibo style
            "//div[contains(@class,'priceDetails')]//p[contains(@class,'latoBlack')]"
        ];

        let priceText = null;
        for (let sel of priceSelectors) {
            try {
                let el = sel.startsWith("//") ? getElementByXpath(sel) : document.querySelector(sel);
                if (el && el.innerText && el.innerText.trim()) {
                    priceText = el.innerText;
                    break;
                }
            } catch (e) { }
        }

        if (priceText) price = parseFloat(priceText.replace(/[^\d.]/g, ''));
        if (isNaN(price)) price = 0;

        // 3. Room Name
        const roomSelectors = [".bkngOption__title", ".room-type-name", ".roomName"];
        for (let sel of roomSelectors) {
            const el = document.querySelector(sel);
            if (el && el.innerText) {
                roomName = el.innerText.trim();
                break;
            }
        }

        return { is_sold_out: false, price: price, room_type: roomName };
    }

    // =========================================================================
    // STRATEGY: AGODA
    // =========================================================================
    function scrapeAgoda() {
        let price = 0;
        let roomName = "Agoda Room";
        let isSoldOut = false;

        // 1. Sold Out Check
        const soldOutTexts = ["Sold out on your dates!", "no rooms available", "sold out", "We're sorry"];
        const agodaBody = document.body.innerText;
        for (let txt of soldOutTexts) {
            if (agodaBody.toLowerCase().includes(txt.toLowerCase())) {
                isSoldOut = true;
                break;
            }
        }

        if (isSoldOut) return { is_sold_out: true, price: 0, room_type: "Sold Out" };

        // 2. Price Check (Using advanced selectors from agoda_scraper.js)
        const priceSelectors = [
            "[data-selenium='display-price']",
            ".StickyNavPrice__priceDetail",
            "[data-selenium='hotel-price']",
            ".PropertyCardPrice__Value",
            ".CheapestPriceLabel",
            "[data-element-name='final-price']",
            ".pd-price__price-value",
            "//span[@data-selenium='display-price']",
            "//span[contains(@class,'PriceContainer-value')]"
        ];

        let priceText = null;
        for (let sel of priceSelectors) {
            try {
                let el = sel.startsWith("//") ? getElementByXpath(sel) : document.querySelector(sel);
                if (el && el.innerText && el.offsetParent !== null) {
                    priceText = el.innerText.trim();
                    console.log(`[Agoda] Match via: ${sel}`);
                    break;
                }
            } catch (e) { }
        }

        // AGODA FALLBACK: Regex Search for INR/₹ pattern
        if (!priceText || parseFloat(priceText.replace(/[^\d.]/g, '')) < 100) {
            const match = agodaBody.match(/(₹|INR|Rs\.?)\s?([\d,]+)/i);
            if (match) {
                priceText = match[2];
                console.log("[Agoda] Regex fallback success");
            }
        }

        if (priceText) price = parseFloat(priceText.replace(/[^\d.]/g, ''));
        if (isNaN(price)) price = 0;

        // 3. Room Name
        const roomTypeElement = document.querySelector('.room-type-name, .RoomRow-module__room-name, [data-selenium="room-name"]');
        if (roomTypeElement) roomName = roomTypeElement.textContent.trim();

        return { is_sold_out: false, price: price, room_type: roomName };
    }


    // =========================================================================
    // MAIN LOOP
    // =========================================================================
    // Random Start Delay (3-6s) + Scroll
    const startDelay = Math.floor(Math.random() * 3000) + 3000;

    if (DEBUG) console.log(`[Extension] Waiting ${startDelay}ms for Page Load...`);

    setTimeout(async () => {
        // Run Scroll Simulation
        await simulateHumanScroll();

        let attempts = 0;
        const maxAttempts = 8;

        const interval = setInterval(() => {
            attempts++;

            let data = { price: 0, is_sold_out: false, room_type: 'Unknown' };
            try {
                if (HOST.includes("makemytrip")) {
                    data = scrapeMMT();
                } else if (HOST.includes("agoda")) {
                    data = scrapeAgoda();
                }
            } catch (err) {
                if (DEBUG) console.error("Scrape Error", err);
            }

            // Common Data Enriched
            data.check_in_date = getCheckinDateFromUrl();

            // VISUAL DEBUGGING
            if (DEBUG && banner) {
                banner.innerText = `[${HOST}] Date:${data.check_in_date} | Price:${data.price} | SoldOut:${data.is_sold_out} (${attempts}/${maxAttempts})`;
                console.log("[Extension] Scan:", data);
            }

            if (data.price > 0 || data.is_sold_out) {
                clearInterval(interval);
                if (DEBUG && banner) {
                    banner.style.backgroundColor = "green";
                    banner.innerText = `SUCCESS! Found: ${data.price} (${data.check_in_date})`;
                }
                setTimeout(() => {
                    chrome.runtime.sendMessage({ action: "SCRAPE_RESULT", data: [data] });
                }, 1000);
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                if (DEBUG && banner) {
                    banner.style.backgroundColor = "orange";
                    banner.innerText = `TIMEOUT (${data.check_in_date}) -> Defaulting to Sold Out`;
                }
                data.is_sold_out = true; // Force sold out on timeout
                setTimeout(() => {
                    chrome.runtime.sendMessage({ action: "SCRAPE_RESULT", data: [data] });
                }, 1000);
            }
        }, 1000);
    }, startDelay);

})();
