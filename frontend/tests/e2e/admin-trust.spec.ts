import { expect, test } from "@playwright/test";

import { login, MOCK_API, resetE2E } from "./helpers";

test.describe("Master Admin Trust review", () => {
  test.beforeEach(async ({ request }) => {
    await resetE2E(request);
    await request.post(MOCK_API + "/__e2e/admin-security", {
      data: { enabled: true, admin_role: "super_admin", assigned: true, mfa_enrolled: true, mfa_verified: true },
    });
  });

  test("keeps risk signals inside the Master Admin human-review workspace across viewports", async ({ page }) => {
    await login(page, "master_admin");
    await page.goto("/swx-command-centre/trust");
    await expect(page.getByRole("heading", { name: "Human review of risk signals" })).toBeVisible();
    await expect(page.getByText(/do not automatically label a candidate or job as fraudulent/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Escalate for investigation" }).first()).toBeVisible();
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 960 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `../output/admin-trust-${width}.png`, fullPage: true });
    }
  });

  test("auditor can inspect signals but cannot disposition them", async ({ page, request }) => {
    await request.post(MOCK_API + "/__e2e/admin-security", {
      data: { enabled: true, admin_role: "auditor", assigned: true, mfa_enrolled: true, mfa_verified: true },
    });
    await login(page, "master_admin");
    await page.goto("/swx-command-centre/trust");
    await expect(page.getByRole("heading", { name: "Human review of risk signals" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Escalate for investigation" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Dismiss signal" })).toHaveCount(0);
  });
});
