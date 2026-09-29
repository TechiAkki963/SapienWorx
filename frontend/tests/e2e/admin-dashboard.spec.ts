import { expect, test, type Page } from "@playwright/test";

const mock = "http://127.0.0.1:18090";
async function login(page: Page) {
  await page.goto("/swx-command-centre");
  await page.getByLabel("Email", { exact: true }).fill("master_admin@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("E2e-password-123!");
  await page.getByRole("button", { name: "Enter command centre", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Platform command centre" })).toBeVisible();
}
test.beforeEach(async ({ request }) => { await request.post(mock + "/__e2e/reset"); });
test.afterEach(async ({ request }) => { await request.post(mock + "/__e2e/reset"); });

test("totals, queue drill-down and reporting periods use real filters", async ({ page, request }) => {
  await login(page);
  await expect(page.getByRole("link", { name: "Registered users: 4. View records" })).toBeVisible();
  await expect(page.getByText("Currently in offer stage; not historical offers issued.")).toBeVisible();
  const candidates = page.getByRole("link", { name: "Candidates: 2. View records" });
  await expect(candidates).toHaveAttribute("href", "/swx-command-centre/users?role=candidate");
  await candidates.click();
  await expect(page).toHaveURL(/users\?role=candidate$/);
  await expect(page.locator('select[name="role"]')).toHaveValue("candidate");
  await page.goto("/swx-command-centre/overview");
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Company reviews", exact: true }) }).click();
  await expect(page).toHaveURL(/tenants\?status=pending$/);
  await expect(page.getByRole("heading", { name: "Recruiter verification" })).toBeVisible();
  await page.goto("/swx-command-centre/overview");
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Draft jobs", exact: true }) }).click();
  await expect(page).toHaveURL(/jobs\?status=draft$/);
  await expect(page.locator('select[name="status"]')).toHaveValue("draft");
  await page.goto("/swx-command-centre/overview");
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Accounts awaiting verification", exact: true }) }).click();
  await expect(page).toHaveURL(/users\?status=pending_verification$/);
  await expect(page.locator('select[name="status"]')).toHaveValue("pending_verification");
  await page.goto("/swx-command-centre/overview");
  await page.getByLabel("Period", { exact: true }).selectOption("today");
  await page.getByRole("button", { name: "Apply window" }).click();
  await expect(page).toHaveURL(/period=today/);
  await expect(page.getByRole("link", { name: "Registered users: 4. View records" })).toBeVisible();
  const logged = await (await request.get(mock + "/__e2e/requests")).json();
  const dashboards = logged.items.filter((item: { path: string }) => item.path === "/api/v1/admin/dashboard");
  expect(dashboards.at(-1).query.period).toBe("today");
  expect(logged.items.some((item: { path: string }) => item.path === "/api/v1/admin/metrics")).toBe(false);
});

test("custom dates reject reversed ranges without displaying fake zeros", async ({ page }) => {
  await login(page);
  await page.getByLabel("Period", { exact: true }).selectOption("custom");
  await page.getByLabel("From (custom only)").fill("2026-09-20");
  await page.getByLabel("Through (custom only)").fill("2026-09-19");
  await page.getByRole("button", { name: "Apply window" }).click();
  await expect(page.getByRole("alert", { name: "Invalid reporting window" })).toContainText("valid custom dates");
  await expect(page.getByRole("heading", { name: "Current platform totals" })).toHaveCount(0);
  await page.getByLabel("Through (custom only)").fill("2026-09-21");
  await page.getByRole("button", { name: "Apply window" }).click();
  await expect(page.getByRole("heading", { name: "Current platform totals" })).toBeVisible();
});

test("auditor sees aggregates but not scoped operational queues", async ({ page, request }) => {
  await request.post(mock + "/__e2e/admin-security", { data: { enabled: true, admin_role: "auditor", mfa_enrolled: true, mfa_verified: true } });
  await login(page);
  await expect(page.getByText("Your role can read this overview", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /View records/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Company reviews", exact: true })).toHaveCount(0);
  const logged = await (await request.get(mock + "/__e2e/requests")).json();
  expect(logged.items.filter((item: { path: string }) => ["/api/v1/admin/company-verifications","/api/v1/admin/users","/api/v1/admin/jobs"].includes(item.path))).toEqual([]);
});

test("unavailable snapshot is distinct from a healthy empty database", async ({ page, request }) => {
  await login(page);
  await request.post(mock + "/__e2e/admin-security", { data: { dashboardFail: true } });
  await page.reload();
  await expect(page.getByRole("alert", { name: "Dashboard data unavailable" })).toContainText("Dashboard data unavailable");
  await expect(page.getByRole("heading", { name: "Current platform totals" })).toHaveCount(0);
  await request.post(mock + "/__e2e/admin-security", { data: { dashboardFail: false, dashboardEmpty: true } });
  await page.reload();
  await expect(page.getByRole("alert", { name: "Dashboard data unavailable" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Registered users: 0. View records" })).toBeVisible();
});

test("responsive dashboard, keyboard controls and truthful coverage", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Database counts are not a production health verdict.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monitoring coverage" })).toBeVisible();
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await expect(page.getByRole("heading", { name: "Platform command centre" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByLabel("Period", { exact: true }).focus();
    await expect(page.getByLabel("Period", { exact: true })).toBeFocused();
    await page.screenshot({ path: "../output/admin-dashboard-" + width + ".png", fullPage: true });
  }
});
