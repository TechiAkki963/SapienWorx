import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";

import { login, resetE2E } from "./helpers";

async function openSystem(page: Page) {
  await login(page, "master_admin");
  await page.goto("/swx-command-centre/system");
  await expect(page.getByRole("heading", { name: "Platform health & budget" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Amazon SES delivery health" })).toBeVisible();
}

test.describe("P2.4 SES health visual validation", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("system email health is truthful, responsive and overflow-free", async ({ page }) => {
    await openSystem(page);
    await expect(page.getByText("Dispatcher disabled", { exact: true })).toBeVisible();
    const productionAccess = page.getByText("Production access", { exact: true }).locator("..");
    await expect(productionAccess).toContainText("Separate AWS gate");
    await expect(page.getByText("1 bounce · 1 complaint", { exact: true })).toBeVisible();

    await fs.mkdir("output", { recursive: true });
    for (const width of [1440, 1024, 768, 428, 390, 360, 320]) {
      await page.setViewportSize({ width, height: 960 });
      await expect(page.getByRole("heading", { name: "Amazon SES delivery health" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `output/p2.4-ses-system-${width}.png`, fullPage: true });
    }

    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.screenshot({ path: "output/p2.4-ses-system-dark-1440.png", fullPage: true });
  });
});
