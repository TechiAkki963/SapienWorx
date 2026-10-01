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
  expect(report.width, `${label}: horizontal overflow offenders=${JSON.stringify(report.offenders)}`).toBeLessThanOrEqual(report.viewport + 1);
}

async function expectAnyVisibleText(page: import("@playwright/test").Page, text: string) {
  const visible = await page.getByText(text, { exact: true }).evaluateAll((elements) =>
    elements.some((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    }),
  );
  expect(visible, `Expected visible text: ${text}`).toBeTruthy();
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
  await fs.mkdir("visual-artifacts/phase5-candidate-360", { recursive: true });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    // 1. Job management
    await page.goto("/recruiter/jobs");
    await expect(page.getByRole("heading", { name: "Job management" })).toBeVisible();
    await expectAnyVisibleText(page, "SWX-JOB-2026-00001");
    await expect(page.getByRole("link", { name: "View applicants →" })).toBeVisible();
    await assertNoHorizontalOverflow(page, `${viewport.name} job management`);
    await prepareShot(page);
    await page.screenshot({ path: `visual-artifacts/phase3-full-workflow/01-jobs-${viewport.name}.png`, fullPage: true });

    // 1b. Active private job must not expose a public preview/share path
    await page.goto("/recruiter/jobs?q=Private%20Operations%20Lead");
    await expect(page.locator("p:visible, h2:visible").filter({ hasText: "Private Operations Lead" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Preview ↗" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Share" })).toHaveCount(0);
    await expect(page.locator("span:visible").filter({ hasText: "Private · not shareable" }).first()).toBeVisible();
    await assertNoHorizontalOverflow(page, `${viewport.name} private job management`);
    await prepareShot(page);
    await page.screenshot({ path: `visual-artifacts/phase3-full-workflow/01b-private-job-${viewport.name}.png`, fullPage: true });

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
    await expect(page.getByText("Candidate 360°", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Recruiter Notes/ })).toBeVisible();
    await expect(page.getByText("Preferred location:", { exact: true })).toBeVisible();
    await expect(page.getByText("private@example.test", { exact: true })).toBeVisible();
    await expect(page.getByText("Verified", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hidden phone number. Click once to show. Double click to copy" })).toContainText("••••••••••");
    await expect(page.getByText("8.4 · CGPA / 10", { exact: true })).toBeVisible();
    await expect(page.getByText("Jan 2024 – Present", { exact: false })).toBeVisible();
    await expect(page.getByText("Recent activity", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Candidate job match" })).toBeVisible();
    await expect(page.getByLabel("Job match score 86 percent")).toBeVisible();
    await expect(page.getByRole("region", { name: "Candidate job match" })).toContainText("Skills");
    await expect(page.getByRole("region", { name: "Candidate job match" })).toContainText("Experience");
    await expect(page.getByText("Stage changed to technical interview", { exact: true })).toBeVisible();
    await expect(page.getByText("Recruiter note added", { exact: true })).toBeVisible();
    await page.screenshot({ path: `visual-artifacts/phase5-candidate-360/candidate-360-${viewport.name}.png`, fullPage: true });

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
    await expect(page.getByRole("heading", { name: "Senior Go Platform Engineer" })).toBeVisible();
    await assertNoHorizontalOverflow(page, `${viewport.name} preview`);
    await prepareShot(page);
    await page.screenshot({ path: `visual-artifacts/phase3-full-workflow/06-preview-${viewport.name}.png`, fullPage: true });
  }
});
