import { defineConfig, devices } from "@playwright/test";

// Next's development server only serves client chunks to its configured host.
// Keep this as localhost (rather than 127.0.0.1) so the app hydrates in tests.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Running every browser context at once can exhaust developer workstations.
  // Two workers keeps the cross-browser suite dependable while retaining feedback speed.
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Unit-style browser tests use deterministic route stubs instead of the
    // Compose API. Keep the local-domain test fixture explicit so localhost
    // itself never changes production/QA behaviour.
    env: { ...process.env, NEXT_PUBLIC_LOCAL_DEMO: "true" },
  },
});
