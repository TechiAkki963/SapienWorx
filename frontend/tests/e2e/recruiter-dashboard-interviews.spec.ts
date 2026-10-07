import { expect, test } from "@playwright/test";

import { login, resetE2E } from "./helpers";

test.beforeEach(async ({ request }) => resetE2E(request));

test("dashboard KPIs lead to exact queues and recent applications use a compact table", async ({ page }) => {
  await login(page, "recruiter");
  await page.goto("/recruiter");
  await expect(page.getByRole("link", { name: "View new applications: 9" })).toHaveAttribute("href", "/recruiter/pipeline?stage=new_application");
  await expect(page.getByRole("link", { name: "View active jobs: 12" })).toHaveAttribute("href", "/recruiter/jobs?status=active");
  await expect(page.getByRole("link", { name: "View upcoming interviews: 14" })).toHaveAttribute("href", "/recruiter/interviews?status=upcoming");
  await expect(page.getByRole("table",{name:"Recent applications",exact:true}).locator("tbody tr")).toHaveCount(6);
  await page.getByRole("link", { name: "View active jobs: 12" }).click();
  await expect(page).toHaveURL(/status=active/);
  await expect(page.getByText("Showing active jobs.")).toBeVisible();
});

test("interview list, selected history and day/week calendar remain usable on small screens", async ({ page }) => {
  await login(page, "recruiter");
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/recruiter/interviews");
    await expect(page.getByRole("heading", { name: "Interviews", exact: true })).toBeVisible();
    await expect(page.getByRole("link",{name:"Candidate 001",exact:true}).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.getByRole("link", { name: "Calendar view" }).click();
    await expect(page.getByRole("region", { name: "Interview calendar" })).toBeVisible();
    await page.getByRole("link", { name: "Day", exact: true }).click();
    await expect(page.getByRole("link", { name: "Week", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
  await page.goto("/recruiter/interviews?interview_id=80000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("region", { name: "Interview history" })).toContainText("No changes have been recorded");
});

for (const [zone, expectedUTC] of [["Asia/Kolkata", "2026-11-12T05:00:00.000Z"], ["America/New_York", "2026-11-12T15:30:00.000Z"]]) {
  test.describe(`Interview rescheduling in ${zone}`, () => {
    test.use({ timezoneId: zone });
    test("hydrates independently of the server timezone and submits the browser wall time", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error" && /hydration|hydrated|server rendered|React error #418/i.test(message.text())) errors.push(message.text()); });
      await login(page, "recruiter");
      await page.goto("/recruiter/interviews");
      await expect(page.getByRole("heading", { name: "Interviews", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Reschedule", exact: true }).first().click();
      const drawer = page.getByRole("dialog", { name: "Reschedule Candidate 001", exact: true });
      const input = drawer.getByLabel(/^Date and time/);
      await expect(input).toBeVisible();
      const browserZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
      await expect(drawer).toContainText(`Date and time (${browserZone})`);
      await input.fill("2026-11-12T10:30");
      await page.route("**/api/v1/recruiter/interviews/80000000-0000-4000-8000-000000000001", route => route.fulfill({ status: 204 }));
      const update = page.waitForRequest(request => request.method() === "PATCH" && request.url().endsWith("/interviews/80000000-0000-4000-8000-000000000001"));
      await drawer.getByRole("button", { name: "Save new schedule", exact: true }).click();
      expect((await update).postDataJSON()).toMatchObject({ action: "reschedule", scheduled_at: expectedUTC });
      await expect(drawer).not.toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}
