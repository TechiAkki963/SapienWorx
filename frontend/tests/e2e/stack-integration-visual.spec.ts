import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

import { login, resetE2E } from "./helpers";

const viewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 800 },
];

async function noOverflow(page: import("@playwright/test").Page, label: string) {
  const report = await page.evaluate(() => ({
    viewport: innerWidth,
    width: document.documentElement.scrollWidth,
  }));
  expect(report.width, `${label}: document overflow`).toBeLessThanOrEqual(report.viewport + 1);
}

async function prepareShot(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
  });
  await page.addStyleTag({ content: ".skip-link { display: none !important; }" });
}

test.beforeEach(async ({ request }) => resetE2E(request));

test("stack integration: candidate discovery remains coherent across supported widths", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, "candidate");
  await fs.mkdir("visual-artifacts/stack-integration", { recursive: true });

  await page.goto("/candidate/jobs?q=ICU%20Nursing&role_category=Healthcare&employment_type=full_time&posted_within=14&sort=relevance");
  await expect(page.getByRole("heading", { name: "All active roles" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Critical Care Nurse" })).toBeVisible();
  await expect(page.getByText(/Interpreted “ICU Nursing” as Critical Care Nursing/)).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect(page.getByRole("heading", { name: "All active roles" })).toBeVisible();
    await noOverflow(page, `${viewport.name} candidate discovery`);
    await prepareShot(page);
    await page.screenshot({ path: `visual-artifacts/stack-integration/01-candidate-discovery-${viewport.name}.png`, fullPage: true });
  }
});

test("stack integration: governed workforce taxonomy remains coherent across supported widths", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, "master_admin");
  await fs.mkdir("visual-artifacts/stack-integration", { recursive: true });

  await page.goto("/swx-command-centre/workforce-taxonomy");
  await expect(page.getByRole("heading", { name: "Workforce Taxonomy" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Taxonomy summary" })).toBeVisible();
  await expect(page.getByText("Sterile Processing", { exact: true })).toBeVisible();
  await expect(page.getByText("Critical Care Nursing", { exact: true })).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect(page.getByRole("heading", { name: "Workforce Taxonomy" })).toBeVisible();
    await noOverflow(page, `${viewport.name} workforce taxonomy`);
    await prepareShot(page);
    await page.screenshot({ path: `visual-artifacts/stack-integration/02-workforce-taxonomy-${viewport.name}.png`, fullPage: true });
  }
});
