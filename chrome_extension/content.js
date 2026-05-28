// Content.js - Rate Scraping Trigger Only
// Robust Production Version v2.2

console.log("[HotelierHub] Content Script Loaded (Rates Only Mode)");

const ALLOWED_ORIGINS = [
    "http://localhost:8080",
    "http://localhost:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:5173",
    "https://app.gadget4me.in"
];

// 1. From React App (Dashboard Sync Button)
window.addEventListener("EXTENSION_PING", () => {
    console.log("[Content] PING received. Extension is alive.");
    window.dispatchEvent(new CustomEvent("PING_PONG", { detail: { status: "ALIVE" } }));
});

window.addEventListener("INITIATE_SCRAPE", (event) => {
    console.log("[Content] INITIATE_SCRAPE received from origin:", window.location.origin);

    // Security: Only allow trusted origins to trigger scraping (RELAXED FOR DEBUGGING)
    if (!ALLOWED_ORIGINS.includes(window.location.origin)) {
        console.warn(`[Content] DEBUG: Allowing origin ${window.location.origin} even though not in list.`);
    }

    if (!event.detail || !event.detail.token) {
        console.warn("[Content] Missing authentication token. Aborting.");
        return;
    }

    console.log("[Content] Dispatching to background jobs:", event.detail.jobs?.length || 0);

    chrome.runtime.sendMessage({
        action: "START_SCRAPE",
        data: event.detail.jobs,
        token: event.detail.token
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("[Content] Messaging Error (Extension might be reloaded):", chrome.runtime.lastError.message);
            window.dispatchEvent(new CustomEvent("SCRAPE_ERROR", { detail: { error: "EXTENSION_DISCONNECTED" } }));
        } else {
            console.log("[Content] Background ACK:", response);
            window.dispatchEvent(new CustomEvent("SCRAPE_ACK", { detail: response }));
        }
    });
});

// 2. From Background Script (Results or Updates)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SCRAPE_COMPLETE") {
        console.log("[Content] Scrape complete notification. Relaying to page.");
        window.dispatchEvent(new CustomEvent("SCRAPE_COMPLETE", { detail: request.data }));
    }
    if (request.action === "SCRAPE_PROGRESS") {
         window.dispatchEvent(new CustomEvent("SCRAPE_PROGRESS", { detail: request.data }));
    }
    return true;
});
