import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

import { login, resetE2E } from "./helpers";

const jobID = "60000000-0000-4000-8000-000000000001";

const viewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 800 },
];

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page, label: string) {
  const report = await page.evaluate(() => {
    const viewport = innerWidth;
    const width = document.documentElement.scrollWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.right > viewport + 1 || rect.left < -1)
      .slice(0, 12)
      .map(({ element, rect }) => ({
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role"),
        aria: element.getAttribute("aria-label"),
        className: String(element.className).slice(0, 80),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      }));
    return { viewport, width, offenders };
  });
  expect(report.width, `${label}: horizontal overflow offenders=${JSON.stringify(report.offenders)}`).toBeLessThanOrEqual(report.viewport);
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

test("Phase 3.7 full recruiter workflow is visually coherent across target widths", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page, "recruiter");
  await fs.mkdir("visual-artifacts/phase3-full-workflow", { recursive: true });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    // 1. Job management
    await page.goto("/recruiter/jobs");
    await expect(page.getByRole("heading", { name: "Job management" })).toBeVisible();
    await expect(page.getByText("SWX-JOB-2026-00001")).toBeVisible();
    await expect(page.getByRole("link", { name: "View applicants →" })).toBeVisible();
    await assertNoHorizontalOverflow(page, `${viewport.name} job management`);
    await prepareShot(page);
    await page.screenshot({ path: `visual-artifacts/phase3-full-workflow/01-jobs-${viewport.name}.png`, fullPage: true });

    // 2. Per-job applicants
    await page.goto(`/recruiter/jobs/${jobID}/applicants`);
    await expect(page.getByRole("heading", { name: "Senior Go Platform Engineer" })).toBeVisible();
    await expect(page.getByText("Job ID: SWX-JOB-2026-00001")).toBeVisible();
    await expect(page.getByRole("link", { name: "View Profile" }).first()).toBeVisible();
    await assertNoHorizontalOverflow(page, `${viewport.name} applicants`);
    await prepareShot(page);
    await page.screenshot({ path: `visual-artifacts/phase3-full-workflow/02-applicants-${viewport.name}.png`, fullPage: true });

    // 3. Candidate profile from the application workflow
    await page.getByRole("link", { name: "View Profile" }).first().click();
    await expect(page).toHaveURL(/\/recruiter\/candidates\//);
    await expect(page.getByText("Candidate 001", { exact: true }).first()).toBeVisible();
    await assertNoHorizontalOverflow(page, `${viewport.name} candidate profile`);
    await prepareShot(page);
    await page.screenshot({ path: `visual-artifacts/phase3-full-workflow/03-candidate-${viewport.name}.png`, fullPage: true });

    // 4. Deterministic job analytics
    await page.goto(`/recruiter/jobs/${jobID}/analytics`);
    await expect(page.getByRole("heading", { name: "Job analytics" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Hiring funnel" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Source performance" })).toBeVisible();
    await assertNoHorizontalOverflow(page, `${viewport.name} analytics`);
    await prepareShot(page);
    await page.screenshot({ path: `visual-artifacts/phase3-full-workflow/04-analytics-${viewport.name}.png`, fullPage: true });

    // 5. Edit/governance workspace
    await page.goto(`/recruiter/jobs/${jobID}/edit`);
    await expect(page.getByText("Job ID: SWX-JOB-2026-00001")).toBeVisible();
    await expect(page.getByRole("button", { name: "Duplicate job" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Job change history" })).toBeVisible();
    await assertNoHorizontalOverflow(page, `${viewport.name} edit`);
    await prepareShot(page);
    await page.screenshot({ path: `visual-artifacts/phase3-full-workflow/05-edit-${viewport.name}.png`, fullPage: true });

    // 6. Public candidate-facing preview under recruiter session
    await page.goto(`/jobs/${jobID}`);
    await expect(page.getByText("Recruiter preview")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Senior Go Platform Engineer" })).toBeVisible();
    await assertNoHorizontalOverflow(page, `${viewport.name} preview`);
    await prepareShot(page);
    await page.screenshot({ path: `visual-artifacts/phase3-full-workflow/06-preview-${viewport.name}.png`, fullPage: true });
  }
});
