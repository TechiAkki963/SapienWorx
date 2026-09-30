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

async function assertRoleData(page: import("@playwright/test").Page, role: "candidate" | "recruiter" | "master_admin") {
  if (role === "candidate") {
    await expect(page.getByRole("heading", { name: "My Professional Profile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "About Me" })).toBeVisible();
  } else if (role === "recruiter") {
    await expect(page.getByRole("heading", { name: "Job management" })).toBeVisible();
    await expect(page.getByRole("table").getByText("SWX-JOB-2026-00001").first()).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Platform command centre" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Registered users: 4. View records" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Candidates: 2. View records" })).toBeVisible();
  }
}

async function chooseMode(page: import("@playwright/test").Page, label: "System" | "Light" | "Dark") {
  await page.getByTitle("Appearance").click();
  await page.getByTitle(label + " mode").click();
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
  await assertRoleData(page, role);

  await chooseMode(page, "Light");
  await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
  await assertRoleData(page, role);
  await assertNoHorizontalOverflow(page, role + " light mode");
  await page.screenshot({ path: `visual-artifacts/theme-modes/${role}-light.png`, fullPage: true });

  await chooseMode(page, "Dark");
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await assertRoleData(page, role);
  await assertNoHorizontalOverflow(page, role + " dark mode");
  await page.screenshot({ path: `visual-artifacts/theme-modes/${role}-dark.png`, fullPage: true });

  await page.emulateMedia({ colorScheme: "dark" });
  await chooseMode(page, "System");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await assertRoleData(page, role);
  await assertNoHorizontalOverflow(page, role + " system mode");
  await page.screenshot({ path: `visual-artifacts/theme-modes/${role}-system.png`, fullPage: true });
}

test.beforeEach(async ({ request, page }) => {
  await resetE2E(request);
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("swx-theme"));
});

test("Candidate workspace supports system, light and dark modes", async ({ page }) => {
  await captureModes(page, "candidate", "/candidate/profile");
});

test("Recruiter workspace supports system, light and dark modes", async ({ page }) => {
  await captureModes(page, "recruiter", "/recruiter/jobs");
});

test("Master Admin workspace supports system, light and dark modes", async ({ page }) => {
  await captureModes(page, "master_admin", "/swx-command-centre/overview");
});
