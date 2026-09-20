import { defineConfig, devices } from "@playwright/test";

const mockAPI = "http://127.0.0.1:18080";
const web = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // The journey suite intentionally shares one stateful mock API. Running it
  // serially prevents one test from clearing another test's request ledger.
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: web,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node tests/e2e/mock-api.mjs",
      url: `${mockAPI}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 20_000,
    },
    {
      command: "node tests/e2e/start-web.mjs",
      url: web,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
