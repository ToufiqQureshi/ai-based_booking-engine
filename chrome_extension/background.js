// Background Service Worker - Production Refactor v2.1
// Handles Rates Scraping, Review Sync, and Auto-Replies

console.log("[ServiceWorker] Loaded v2.2 (Rates Only)");

// Configuration
const CONFIG = {
    SCRAPE_TIMEOUT_MS: 45000,
    TAB_DELAY_MS: 3000,

    // API Configuration
    API_BASE: "https://api.gadget4me.in/api/v1",

    ENDPOINTS: {
        RATES_INGEST: "/competitors/rates/ingest"
    }
};

// Global State
const state = {
    queue: [],
    isProcessing: false,
    authToken: null
};

// Initialize Alarms
chrome.runtime.onInstalled.addListener(() => {
    // Only Rate Alarms if needed, or none
    console.log("[Alarms] Installed");
});

// Load Token from Storage on Startup
chrome.storage.local.get(['auth_token'], (result) => {
    if (result.auth_token) {
        state.authToken = result.auth_token;
        console.log("[Auth] Token restored from storage");
    }
});

// =============================================================================
// Message Handling & Alarms
// =============================================================================
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log(`[Alarm] Triggered: ${alarm.name}`);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(`[Message] Action: ${request.action} from ${sender.origin || 'Unknown'}`);

    // 1. Handle New Job Request (Rates)
    if (request.action === "START_SCRAPE") {
        const jobs = request.data || [];
        console.log(`[Queue] Received ${jobs.length} jobs`);

        if (request.token) {
            state.authToken = request.token;
            chrome.storage.local.set({ auth_token: request.token });
        }

        // Normalize jobs
        const normalizedJobs = jobs.map(d => ({ ...d, type: 'RATE_SCRAPE' }));
        state.queue.push(...normalizedJobs);
        processQueue();

        sendResponse({ status: "QUEUED", count: state.queue.length });
    } else {
        // Essential to prevent message port closure issues
        sendResponse({ status: "IGNORED" });
    }
    return true;
});

// =============================================================================
// Queue Manager
// =============================================================================
async function processQueue() {
    if (state.isProcessing) return;
    state.isProcessing = true;

    console.log("[Queue] Processing Started");

    let isFirst = true;
    while (state.queue.length > 0) {
        const job = state.queue.shift();
        console.log(`[Job] Starting: ${job.type} - ${job.url || 'No URL'}`);

        try {
            if (job.type === 'RATE_SCRAPE') {
                const result = await executeRateScrapeJob(job, isFirst);
                isFirst = false; // Only first one is active
                if (result && !result.error) await sendToBackend(result, CONFIG.ENDPOINTS.RATES_INGEST);
            }
        } catch (error) {
            console.error(`[Job] Critical Failure`, error);
        }

        // Anti-Detection: Randomize delay between jobs
        const jitter = Math.floor(Math.random() * 3000); // 0-3s random add
        const delay = CONFIG.TAB_DELAY_MS + jitter;
        console.log(`[Queue] Waiting ${delay}ms before next job...`);
        await wait(delay);
    }

    state.isProcessing = false;
    console.log("[Queue] All jobs completed");
}

// =============================================================================
// Job Executors
// =============================================================================

