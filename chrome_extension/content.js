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

    // Security: Only allow trusted origins to trigger scraping. Previously this
    // check was disabled "for debugging" — leaving the page-wide `INITIATE_SCRAPE`
    // event unfiltered, so ANY webpage the user visits could exfiltrate auth
    // tokens and trigger competitor-rate scrapes against arbitrary URLs.
    if (!ALLOWED_ORIGINS.includes(window.location.origin)) {
        console.warn(`[Content] Blocked INITIATE_SCRAPE from untrusted origin ${window.location.origin}`);
        window.dispatchEvent(new CustomEvent("SCRAPE_ERROR", {
            detail: { error: "UNTRUSTED_ORIGIN", origin: window.location.origin }
        }));
        return;
    }

    if (!event.detail || !event.detail.token) {
        console.warn("[Content] Missing authentication token. Aborting.");
        window.dispatchEvent(new CustomEvent("SCRAPE_ERROR", {
            detail: { error: "MISSING_TOKEN" }
        }));
        return;
    }

    // Sanity-check the jobs payload before forwarding it to the background worker.
    // Without this, a malicious page could pass arbitrary URLs (including internal
    // network targets like http://localhost:8080) and have the extension scrape them.
    const jobs = Array.isArray(event.detail.jobs) ? event.detail.jobs : [];
    const safeJobs = jobs.filter((j) => {
        if (!j || typeof j.url !== "string") return false;
        try {
            const u = new URL(j.url.startsWith("http") ? j.url : `https://${j.url}`);
            return u.protocol === "https:" || u.protocol === "http:";
        } catch {
            return false;
        }
    });
    if (safeJobs.length === 0) {
        window.dispatchEvent(new CustomEvent("SCRAPE_ERROR", {
            detail: { error: "NO_VALID_JOBS" }
        }));
        return;
    }
    if (safeJobs.length !== jobs.length) {
        console.warn(`[Content] Dropped ${jobs.length - safeJobs.length} invalid job(s) before forwarding`);
    }

    console.log("[Content] Dispatching to background jobs:", safeJobs.length);

    chrome.runtime.sendMessage({
        action: "START_SCRAPE",
        data: safeJobs,
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
