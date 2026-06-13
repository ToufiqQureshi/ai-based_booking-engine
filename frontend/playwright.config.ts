import { defineConfig, devices } from '@playwright/test';

// ════════════════════════════════════════════════════════════
//  Playwright Config — StayBooker
//  Supports: local dev server OR live site via env var
//
//  Live site:
//    $env:PLAYWRIGHT_BASE_URL="https://app.staybooker.ai"
//    npx playwright test
//
//  Local dev (default):
//    npx playwright test
// ════════════════════════════════════════════════════════════

const LIVE_URL = process.env.PLAYWRIGHT_BASE_URL;
const isLive   = !!LIVE_URL;

export default defineConfig({
  testDir: './tests/e2e',

  // Run tests in parallel locally; sequential on live to avoid rate limits
  fullyParallel: !isLive,
  forbidOnly:    !!process.env.CI,
  retries:       isLive ? 1 : (process.env.CI ? 2 : 0),
  workers:       isLive ? 2 : (process.env.CI ? 1 : undefined),

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    // Base URL — live site takes priority
    baseURL: LIVE_URL ?? (process.env.CI ? 'http://127.0.0.1:4173' : 'http://localhost:5173'),

    // Capture on failure
    trace:      'on-first-retry',
    screenshot: 'only-on-failure',
    video:      'on-first-retry',

    // Timeouts
    actionTimeout:     15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to add more browsers:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'safari',  use: { ...devices['Desktop Safari'] } },
    // { name: 'mobile',  use: { ...devices['Pixel 7'] } },
  ],

  // Only spin up dev server when NOT pointing at a live URL
  ...(isLive ? {} : {
    webServer: {
      command: process.env.CI ? 'npm run build && npm run preview' : 'npm run dev',
      url:     process.env.CI ? 'http://127.0.0.1:4173' : 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  }),
});
