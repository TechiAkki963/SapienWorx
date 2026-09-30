import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

import { login, resetE2E } from "./helpers";

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page, label: string) {
  const report = await page.evaluate(() => ({
    viewport: innerWidth,
    width: document.documentElement.scrollWidth,
  }));
  expect(report.width, label).toBeLessThanOrEqual(report.viewport + 1);
}

async function captureModes(
  page: import("@playwright/test").Page,
  role: "candidate" | "recruiter" | "master_admin",
  destination: string,
) {
  await fs.mkdir("visual-artifacts/theme-modes", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, role);
  await page.goto(destination);

  await page.getByTitle("Light mode").click();
  await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
  await assertNoHorizontalOverflow(page, role + " light mode");
  await page.screenshot({ path: `visual-artifacts/theme-modes/${role}-light.png`, fullPage: true });

  await page.getByTitle("Dark mode").click();
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await assertNoHorizontalOverflow(page, role + " dark mode");
  await page.screenshot({ path: `visual-artifacts/theme-modes/${role}-dark.png`, fullPage: true });

  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByTitle("System mode").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await assertNoHorizontalOverflow(page, role + " system mode");
  await page.screenshot({ path: `visual-artifacts/theme-modes/${role}-system.png`, fullPage: true });
}

test.beforeEach(async ({ request, page }) => {
  await resetE2E(request);
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("swx-theme"));
});

test("Candidate workspace supports system, light and dark modes", async ({ page }) => {
  await captureModes(page, "candidate", "/candidate");
});

test("Recruiter workspace supports system, light and dark modes", async ({ page }) => {
  await captureModes(page, "recruiter", "/recruiter");
});

test("Master Admin workspace supports system, light and dark modes", async ({ page }) => {
  await captureModes(page, "master_admin", "/swx-command-centre/overview");
});
