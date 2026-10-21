import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import { login, resetE2E } from "./helpers";
import { mockAICapabilities } from "./ai-capabilities";

const id = "98000000-0000-4000-8000-000000000001";
const source = "Java Backend Developer in Bengaluru. Experience 3 to 5 years. Required skills: Java, Spring Boot. Full-time, hybrid. Build and maintain Java services.";
const value = { title: "Java Backend Developer", location: "Bengaluru", department: "Platform", employment_type: "full_time", work_mode: "hybrid", role_category: null, min_experience_years: 3, max_experience_years: 5, skills: ["Java", "Spring Boot"], description: "Build Java services.", responsibilities: "Build and maintain Java services.", company_overview: null, why_join: null, hiring_process: null, education_requirements: null, openings: 1, min_salary_lakhs: null, max_salary_lakhs: null };

async function setup(page: Page, mode: "success" | "review-error" | "rate" | "slow" = "success", available = true) {
  await login(page, "recruiter"); await mockAICapabilities(page, available);
  const calls: { path: string; body: Record<string, any> }[] = [];
  const route = async (handler: any) => {
    const headers = { "Access-Control-Allow-Origin": new URL(page.url()).origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type,x-csrf-token", "Access-Control-Allow-Methods": "POST,PATCH,OPTIONS" };
    if (handler.request().method() === "OPTIONS") return handler.fulfill({ status: 204, headers });
    const path = new URL(handler.request().url()).pathname; const body = handler.request().postDataJSON(); calls.push({ path, body });
    const reviewing = handler.request().method() === "PATCH";
    if (!reviewing && mode === "slow") await new Promise(resolve => setTimeout(resolve, 1500));
    if (mode === "rate" || reviewing && mode === "review-error") return handler.fulfill({ status: mode === "rate" ? 429 : 503, headers, json: { error: { code: "ai_unavailable", message: "private provider diagnostic must not be shown", request_id: "safe-request-reference" } } });
    return handler.fulfill({ status: 200, headers, json: { id, revision: reviewing ? 1 : 0, expires_at: "2099-01-01T00:00:00Z", result: { status: reviewing ? "owner_reviewed" : "requires_review", domain_valid: true, value: reviewing ? body.fields : value, field_metadata: {} } } });
  };
  await page.route("**/api/v1/intelligence/jobs/parse", route);
  await page.route("**/api/v1/intelligence/parses/**", route);
  await page.goto("/recruiter/jobs/new");
  await page.getByLabel("Job title", { exact: true }).fill("Manual Engineer");
  await page.getByLabel("Location", { exact: true }).fill("Mumbai");
  await page.getByLabel("Minimum years", { exact: true }).fill("1");
  await page.getByLabel("Maximum years", { exact: true }).fill("4");
  await page.getByText("Import an existing job description", { exact: true }).click();
  await page.getByLabel("Existing job description", { exact: true }).fill(source);
  return calls;
}

async function parse(page: Page) {
  await page.getByLabel("Allow this job description").check();
  await page.getByRole("button", { name: "Parse with AI", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review imported fields", exact: true })).toBeVisible();
}

test.beforeEach(async ({ request }) => resetE2E(request));

test("JD import requires consent and explicit field review, preserves unselected values and never publishes", async ({ page }) => {
  const calls = await setup(page);
  let saves = 0; await page.route("**/api/v1/recruiter/jobs/builder", async route => { saves++; await route.abort(); });
  await page.getByRole("button", { name: "Parse with AI", exact: true }).click();
  await expect(page.getByRole("region", { name: "Import job description with AI", exact: true }).getByRole("status")).toContainText("allow processing"); expect(calls).toHaveLength(0);
  await parse(page);
  await expect(page.getByLabel("Job title", { exact: true })).toHaveValue("Manual Engineer");
  await expect(page.getByRole("button", { name: "Use reviewed fields", exact: true })).toBeDisabled();
  await page.getByLabel("Use job title", { exact: true }).check();
  await page.getByLabel("Proposed job title", { exact: true }).fill("Human-reviewed Java Engineer");
  await page.getByLabel("Use required skills", { exact: true }).check();
  await page.getByRole("button", { name: "Remove proposed role summary", exact: true }).click();
  await page.getByLabel("I reviewed the selected changes").check();
  await page.getByRole("button", { name: "Use reviewed fields", exact: true }).click();
  await expect(page.getByLabel("Job title", { exact: true })).toHaveValue("Human-reviewed Java Engineer");
  await expect(page.getByLabel("Location", { exact: true })).toHaveValue("Mumbai");
  await expect(page.getByLabel("Minimum years", { exact: true })).toHaveValue("1");
  expect(calls[0].body).toEqual({ text: source, external_ai_consent: true });
  expect(calls[1].body).toMatchObject({ expected_revision: 0, confirm: true, fields: { title: "Human-reviewed Java Engineer", location: "Mumbai", skills: ["Java", "Spring Boot"] } });
  expect(JSON.stringify(calls[0].body)).not.toMatch(/internal_notes|assigned_recruiter|tenant_id|actor_id|model/);
  expect(saves).toBe(0);
});

test("failed review preserves the job and exposes only a safe reference", async ({ page }) => {
  await setup(page, "review-error"); await parse(page);
  await page.getByLabel("Use job title", { exact: true }).check(); await page.getByLabel("I reviewed the selected changes").check();
  await page.getByRole("button", { name: "Use reviewed fields", exact: true }).click();
  await expect(page.getByRole("region", { name: "Import job description with AI", exact: true }).getByRole("status")).toContainText("No job fields have changed");
  await expect(page.getByRole("region", { name: "Import job description with AI", exact: true }).getByRole("status")).toContainText("safe-request-reference");
  await expect(page.getByText("private provider diagnostic must not be shown", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Job title", { exact: true })).toHaveValue("Manual Engineer");
});

test("cancelled or rate-limited parsing leaves manual work intact", async ({ page }) => {
  const calls = await setup(page, "slow");
  await page.getByLabel("Allow this job description").check(); await page.getByRole("button", { name: "Parse with AI", exact: true }).click();
  await page.getByRole("button", { name: "Cancel parsing", exact: true }).click();
  await expect(page.getByRole("region", { name: "Import job description with AI", exact: true }).getByRole("status")).toContainText("Parsing cancelled");
  await expect(page.getByLabel("Job title", { exact: true })).toHaveValue("Manual Engineer");
  await expect(page.getByRole("heading", { name: "Review imported fields", exact: true })).toHaveCount(0);
  expect(calls.length).toBeLessThanOrEqual(1);
});

test("unavailable actor sees a clear state with zero parsing requests", async ({ page }) => {
  const calls = await setup(page, "success", false);
  await expect(page.getByRole("button", { name: "Parse with AI", exact: true })).toBeDisabled();
  await expect(page.getByText("AI parsing is not enabled for your account. Manual entry remains available.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate with AI", exact: true })).toBeDisabled();
  expect(calls).toHaveLength(0);
});

for (const [width, height] of [[1440, 900], [1366, 768], [768, 1024], [428, 926], [360, 800]]) for (const mode of ["light", "dark", "system"] as const) test(`JD parse review ${width}x${height} ${mode}`, async ({ page }) => {
  test.setTimeout(90000); const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width, height }); await page.addInitScript(mode => localStorage.setItem("swx-theme", mode), mode);
  await page.emulateMedia({ colorScheme: mode === "system" ? "dark" : "light" });
  await setup(page); await parse(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await fs.mkdir("visual-artifacts/live-beta-ai-repair", { recursive: true });
  await page.screenshot({ path: `visual-artifacts/live-beta-ai-repair/jd-parse-${width}x${height}-${mode}.png`, fullPage: true, animations: "disabled" });
  if (mode === "system") { await page.emulateMedia({ colorScheme: "light" }); await expect(page.locator("html")).not.toHaveClass(/swx-dark/); await page.emulateMedia({ colorScheme: "dark" }); await expect(page.locator("html")).toHaveClass(/swx-dark/); }
  expect(errors).toEqual([]);
});
