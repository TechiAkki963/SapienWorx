import { expect, test, Page } from "@playwright/test";
import fs from "node:fs/promises";
import { login, resetE2E } from "./helpers";
import { mockAICapabilities } from "./ai-capabilities";

const generationID = "95000000-0000-4000-8000-000000000001";
const artifactRoot = "visual-artifacts/jd-generation-v1";
type MockMode = "success" | "unavailable" | "rate" | "slow" | "review-failure";

async function mockGeneration(page: Page, mode: MockMode = "success") {
  await mockAICapabilities(page);
  const calls: Record<string, unknown>[] = [];
  let revision = 0;
  await page.route("**/api/v1/intelligence/jobs/**", async route => {
    const headers = { "Access-Control-Allow-Origin": new URL(page.url()).origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type,x-csrf-token", "Access-Control-Allow-Methods": "POST,OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const body = route.request().postDataJSON();
    calls.push(body);
    const reviewing = route.request().url().endsWith("/review");
    if (mode === "slow" && !reviewing) await new Promise(resolve => setTimeout(resolve, 1500));
    if ((!reviewing && ["unavailable", "rate"].includes(mode)) || (reviewing && mode === "review-failure")) return route.fulfill({ status: mode === "rate" ? 429 : 503, headers, json: { error: { code: "ai_unavailable", message: "Use manual entry." } } });
    if (reviewing) { revision++; return route.fulfill({ status: 200, headers, json: { id: generationID, revision, result: { status: "owner_reviewed" } } }); }
    const f = body.fields;
    return route.fulfill({ status: 200, headers, json: { id: generationID, revision, result: { status: "requires_review", domain_valid: true, task: "job.generate_description", task_version: "v1.1", prompt_version: "jd-p1", schema_version: "jd-generation-v1", value: {
      generated_description: `${f.title}\n\nAbout the Role\nWe are looking for a ${f.title} based in ${f.location}.\n\nExperience\n${f.min_experience_years}–${f.max_experience_years} years\n\nLocation / Work Mode\n${f.location} · ${f.work_mode}`,
      suggested_skills: ["Go", "SQL"], warnings: ["Add explicit skills before publishing; no skills have been invented.", "Add role responsibilities before publishing; no duties have been invented."], regeneration: body.regenerate_from ? 1 : 0,
    } } } });
  });
  return calls;
}

async function basics(page: Page) {
  await page.getByLabel("Job title", { exact: true }).fill("Software Engineer");
  await page.getByLabel("Location", { exact: true }).fill("Bengaluru");
  await page.getByLabel("Minimum years", { exact: true }).fill("0");
  await page.getByLabel("Maximum years", { exact: true }).fill("3");
  await page.getByLabel("Allow these role details").check();
}
async function descriptionStep(page: Page) { await page.getByRole("button", { name: /Description Story/ }).click(); }

test.beforeEach(async ({ request }) => resetE2E(request));

test("generation is structured, explicit, editable and reviewed before candidate preview/publish", async ({ page }) => {
  await login(page, "recruiter");
  const calls = await mockGeneration(page);
  let saved: Record<string, unknown> | undefined;
  await page.route("**/api/v1/recruiter/jobs/builder", async route => { saved = route.request().postDataJSON(); await route.fulfill({ status: 201, json: { id: "synthetic-created-job" }, headers: { "Access-Control-Allow-Origin": new URL(page.url()).origin, "Access-Control-Allow-Credentials": "true" } }); });
  await page.goto("/recruiter/jobs/new");
  await page.getByRole("button", { name: "Generate with AI", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("valid minimum/maximum");
  expect(calls).toHaveLength(0);
  await basics(page);
  await page.getByRole("button", { name: "Generate with AI", exact: true }).click();
  await expect(page.getByText("Generated draft · not yet applied", { exact: true })).toBeVisible();
  expect(calls[0]).toMatchObject({ version: "v1.1", fields: { title: "Software Engineer", min_experience_years: 0, max_experience_years: 3 }, external_ai_consent: true });
  expect(JSON.stringify(calls[0])).not.toMatch(/min_salary|max_salary|internal_notes|assigned_recruiter_id|publish/);
  await page.getByRole("button", { name: "Accept Go", exact: true }).click();
  await page.getByRole("button", { name: "Use this draft", exact: true }).click();
  const summary = page.getByRole("textbox", { name: "Role summary", exact: true });
  await expect(summary).toHaveValue(/Software Engineer/);
  await expect(page.getByRole("complementary", { name: "Candidate preview locked" })).toBeVisible();
  await summary.fill("Human-edited role summary. Kubernetes is mandatory.");
  await page.getByRole("textbox", { name: "Responsibilities", exact: true }).fill("Maintain the assigned services.");
  await page.getByRole("button", { name: "I reviewed the description and requirements", exact: true }).click();
  await expect(page.getByText("AI draft reviewed", { exact: true })).toBeVisible();
  await expect(page.getByText("Candidate-facing preview", { exact: true })).toBeVisible();
  const review = calls.at(-1) as { fields: { description: string; skills: string[] } };
  expect(review.fields.description).toContain("Kubernetes");
  expect(review.fields.skills).toEqual(["Go"]);
  await summary.fill("Another human edit.");
  await expect(page.getByRole("complementary", { name: "Candidate preview locked" })).toBeVisible();
  await page.getByRole("button", { name: "I reviewed the description and requirements", exact: true }).click();
  await page.getByRole("button", { name: /Publish Review/ }).click();
  await expect(page.getByRole("button", { name: "Publish job", exact: true })).toBeEnabled();
  // Draft saving remains available regardless of AI review state.
  await page.getByRole("button", { name: "Save as draft", exact: true }).click();
  await expect(page).toHaveURL(/\/recruiter\/jobs$/);
  expect(saved).toMatchObject({ ai_generation_id: generationID, publish: false, description: "Another human edit.", skills: ["Go"] });
});

test("regeneration is an explicit action and uses the owned prior draft", async ({ page }) => {
  await login(page, "recruiter"); const calls = await mockGeneration(page); await page.goto("/recruiter/jobs/new"); await basics(page);
  await page.getByRole("button", { name: "Generate with AI", exact: true }).click();
  await page.getByRole("button", { name: "Regenerate", exact: true }).click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1]).toHaveProperty("regenerate_from", generationID);
  await page.getByRole("button", { name: "Use this draft", exact: true }).click();
  await page.getByRole("textbox", { name: "Role summary", exact: true }).fill("Manual changes do not cause another generation.");
  expect(calls).toHaveLength(2);
});

test("editing an existing role keeps private fields out of generation and review", async ({ page }) => {
  await login(page, "recruiter"); const calls = await mockGeneration(page);
  await page.goto("/recruiter/jobs/60000000-0000-4000-8000-000000000001/edit");
  await page.getByLabel("Allow these role details").check();
  await page.getByRole("button", { name: "Generate with AI", exact: true }).click();
  await page.getByRole("button", { name: "Use this draft", exact: true }).click();
  await page.getByRole("button", { name: "I reviewed the description and requirements", exact: true }).click();
  await expect(page.getByText("AI draft reviewed", { exact: true })).toBeVisible();
  expect(calls).toHaveLength(2);
  for (const call of calls) expect(JSON.stringify(call)).not.toMatch(/salary|internal_notes|assigned_recruiter_id/);
  await page.getByRole("button", { name: /Hiring workflow Ownership/ }).click();
  await expect(page.getByLabel("Minimum salary in lakhs")).toHaveValue("8");
  await expect(page.getByLabel("Internal recruiter notes")).toHaveValue("Priority role. Review referrals within 48 hours.");
});

test("generation and review work with keyboard, readable contrast and touch targets", async ({ page }) => {
  await login(page, "recruiter"); await mockGeneration(page); await page.goto("/recruiter/jobs/new"); await basics(page);
  const generate = page.getByRole("button", { name: "Generate with AI", exact: true });
  await generate.focus(); await page.keyboard.press("Enter");
  const use = page.getByRole("button", { name: "Use this draft", exact: true });
  await expect(use).toBeVisible(); await use.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Description", exact: true })).toBeFocused();
  const review = page.getByRole("button", { name: "I reviewed the description and requirements", exact: true });
  await review.focus(); await page.keyboard.press("Enter"); await expect(page.getByText("AI draft reviewed", { exact: true })).toBeVisible();
  for (const mode of ["light", "dark"] as const) {
    await page.evaluate(mode => { localStorage.setItem("swx-theme", mode); document.documentElement.classList.toggle("swx-dark", mode === "dark"); }, mode);
    const geometry = await page.getByRole("region", { name: "AI description assistant" }).getByRole("button").evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height));
    expect(geometry.every(height => height >= 44)).toBe(true);
    const contrast = await page.getByRole("region", { name: "AI description assistant" }).locator("h3, p.text-xs").evaluateAll(elements => {
      const rgb = (value: string) => (value.match(/[\d.]+/g) || []).map(Number);
      const lum = (values: number[]) => values.slice(0, 3).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
      return elements.filter(el => el.textContent?.trim()).map(el => {
        let parent: Element | null = el; let bg: number[] = [];
        while (parent) { bg = rgb(getComputedStyle(parent).backgroundColor); if (bg.length === 3 || bg[3] > .99) break; parent = parent.parentElement; }
        const foreground = lum(rgb(getComputedStyle(el).color)); const background = lum(bg);
        return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
      });
    });
    expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
  }
});