// 1. Rate Scrape (Legacy)
function executeRateScrapeJob(comp, isFirst = false) {
    return new Promise((resolve) => {
        let tabId = null;
        let isResolved = false;

        console.log(`[Job] Starting Execution for ${comp.id}. URL: ${comp.url}`);

        const cleanup = () => {
            chrome.runtime.onMessage.removeListener(onMsg);
            if (tabId) {
                chrome.tabs.remove(tabId).catch(() => { });
                tabId = null;
            }
        };

        const finish = (result) => {
            if (isFinished) return;
            isFinished = true;
            cleanup();
            resolve(result);
            
            // Notify all tabs that this specific job is done
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { 
                        action: "SCRAPE_COMPLETE", 
                        data: { competitor_id: comp.id, status: result.error ? "FAILED" : "SUCCESS" }
                    }).catch(() => {}); // Ignore errors for inactive tabs
                });
            });
        };

        const onMsg = (msg, sender) => {
            if (sender.tab && sender.tab.id === tabId && msg.action === "SCRAPE_RESULT") {
                console.log(`[Job] Received results for ${comp.id}`);
                finish((msg.data || []).map(r => ({ ...r, competitor_id: comp.id })));
            }
        };

        // Timeout fallback (extended to 60s)
        const timeout = setTimeout(() => {
            console.warn(`[Job] Timeout for ${comp.id}`);
            showNotification(`Timeout: ${comp.name}`, "Taking too long to load.");
            finish({ error: "TIMEOUT" });
        }, 60000);

        chrome.runtime.onMessage.addListener(onMsg);

        if (!comp.url) {
            console.error("[Job] Missing URL for competitor", comp);
            finish({ error: "MISSING_URL" });
            return;
        }

        let targetUrl = comp.url;
        if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

        showNotification("Syncing Rates", `Opening ${comp.name}...`);

        // Try to create the tab
        try {
            // SILENT MODE: Open in background (active: false)
            chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
                if (chrome.runtime.lastError || !tab) {
                    console.error("[Job] Tab creation failed:", chrome.runtime.lastError);
                    showNotification("Error", "Failed to open browser tab.");
                    finish({ error: "TAB_CREATION_FAILED" });
                    return;
                }
                
                tabId = tab.id;
                console.log(`[Job] Tab created: ${tabId}.`);

                // Wait for tab to finish loading OR just wait 5 seconds as fallback
                let injected = false;
                const doInject = (tid) => {
                    if (injected) return;
                    injected = true;
                    console.log(`[Job] Injecting script into tab ${tid}...`);
                    
                    chrome.scripting.executeScript({
                        target: { tabId: tid },
                        files: ["scraper.js"]
                    }).catch((err) => {
                        console.error(`[Job] Injection failed:`, err);
                        finish({ error: "INJECTION_FAILED" });
                    });
                };

                const listener = (tid, info) => {
                    if (tid === tabId && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        setTimeout(() => doInject(tid), 2000);
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);

                // Safety fallback: If listener doesn't fire in 10s, try injecting anyway
                setTimeout(() => {
                    if (!injected && tabId) {
                        chrome.tabs.onUpdated.removeListener(listener);
                        doInject(tabId);
                    }
                }, 10000);
            });
        } catch (e) {
            console.error("[Job] Fatal error:", e);
            finish({ error: "FATAL_ERROR" });
        }
    });
}

function showNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png', // Fallback to a default icon if not exists
        title: `Staybooker: ${title}`,
        message: message,
        priority: 2
    }, (id) => {
        if (chrome.runtime.lastError) console.warn("Notification error:", chrome.runtime.lastError);
    });
}

// 2. Review Scrape & Reply Executors REMOVED

// =============================================================================
// Helpers
// =============================================================================
async function sendToBackend(data, endpoint) {
    try {
        const url = CONFIG.API_BASE + endpoint;
        const headers = { 
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
        
        if (state.authToken) {
            headers["Authorization"] = `Bearer ${state.authToken}`;
        }

        const body = Array.isArray(data) ? data : [data];
        const finalBody = endpoint === CONFIG.ENDPOINTS.RATES_INGEST ? { rates: body } : body;

        console.log(`[API] Sending to ${endpoint}...`);

        const response = await fetch(url, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(finalBody)
        });

        const resData = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.warn(`[API] ${endpoint} failed: ${response.status}`);
            showNotification("Save Failed", `Server returned ${response.status}: ${resData.detail || 'Unknown Error'}`);
        } else {
            console.log(`[API] ${endpoint} Success`);
            showNotification("Rates Saved", resData.message || "Competitor prices updated in Supabase.");
        }
    } catch (e) {
        console.error(`[API] ${endpoint} Critical Error`, e);
        showNotification("Connection Error", "Could not reach the Staybooker server.");
    }
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
