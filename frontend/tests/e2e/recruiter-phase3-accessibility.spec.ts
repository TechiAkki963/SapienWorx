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

  const confirmation = page.getByRole("alertdialog", { name: "Confirm bulk job action" });
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
  const builderError = page.locator("#job-builder-error");
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


test("Candidate 360 header actions support keyboard entry, Escape and focus return", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "recruiter");
  await page.goto(`/recruiter/candidates/71000000-0000-4000-8000-000000000001?job_id=${jobID}`);

  const inmail = page.getByRole("button", { name: "Send InMail" });
  await expect(inmail).toBeEnabled();
  await inmail.focus();
  await inmail.press("Enter");
  await expect(page.getByRole("complementary", { name: "InMail composer" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary", { name: "InMail composer" })).toHaveCount(0);
  await expect(inmail).toBeFocused();

  const interview = page.getByRole("button", { name: "Schedule interview" });
  await interview.focus();
  await interview.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Schedule interview" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Candidate and job" })).toBeFocused();
  await dialog.getByRole("button", { name: "Close interview dialog" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Schedule interview", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close interview dialog" })).toBeFocused();
  await page.screenshot({ path: "test-results/interview-focus-light.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(interview).toBeFocused();
});

test("interview modal traps both keyboard boundaries in Dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "recruiter");
  await page.getByTitle("Appearance").click();
  await page.getByTitle("Dark mode").click();
  await page.goto(`/recruiter/candidates/71000000-0000-4000-8000-000000000001?job_id=${jobID}`);
  const trigger = page.getByRole("button", { name: "Schedule interview", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Schedule interview" });
  const close = dialog.getByRole("button", { name: "Close interview dialog" });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Schedule interview", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.screenshot({ path: "test-results/interview-focus-dark.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
