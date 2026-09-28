import { defineConfig, devices } from "@playwright/test";

// Isolated ports; do not reuse or stop the existing local application stacks.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /admin-(access-preview|security|dashboard|governance|recruitment)\.spec\.ts/,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3010", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "node tests/e2e/mock-api.mjs", url: "http://127.0.0.1:18090/healthz", env: { E2E_MOCK_API_PORT: "18090", E2E_WEB_ORIGIN: "http://127.0.0.1:3010", ADMIN_SECURITY_E2E: "1" }, reuseExistingServer: false },
    { command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3010", url: "http://127.0.0.1:3010", env: { INTERNAL_API_URL: "http://127.0.0.1:18090", NEXT_PUBLIC_API_URL: "http://127.0.0.1:18090" }, reuseExistingServer: false, timeout: 90_000 },
  ],
});
