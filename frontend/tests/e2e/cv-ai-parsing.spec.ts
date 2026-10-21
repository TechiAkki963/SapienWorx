import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import { login, resetE2E } from "./helpers";
import { mockAICapabilities } from "./ai-capabilities";

const id = "98000000-0000-4000-8000-000000000002";
const proposed = { identity: { display_name: "Synthetic Candidate" }, professional: { headline: "Platform Engineer", summary: "Builds reliable platforms.",total_experience_months:0 }, skills: [{ entity: { name: "Go", raw_value: "Go" } }], contact: { primary_email: "synthetic@example.test" } };
const result = { result_id: id, revision: 0, proposed_profile: proposed, parser_generated_summary: null, fields: {} };
const headline = "/professional/headline";

async function setup(page: Page, available = true, fail = false, slow = false) {
  await login(page, "candidate"); await mockAICapabilities(page, available);
  const calls: { path: string; method: string; body?: any }[] = [];
  await page.route("**/api/v1/intelligence/**", async route => {
    if (route.request().url().endsWith("/capabilities")) return route.fallback();
    const headers = { "Access-Control-Allow-Origin": new URL(page.url()).origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type,x-csrf-token", "Access-Control-Allow-Methods": "POST,PATCH,OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname, method = route.request().method();
    const body = path.endsWith("/cv/parse") ? undefined : route.request().postDataJSON(); calls.push({ path, method, body });
    if (path.endsWith("/cv/parse") && slow) await new Promise(resolve => setTimeout(resolve, 2500));
    if (fail && method === "PATCH") return route.fulfill({ status: 503, headers, json: { error: { code: "ai_unavailable", message: "provider-private-diagnostic", request_id: "cv-safe-reference" } } });
    if (path.endsWith("/apply")) return route.fulfill({ status: 200, headers, json: { applied_paths: [headline], manual_paths: ["/contact/primary_email"], saved: body.confirm, already_applied: false } });
    return route.fulfill({ status: 200, headers, json: { ...result, revision: method === "PATCH" ? 1 : 0 } });
  });
  await page.goto("/candidate/profile#section-resume");
  await page.getByText("Review profile suggestions from a CV with AI", { exact: true }).click();
  await page.getByLabel("CV for AI review", { exact: true }).setInputFiles({ name: "synthetic.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 Synthetic mock file; scan/extraction verified separately in backend tests") });
  return calls;
}
async function parse(page: Page) {
  await page.getByLabel("Allow this CV to be sent").check();
  await page.getByRole("button", { name: "Prepare CV suggestions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review CV suggestions", exact: true })).toBeVisible();
}
test.beforeEach(async ({ request }) => resetE2E(request));

test("CV review requires consent, per-field approval and separate save; contacts remain manual", async ({ page }) => {
  const calls = await setup(page);
  const region = page.getByRole("region", { name: "Review CV with AI", exact: true });
  await page.getByRole("button", { name: "Prepare CV suggestions", exact: true }).click();
  await expect(region.getByRole("status")).toContainText("allow processing"); expect(calls).toHaveLength(0);
  await parse(page);
  await expect(page.getByRole("button", { name: "Preview reviewed changes", exact: true })).toBeDisabled();
  await page.getByLabel("Use Professional title", { exact: true }).check();
  await page.getByLabel("Proposed Professional title", { exact: true }).fill("Human reviewed engineer");
  await page.getByLabel("Use Email address", { exact: true }).check();
  await page.getByLabel("I reviewed the selected CV facts").check();
  await page.getByRole("button", { name: "Preview reviewed changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirm profile changes", exact: true })).toBeVisible();
  expect(calls).toHaveLength(3);
  const decisions = calls[1].body.decisions;
  expect(decisions.find((item: any) => item.path === headline)).toEqual({ path: headline, status: "edited", value: "Human reviewed engineer" });
  expect(decisions.find((item: any) => item.path === "/identity/display_name").status).toBe("rejected");
  expect(calls[2].body).toMatchObject({ expected_revision: 1, confirm: false });
  expect(calls[2].body.expected_profile_updated_at).toBeTruthy();
  await expect(page.getByText("These suggestions will not be saved here.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Confirm and save profile changes", exact: true }).click();
  await expect(region.getByRole("status")).toContainText("reviewed profile changes have been saved");
  expect(calls[3].body.confirm).toBe(true);
  expect(calls[3].body).not.toHaveProperty("changes"); expect(calls[3].body).not.toHaveProperty("candidate_id");
});

