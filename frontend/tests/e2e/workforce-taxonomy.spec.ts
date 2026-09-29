import { expect, test } from "@playwright/test";

import { login, resetE2E } from "./helpers";

test.describe("workforce taxonomy Phase 1", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("recruiter can select a cross-domain canonical competency and keep a legitimate provisional term", async ({ page }) => {
    await page.route(/\/api\/v1\/workforce\/taxonomy\/suggest/, async (route) => {
      const url = new URL(route.request().url());
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const items = q.includes("icu")
        ? [{
            id: "11111111-1111-4111-8111-111111111111",
            entity_type: "competency",
            canonical_name: "Critical Care Nursing",
            matched_value: "ICU Nursing",
            match_kind: "alias",
            confidence: 1,
          }]
        : [];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items }) });
    });

    await login(page, "recruiter");
    await page.goto("/recruiter/jobs/new");
    await page.getByLabel("Job title").fill("Critical Care Nurse");
    await page.getByRole("button", { name: "Continue →" }).click();

    const taxonomy = page.getByRole("combobox", { name: "Search workforce taxonomy" });
    await taxonomy.fill("ICU");
    await expect(page.getByRole("option", { name: /Critical Care Nursing/ })).toBeVisible();
    await page.getByRole("option", { name: /Critical Care Nursing/ }).click();
    await expect(page.getByText("Critical Care Nursing", { exact: true })).toBeVisible();

    await taxonomy.fill("Sterile Processing");
    await taxonomy.press("Enter");
    await expect(page.getByText("Sterile Processing", { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
});
