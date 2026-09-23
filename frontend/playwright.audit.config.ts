import { defineConfig, devices } from "@playwright/test";

const web = process.env.AUDIT_WEB_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["audit/**/*.spec.ts", "ui/**/*.spec.ts"],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-audit-report", open: "never" }]],
  use: {
    baseURL: web,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium-audit", use: { ...devices["Desktop Chrome"] } }],
});
