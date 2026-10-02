import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

import { login, resetE2E } from "./helpers";

async function noOverflow(page: import("@playwright/test").Page, label: string) {
  const { width, viewport } = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(width, label).toBeLessThanOrEqual(viewport + 1);
}

test.beforeEach(async ({ request }) => {
  await resetE2E(request);
});

test("Bulk InMail remains clean and usable across approved responsive widths", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "recruiter");
  await page.goto("/recruiter/talent-pool");

  await page.getByLabel("Select Aarav Mehta").check();
  await page.getByLabel("Select Meera Nair").check();
  await page.getByRole("button", { name: "Send Bulk InMail" }).click();

  const dialog = page.getByRole("dialog", { name: "Send Bulk InMail" });
  await expect(dialog).toBeVisible();
  await page.getByLabel("Message template").selectOption("72000000-0000-4000-8000-000000000001");
  await page.getByLabel("Job context").selectOption("60000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("button", { name: "Send to 2" })).toBeEnabled();
  await expect(dialog.getByText(/Company-wide 14-day cooldown and hourly\/daily outreach safeguards/i)).toBeVisible();

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
    await noOverflow(page, `Bulk InMail ${width}px`);
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel("Message template")).toBeVisible();
    await expect(page.getByLabel("Job context")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send to 2" })).toBeVisible();
    await page.screenshot({ path: `../output/p2-bulk-inmail-${width}.png`, fullPage: true });
  }
});

test("Bulk InMail follows recruiter dark mode", async ({ page }) => {
  await fs.mkdir("../output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "recruiter");
  await page.goto("/recruiter/talent-pool");

  await page.getByTitle("Appearance").click();
  await page.getByTitle("Dark mode").click();
  await expect(page.locator("html")).toHaveClass(/swx-dark/);

  await page.getByLabel("Select Aarav Mehta").check();
  await page.getByRole("button", { name: "Send Bulk InMail" }).click();
  const dialog = page.getByRole("dialog", { name: "Send Bulk InMail" });
  await expect(dialog).toBeVisible();
  await noOverflow(page, "Bulk InMail dark mode");
  await page.screenshot({ path: "../output/p2-bulk-inmail-dark-1440.png", fullPage: true });
});
