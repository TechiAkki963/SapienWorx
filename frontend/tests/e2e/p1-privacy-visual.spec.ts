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

test("privacy operations remain readable across desktop, tablet and mobile", async ({ page }) => {
  await fs.mkdir("output", { recursive: true });
  await login(page, "master_admin");
  await page.goto("/swx-command-centre/privacy");

  await expect(page.getByRole("heading", { name: "DPDP / GDPR operations centre" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rights and erasure requests" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Subprocessor transfer governance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Incident register" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ROPA" })).toBeVisible();

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await noOverflow(page, `privacy operations ${width}px`);
    await page.screenshot({ path: `output/admin-privacy-${width}.png`, fullPage: true });
  }
});

test("privacy operations support dark mode without losing governance data", async ({ page }) => {
  await fs.mkdir("output", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await login(page, "master_admin");
  await page.goto("/swx-command-centre/privacy");

  await page.getByTitle("Appearance").click();
  await page.getByTitle("Dark mode").click();
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await expect(page.getByText("Synthetic incident readiness exercise")).toBeVisible();
  await expect(page.getByText("Recruitment profile operations")).toBeVisible();
  await expect(page.getByText("Synthetic Cloud Processor")).toBeVisible();
  await noOverflow(page, "privacy operations dark");
  await page.screenshot({ path: "output/admin-privacy-dark.png", fullPage: true });
});

test("public cookie information states the essential-only policy without a fake consent choice", async ({ page }) => {
  await fs.mkdir("output", { recursive: true });
  await page.goto("/cookies");
  await expect(page.getByRole("heading", { name: "Only essential cookies are used in the current product." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why there is no consent banner" })).toBeVisible();
  await expect(page.getByText(/No advertising, behavioral profiling, or non-essential analytics cookies/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /accept/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /reject/i })).toHaveCount(0);

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await noOverflow(page, `cookie information ${width}px`);
    await page.screenshot({ path: `output/cookie-information-${width}.png`, fullPage: true });
  }
});