test("CV review error and cancellation preserve profile, with safe diagnostics only", async ({ page }) => {
  const calls = await setup(page, true, true); await parse(page);
  await page.getByLabel("Use Professional title", { exact: true }).check(); await page.getByLabel("I reviewed the selected CV facts").check();
  await page.getByRole("button", { name: "Preview reviewed changes", exact: true }).click();
  await expect(page.getByRole("region", { name: "Review CV with AI", exact: true }).getByRole("status")).toContainText("cv-safe-reference");
  await expect(page.getByText("provider-private-diagnostic", { exact: true })).toHaveCount(0);
  expect(calls.some(call => call.path.endsWith("/apply"))).toBe(false);
  await page.getByRole("button", { name: "Discard suggestions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review CV suggestions", exact: true })).toHaveCount(0);
});

test("CV parsing can be cancelled during a slow request", async ({ page }) => {
  await setup(page, true, false, true); await page.getByLabel("Allow this CV to be sent").check();
  await page.getByRole("button", { name: "Prepare CV suggestions", exact: true }).click();
  await page.getByRole("button", { name: "Cancel CV parsing", exact: true }).click();
  await expect(page.getByRole("region", { name: "Review CV with AI", exact: true }).getByRole("status")).toContainText("Parsing cancelled");
  await expect(page.getByRole("heading", { name: "Review CV suggestions", exact: true })).toHaveCount(0);
});

test("blank CV numeric edit never becomes a confirmed zero",async({page})=>{
 const calls=await setup(page);await parse(page);
 await page.getByLabel("Use Total experience in months",{exact:true}).check();
 await page.getByLabel("Proposed Total experience in months",{exact:true}).fill("");
 await page.getByLabel("I reviewed the selected CV facts").check();
 await page.getByRole("button",{name:"Preview reviewed changes",exact:true}).click();
 await expect(page.getByRole("region",{name:"Review CV with AI",exact:true}).getByRole("status")).toContainText("Enter a valid number");
 expect(calls).toHaveLength(1);
});

test("CV unavailable account has manual fallback and no parse request", async ({ page }) => {
  const calls = await setup(page, false);
  await expect(page.getByRole("button", { name: "Prepare CV suggestions", exact: true })).toBeDisabled();
  await expect(page.getByText("AI CV review is not enabled for your account.", { exact: false })).toBeVisible();
  expect(calls).toHaveLength(0);
});

for (const [width, height] of [[1440,900],[1366,768],[768,1024],[428,926],[360,800]]) for (const mode of ["light","dark","system"] as const) test(`CV parse review ${width}x${height} ${mode}`, async ({ page }) => {
  test.setTimeout(90000); const errors: string[] = []; page.on("pageerror",error=>errors.push(error.message));
  await page.setViewportSize({ width,height }); await page.addInitScript(mode=>localStorage.setItem("swx-theme",mode),mode); await page.emulateMedia({ colorScheme: mode === "system" ? "dark" : "light" });
  await setup(page); await parse(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await fs.mkdir("visual-artifacts/live-beta-ai-repair",{recursive:true});
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior="auto";if(document.activeElement instanceof HTMLElement)document.activeElement.blur();window.scrollTo(0,0)});
  await page.screenshot({ path:`visual-artifacts/live-beta-ai-repair/cv-parse-${width}x${height}-${mode}.png`,fullPage:true,animations:"disabled" });
  await page.getByRole("heading",{name:"Review CV suggestions",exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`visual-artifacts/live-beta-ai-repair/cv-review-viewport-${width}x${height}-${mode}.png`,animations:"disabled"});
  if(mode==="system"){await page.emulateMedia({colorScheme:"light"});await expect(page.locator("html")).not.toHaveClass(/swx-dark/);await page.emulateMedia({colorScheme:"dark"});await expect(page.locator("html")).toHaveClass(/swx-dark/)}
  expect(errors).toEqual([]);
});
