import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

import { login, resetE2E } from "./helpers";

const viewports = [
  { name: "laptop-1440", width: 1440, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 800 },
];

test.beforeEach(async ({ request }) => resetE2E(request));

test("job builder recruitment settings remain clear and responsive", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "recruiter");
  await fs.mkdir("visual-artifacts/phase3-job-builder", { recursive: true });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/recruiter/jobs/new");
    await page.getByRole("button", { name: /Settings & publish/ }).click();

    await expect(page.getByRole("heading", { name: "Settings & publish" })).toBeVisible();
    await expect(page.getByLabel("Application deadline")).toBeVisible();
    await expect(page.getByLabel("Assigned recruiter")).toBeVisible();
    await expect(page.getByLabel("Job visibility")).toBeVisible();
    await expect(page.getByText("Enable referrals")).toBeVisible();
    await expect(page.getByText("Candidate-facing preview")).toBeVisible();

    await page.getByLabel("Job visibility").selectOption("private");
    await expect(page.getByText("Private roles are hidden from candidate search, recommendations and public job pages.")).toBeVisible();

    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: innerWidth,
      offenders: [...document.querySelectorAll("body *")]
        .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
        .slice(-12)
        .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 50)}:${Math.round(element.getBoundingClientRect().right)}`),
    }));
    expect(overflow.page, `${viewport.name} builder overflows by ${overflow.page - overflow.viewport}px: ${overflow.offenders.join(", ")}`).toBeLessThanOrEqual(viewport.width);

    await page.screenshot({
      path: `visual-artifacts/phase3-job-builder/new-${viewport.name}.png`,
      fullPage: true,
    });
  }
});

test("edit job shows governance controls and audit history without clutter", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "recruiter");
  await fs.mkdir("visual-artifacts/phase3-job-builder", { recursive: true });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/recruiter/jobs/60000000-0000-4000-8000-000000000001/edit");

    await expect(page.getByText("Job ID: SWX-JOB-2026-00001")).toBeVisible();
    await expect(page.getByRole("button", { name: "Duplicate job" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Job change history" })).toBeVisible();
    await expect(page.getByText("Created And Published")).toBeVisible();

    await page.getByRole("button", { name: /Settings & publish/ }).click();
    await expect(page.getByLabel("Assigned recruiter")).toHaveValue("20000000-0000-4000-8000-000000000001");
    await expect(page.getByLabel("Job visibility")).toHaveValue("public");
    await expect(page.getByText("Enable referrals")).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, `${viewport.name} edit builder horizontal overflow`).toBeLessThanOrEqual(0);

    await page.screenshot({
      path: `visual-artifacts/phase3-job-builder/edit-${viewport.name}.png`,
      fullPage: true,
    });
  }
});
