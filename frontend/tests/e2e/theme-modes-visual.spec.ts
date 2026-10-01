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


test("Candidate 360 supports system, light and dark modes without losing recruiter data", async ({ page }) => {
  const jobID = "60000000-0000-4000-8000-000000000001";
  const candidateID = "71000000-0000-4000-8000-000000000001";
  await fs.mkdir("visual-artifacts/theme-modes", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "recruiter");
  await page.goto(`/recruiter/candidates/${candidateID}?job_id=${jobID}`);

  const assertCandidate360 = async () => {
    await expect(page.getByText("Candidate 360°", { exact: true })).toBeVisible();
    await expect(page.getByText("Candidate 001", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("Job match score 86 percent")).toBeVisible();
    await expect(page.getByRole("button", { name: /Recruiter Notes/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Professional Summary" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Employment" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Education" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Languages" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "Candidate 360 theme mode");
  };

  await chooseMode(page, "Light");
  await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
  await assertCandidate360();
  await page.screenshot({ path: "visual-artifacts/theme-modes/candidate-360-light.png", fullPage: true });

  await chooseMode(page, "Dark");
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await assertCandidate360();
  await expect(page.getByRole("region", { name: "Candidate job match" })).toHaveCSS("background-color", "rgb(17, 24, 39)");
  await page.screenshot({ path: "visual-artifacts/theme-modes/candidate-360-dark.png", fullPage: true });

  await page.emulateMedia({ colorScheme: "dark" });
  await chooseMode(page, "System");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await assertCandidate360();
  await expect(page.getByRole("region", { name: "Candidate job match" })).toHaveCSS("background-color", "rgb(17, 24, 39)");
  await page.screenshot({ path: "visual-artifacts/theme-modes/candidate-360-system.png", fullPage: true });
});
