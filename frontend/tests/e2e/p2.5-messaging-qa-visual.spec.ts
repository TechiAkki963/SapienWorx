import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";

import { login, resetE2E } from "./helpers";

const viewports = [
  { label: "1440x900", width: 1440, height: 900 },
  { label: "1366x768", width: 1366, height: 768 },
  { label: "1024x768", width: 1024, height: 768 },
  { label: "768x1024", width: 768, height: 1024 },
  { label: "428x926", width: 428, height: 926 },
  { label: "360x800", width: 360, height: 800 },
];

async function noOverflow(page: Page, label: string) {
  const result = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(result.width, label).toBeLessThanOrEqual(result.viewport + 1);
}

async function chooseMode(page: Page, label: "System" | "Light" | "Dark") {
  await page.getByTitle("Appearance").click();
  await page.getByTitle(label + " mode").click();
}

async function resetTheme(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("swx-theme"));
}

test.beforeEach(async ({ request, page }) => {
  await resetE2E(request);
  await resetTheme(page);
  await fs.mkdir("visual-artifacts/p2.5-messaging-qa", { recursive: true });
});

test("P2.5 candidate inbox responsive matrix", async ({ page }) => {
  await login(page, "candidate");
  await page.goto("/candidate/inbox");
  await expect(page.getByRole("heading", { name: "Inbox" }).first()).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/candidate/inbox");
    await expect(page.getByText("Riya Recruiter").first()).toBeVisible();
    await noOverflow(page, "candidate inbox " + viewport.label);
    await page.screenshot({
      path: `visual-artifacts/p2.5-messaging-qa/candidate-inbox-light-${viewport.label}.png`,
      fullPage: true,
    });
  }
});

test("P2.5 recruiter messages responsive matrix", async ({ page }) => {
  await login(page, "recruiter");

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/recruiter/messages");
    await expect(page.getByRole("heading", { name: "Messages" }).first()).toBeVisible();
    await expect(page.getByText("Aarav Candidate").first()).toBeVisible();
    await noOverflow(page, "recruiter messages " + viewport.label);
    await page.screenshot({
      path: `visual-artifacts/p2.5-messaging-qa/recruiter-messages-light-${viewport.label}.png`,
      fullPage: true,
    });
  }
});

test("P2.5 candidate notifications responsive matrix", async ({ page }) => {
  await login(page, "candidate");

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/candidate/notifications");
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByText("New message from a recruiter")).toBeVisible();
    await noOverflow(page, "candidate notifications " + viewport.label);
    await page.screenshot({
      path: `visual-artifacts/p2.5-messaging-qa/candidate-notifications-light-${viewport.label}.png`,
      fullPage: true,
    });
  }
});

test("P2.5 bulk InMail drawer responsive matrix", async ({ page }) => {
  await login(page, "recruiter");
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/recruiter/talent-pool");
    await page.getByLabel("Select Aarav Mehta").check();
    await page.getByRole("button", { name: "Send Bulk InMail" }).click();
    const dialog = page.getByRole("dialog", { name: "Send Bulk InMail" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/14-day cooldown/i)).toBeVisible();
    await noOverflow(page, "bulk InMail " + viewport.label);
    await expect.poll(async () => {
      const box = await dialog.boundingBox();
      if (!box) return null;
      return {
        right: Math.round(box.x + box.width),
        width: Math.round(box.width),
      };
    }, {
      message: "Bulk InMail drawer geometry at " + viewport.label,
      timeout: 5_000,
    }).toEqual({
      right: viewport.width,
      width: viewport.width < 608 ? viewport.width : 608,
    });
    await page.screenshot({
      path: `visual-artifacts/p2.5-messaging-qa/bulk-inmail-light-${viewport.label}.png`,
      fullPage: false,
    });
    await page.getByRole("button", { name: "Close drawer" }).click();
  }
});

test("P2.5 outreach campaign responsive matrix", async ({ page }) => {
  await login(page, "recruiter");
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/recruiter/outreach");
    await expect(page.getByRole("heading", { name: "Outreach" })).toBeVisible();
    await expect(page.getByText("Mumbai platform hiring")).toBeVisible();
    await noOverflow(page, "outreach " + viewport.label);
    await page.screenshot({
      path: `visual-artifacts/p2.5-messaging-qa/outreach-campaigns-light-${viewport.label}.png`,
      fullPage: true,
    });
  }
});

for (const role of ["candidate", "recruiter"] as const) {
  test(`P2.5 ${role} messaging supports System Light Dark`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, role);
    const path = role === "candidate" ? "/candidate/inbox" : "/recruiter/messages";
    await page.goto(path);

    await chooseMode(page, "Light");
    await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
    await noOverflow(page, role + " messaging light");
    await page.screenshot({ path: `visual-artifacts/p2.5-messaging-qa/${role}-messaging-theme-light-1440x900.png`, fullPage: true });

    await chooseMode(page, "Dark");
    await expect(page.locator("html")).toHaveClass(/swx-dark/);
    await noOverflow(page, role + " messaging dark");
    await page.screenshot({ path: `visual-artifacts/p2.5-messaging-qa/${role}-messaging-theme-dark-1440x900.png`, fullPage: true });

    await page.emulateMedia({ colorScheme: "dark" });
    await chooseMode(page, "System");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
    await expect(page.locator("html")).toHaveClass(/swx-dark/);
    await noOverflow(page, role + " messaging system");
    await page.screenshot({ path: `visual-artifacts/p2.5-messaging-qa/${role}-messaging-theme-system-1440x900.png`, fullPage: true });

    await page.setViewportSize({ width: 360, height: 800 });
    await noOverflow(page, role + " messaging system mobile");
    await page.screenshot({ path: `visual-artifacts/p2.5-messaging-qa/${role}-messaging-theme-system-360x800.png`, fullPage: true });
  });
}


test("P2.5 Master Admin messaging health evidence", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "master_admin");
  await page.goto("/swx-command-centre/system");
  await expect(page.getByRole("heading", { name: "Amazon SES delivery health" })).toBeVisible();
  await expect(page.getByText("1 bounce · 1 complaint", { exact: true })).toBeVisible();
  await noOverflow(page, "SES health light");
  await page.screenshot({ path: "visual-artifacts/p2.5-messaging-qa/admin-ses-health-light-1440x900.png", fullPage: true });

  await chooseMode(page, "Dark");
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await noOverflow(page, "SES health dark");
  await page.screenshot({ path: "visual-artifacts/p2.5-messaging-qa/admin-ses-health-dark-1440x900.png", fullPage: true });

  await page.setViewportSize({ width: 360, height: 800 });
  await noOverflow(page, "SES health mobile dark");
  await page.screenshot({ path: "visual-artifacts/p2.5-messaging-qa/admin-ses-health-dark-360x800.png", fullPage: true });
});
