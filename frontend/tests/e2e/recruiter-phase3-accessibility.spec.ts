import { expect, test } from "@playwright/test";

import { login, resetE2E } from "./helpers";

const jobID = "60000000-0000-4000-8000-000000000001";

test.beforeEach(async ({ request }) => resetE2E(request));

test("Phase 3.8 keyboard and assistive-technology acceptance", async ({ page }) => {
  await login(page, "recruiter");

  await page.goto("/recruiter/jobs");
  await expect(page.getByRole("heading", { name: "Job management" })).toBeVisible();

  const firstJobCheckbox = page.locator('input[data-bulk-job-id]').first();
  await firstJobCheckbox.check();
  await expect(page.getByText("1 selected on this page")).toBeVisible();

  await page.getByRole("combobox", { name: "Bulk action" }).selectOption("pause");
  const reviewButton = page.getByRole("button", { name: "Review action" });
  await reviewButton.focus();
  await reviewButton.press("Enter");

  const confirmation = page.getByRole("alertdialog", { name: /Pause 1 selected job/ });
  await expect(confirmation).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(reviewButton).toBeFocused();

  const shareButton = page.getByRole("button", { name: "Share" }).first();
  await shareButton.focus();
  await shareButton.press("Enter");
  await expect(shareButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Share / copy link" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(shareButton).toHaveAttribute("aria-expanded", "false");
  await expect(shareButton).toBeFocused();

  await page.goto("/recruiter/jobs/new");
  await expect(page.getByRole("heading", { name: "Post a job" })).toBeVisible();
  await page.getByLabel("Job title").fill("");
  await page.getByRole("button", { name: "Save as draft" }).click();
  const builderError = page.getByRole("alert");
  await expect(builderError).toContainText("Add a job title");
  await expect(builderError).toBeFocused();
  await expect(page.getByLabel("Job title")).toHaveAttribute("aria-invalid", "true");

  await page.goto(`/recruiter/jobs/${jobID}/analytics`);
  await expect(page.getByRole("heading", { name: "Job analytics" })).toBeVisible();
  await expect(page.getByRole("img", { name: /30 day application volume/ })).toBeVisible();
  await expect(page.getByRole("table", { name: "Daily application volume for the last 30 days" })).toBeAttached();
});

test("Phase 3.8 focus states remain visually clear at desktop and mobile widths", async ({ page }) => {
  await login(page, "recruiter");

  for (const viewport of [
    { name: "desktop-1440", width: 1440, height: 900 },
    { name: "mobile-390", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/recruiter/jobs");
    const postJob = page.getByRole("link", { name: "+ Post a job" });
    await postJob.focus();
    await expect(postJob).toBeFocused();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, `${viewport.name} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});