for (const mode of ["unavailable", "rate", "review-failure"] as const) test(`${mode} preserves manual entry`, async ({ page }) => {
  await login(page, "recruiter"); await mockGeneration(page, mode); await page.goto("/recruiter/jobs/new"); await basics(page);
  await descriptionStep(page);
  const summary = page.getByRole("textbox", { name: "Role summary", exact: true });
  await summary.fill("Keep my manual draft.");
  await page.getByRole("button", { name: "Generate with AI", exact: true }).click();
  if (mode === "review-failure") {
    await page.getByRole("button", { name: "Use this draft", exact: true }).click();
    await page.getByRole("button", { name: "I reviewed the description and requirements", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Review could not be recorded");
    await expect(page.getByRole("complementary", { name: "Candidate preview locked" })).toBeVisible();
  } else {
    await expect(page.getByRole("status")).toContainText(mode === "rate" ? "usage limit" : "unavailable for your account");
    await expect(summary).toHaveValue("Keep my manual draft.");
  }
  await summary.fill("Manual writing still works.");
  await expect(summary).toHaveValue("Manual writing still works.");
  await expect(page.getByRole("button", { name: "Save as draft", exact: true })).toBeEnabled();
});

test("slow generation is cancellable without overwriting in-flight human edits", async ({ page }) => {
  await login(page, "recruiter"); await mockGeneration(page, "slow"); await page.goto("/recruiter/jobs/new"); await basics(page); await descriptionStep(page);
  await page.getByRole("button", { name: "Generate with AI", exact: true }).click();
  await expect(page.getByRole("button", { name: "Generating job description…", exact: true })).toBeDisabled();
  await page.getByRole("textbox", { name: "Role summary", exact: true }).fill("Edited while waiting.");
  await page.getByRole("button", { name: "Cancel generation", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("cancelled");
  await expect(page.getByRole("textbox", { name: "Role summary", exact: true })).toHaveValue("Edited while waiting.");
  await expect(page.getByText("Generated draft · not yet applied", { exact: true })).toHaveCount(0);
});

const viewports = [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[428,926],[360,800]];
for (const [width, height] of viewports) for (const mode of ["light", "dark", "system"] as const) test(`JD generator visual ${width}x${height} ${mode}`, async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width, height });
  await page.addInitScript(mode => localStorage.setItem("swx-theme", mode), mode);
  await page.emulateMedia({ colorScheme: mode === "system" ? "dark" : "light" });
  await login(page, "recruiter"); await mockGeneration(page); await page.goto("/recruiter/jobs/new"); await basics(page);
  await page.getByRole("button", { name: "Generate with AI", exact: true }).click();
  await expect(page.getByText("Generated draft · not yet applied", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await fs.mkdir(artifactRoot, { recursive: true });
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: `${artifactRoot}/draft-${width}x${height}-${mode}.png`, fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Use this draft", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Candidate preview locked" })).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: `${artifactRoot}/editor-${width}x${height}-${mode}.png`, fullPage: true, animations: "disabled" });
  if (mode === "system") {
    await page.emulateMedia({ colorScheme: "light" }); await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
    await page.emulateMedia({ colorScheme: "dark" }); await expect(page.locator("html")).toHaveClass(/swx-dark/);
  }
  expect(errors).toEqual([]);
});
