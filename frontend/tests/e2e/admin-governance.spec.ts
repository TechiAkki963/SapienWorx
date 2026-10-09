import { expect, test, type Page } from "@playwright/test";

const mock = "http://127.0.0.1:18090";
const candidate = "10000000-0000-4000-8000-000000000001";
const company = "40000000-0000-4000-8000-000000000001";
async function login(page: Page) {
  await page.goto("/swx-command-centre");
  await page.getByLabel("Email", { exact: true }).fill("master_admin@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("E2e-password-123!");
  await page.getByRole("button", { name: "Enter command centre", exact: true }).click();
}
test.beforeEach(async ({ request }) => { await request.post(mock+"/__e2e/reset"); await request.post(mock+"/__e2e/admin-security", { data: { governanceFull: true } }); });
test.afterEach(async ({ request }) => { await request.post(mock+"/__e2e/reset"); });

test("account confirmation cancel suspend reactivate reset and session revocation", async ({ page, request }) => {
  await login(page); await page.goto("/swx-command-centre/users?q="+candidate);
  await page.getByRole("button", { name: "Suspend", exact: true }).click();
  await expect(page.getByLabel("Justification", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  let logged = await (await request.get(mock+"/__e2e/requests")).json();
  expect(logged.items.some((item: { path: string; method: string }) => item.path.endsWith("/suspend") && item.method === "POST")).toBe(false);
  await page.getByRole("button", { name: "Suspend", exact: true }).click();
  await page.getByLabel("Justification", { exact: true }).fill("CASE-100 reviewed by QA");
  await page.getByRole("button", { name: "Confirm Suspend", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reactivate", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Reactivate", exact: true }).click();
  await expect(page.getByText("Required password resets remain required.", { exact: false })).toBeVisible();
  await page.getByLabel("Justification", { exact: true }).fill("CASE-101 approved return");
  await page.getByRole("button", { name: "Confirm Reactivate", exact: true }).click();
  await expect(page.getByRole("button", { name: "Suspend", exact: true })).toBeVisible();
  for (const action of ["Force reset", "Revoke sessions"]) {
    await page.getByRole("button", { name: action, exact: true }).click();
    await page.getByLabel("Justification", { exact: true }).fill("CASE-102 reviewed action");
    await page.getByRole("button", { name: "Confirm "+action, exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "completed" })).toContainText("audited");
  }
  await expect(page.getByText("Reset required", { exact: true }).first()).toBeVisible();
  logged = await (await request.get(mock+"/__e2e/requests")).json();
  for (const suffix of ["suspend", "reactivate", "force-password-reset", "revoke-sessions"]) expect(logged.items.filter((item: { path: string; method: string }) => item.path === `/api/v1/admin/users/${candidate}/${suffix}` && item.method === "POST")).toHaveLength(1);
});

test("stale action fails honestly and protected accounts cannot be mutated", async ({ page, request }) => {
  await login(page); await page.goto("/swx-command-centre/users?q="+candidate);
  await request.post(mock+"/__e2e/admin-security", { data: { actionConflict: true } });
  await page.getByRole("button", { name: "Suspend", exact: true }).click();
  await page.getByLabel("Justification", { exact: true }).fill("CASE-200 stale review");
  await page.getByRole("button", { name: "Confirm Suspend", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Account action failed" })).toContainText("Refresh this record");
  await expect(page.getByRole("status").filter({ hasText: "completed" })).toHaveCount(0);
  await page.goto("/swx-command-centre/users?q=Protected");
  await expect(page.getByText("Protected account — no actions here").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Suspend", exact: true })).toHaveCount(0);
  await page.goto("/swx-command-centre/users?status=disabled");
  await expect(page.getByText("Disabled accounts require a separate review", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Reactivate", exact: true })).toHaveCount(0);
});

test("organization filters and recruiter drill-down retain organization scope", async ({ page, request }) => {
  await login(page); await page.getByRole("link", { name: "Organizations", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Organization governance" })).toBeVisible();
  await expect(page.getByRole("note").filter({ hasText: "Verification is not" })).toBeVisible();
  const filters = page.getByRole("form", { name: "Filter organizations", exact: true });
  await filters.getByLabel("Search organizations", { exact: true }).fill("Acme");
  await filters.getByLabel("Country code", { exact: true }).fill("IN");
  await filters.getByRole("button", { name: "Apply filters", exact: true }).click();
  await page.getByRole("link", { name: "View associated recruiters →" }).click();
  await expect(page).toHaveURL(/users\?.*company_id=/);
  expect(new URL(page.url()).searchParams.get("company_id")).toBe(company);
  await expect(page.getByText("Riya Recruiter", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Aarav Candidate", { exact: true })).toHaveCount(0);
  await page.getByLabel("Account status", { exact: true }).selectOption("active");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page).toHaveURL(/users\?.*status=active/);
  expect(new URL(page.url()).searchParams.get("company_id")).toBe(company);
  const logged = await (await request.get(mock+"/__e2e/requests")).json();
  const last = logged.items.filter((item: { path: string }) => item.path === "/api/v1/admin/users").at(-1);
  expect(last.query.company_id).toBe(company); expect(last.query.role).toBe("recruiter");
});

test("review cancellation makes no mutation and rejection requires a reason", async ({ page, request }) => {
  await login(page); await page.goto("/swx-command-centre/tenants");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const logged = await (await request.get(mock+"/__e2e/requests")).json();
  expect(logged.items.some((item: { path: string; method: string }) => item.path.endsWith("/approve") && item.method === "POST")).toBe(false);
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByLabel("Reason for rejection", { exact: true })).toHaveAttribute("required", "");
  await page.getByLabel("Reason for rejection", { exact: true }).fill("CASE-400 missing evidence");
  await page.getByRole("button", { name: "Confirm rejection", exact: true }).click();
  await expect(page.getByText("No pending verification records.")).toBeVisible();
});

test("support scope hides new mutations and auditor cannot fetch organizations", async ({ page, request }) => {
  await request.post(mock+"/__e2e/admin-security", { data: { enabled: true, admin_role: "support_admin", mfa_enrolled: true, mfa_verified: true } });
  await login(page); await page.goto("/swx-command-centre/users");
  for (const action of ["Suspend", "Reactivate", "Force reset", "Revoke sessions"]) await expect(page.getByRole("button", { name: action, exact: true })).toHaveCount(0);
  await request.post(mock+"/__e2e/admin-security", { data: { admin_role: "auditor" } });
  await page.goto("/swx-command-centre/organizations");
  await expect(page).toHaveURL(/\/access$/);
  const logged = await (await request.get(mock+"/__e2e/requests")).json();
  expect(logged.items.some((item: { path: string }) => item.path === "/api/v1/admin/organizations")).toBe(false);
});

test("desktop tables become usable cards on tablet and mobile", async ({ page }) => {
  await login(page);
  for (const width of [1440,1024,768,390,320]) {
    await page.setViewportSize({ width, height: 960 });
    for (const path of ["users", "organizations"]) {
      await page.goto("/swx-command-centre/"+path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (path === "users") { if (width < 1024) { await expect(page.getByRole("table")).toBeHidden(); await expect(page.getByRole("article", { name: "Account Aarav Candidate", exact: true })).toBeVisible(); } else await expect(page.getByRole("table")).toBeVisible(); }
      await page.screenshot({ path: `../output/admin-governance-${path}-${width}.png`, fullPage: true });
    }
  }
});
