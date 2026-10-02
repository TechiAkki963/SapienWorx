import { expect, test, type Page, type APIRequestContext } from "@playwright/test";

const mock = "http://127.0.0.1:18090";
const password = "E2e-password-123!";
async function configure(request: APIRequestContext, settings: Record<string, unknown>) {
  const response = await request.post(mock + "/__e2e/admin-security", { data: settings });
  expect(response.ok()).toBe(true);
}
async function login(page: Page) {
  await page.goto("/swx-command-centre");
  await page.getByLabel("Email", { exact: true }).fill("master_admin@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Enter command centre", exact: true }).click();
}
async function confirm(page: Page) {
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page.getByLabel("Authenticator code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Confirm access", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Authenticator confirmed" })).toBeVisible();
  await page.getByRole("link", { name: "Continue to command centre" }).click();
}
test.beforeEach(async ({ request }) => { await request.post(mock + "/__e2e/reset"); });
test.afterEach(async ({ request }) => { await request.post(mock + "/__e2e/reset"); });

test("unassigned administrator cannot fetch operational data or enroll", async ({ page, request }) => {
  await configure(request, { enabled: true, assigned: false });
  await login(page);
  await expect(page).toHaveURL(/\/swx-command-centre\/security$/);
  await expect(page.getByRole("heading", { name: "Role approval required" })).toBeVisible();
  await expect(page.getByLabel("Current password")).toHaveCount(0);
  for (const route of ["overview", "users", "tenants", "jobs", "audit", "privacy", "system", "access"]) {
    await page.goto("/swx-command-centre/" + route);
    await expect(page).toHaveURL(/\/swx-command-centre\/security$/);
  }
  const logged = await (await request.get(mock + "/__e2e/requests")).json();
  expect(logged.items.filter((item: { path: string }) => item.path.startsWith("/api/v1/admin/") && item.path !== "/api/v1/admin/access")).toEqual([]);
});

test("enrollment, invalid code, confirmation and role-filtered controls", async ({ page, request }) => {
  await configure(request, { enabled: true, admin_role: "support_admin" });
  await login(page);
  await expect(page.getByRole("heading", { name: "Set up your authenticator" })).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Start authenticator setup" }).click();
  await expect(page.getByLabel("Authenticator setup key")).toBeVisible();
  await expect(page.getByLabel("Current password", { exact: true })).toHaveValue("");
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page.getByLabel("Authenticator code", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "Confirm access", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Authenticator verification error" })).toContainText("invalid, expired or already used");
  await expect(page.getByLabel("Current password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Authenticator code", { exact: true })).toHaveValue("");
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "../output/admin-security-setup-" + width + ".png", fullPage: true });
  }
  await confirm(page);
  await expect(page).toHaveURL(/\/swx-command-centre\/access$/);
  await expect(page.getByRole("note")).toContainText("Support Admin");
  await expect(page.locator('a[href="/swx-command-centre/users"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "Audit logs", exact: true })).toHaveCount(0);
  await page.goto("/swx-command-centre/users");
  await expect(page.getByRole("heading", { name: "Account governance" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Suspend", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Force reset", exact: true })).toHaveCount(0);
  await page.goto("/swx-command-centre/tenants");
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "View document", exact: true })).toHaveCount(0);
  await page.goto("/swx-command-centre/jobs");
  await expect(page.getByRole("button", { name: "Takedown", exact: true })).toHaveCount(0);
  await page.goto("/swx-command-centre/system");
  await expect(page).toHaveURL(/\/swx-command-centre\/access$/);
  const logged = await (await request.get(mock + "/__e2e/requests")).json();
  for (const item of logged.items) {
    if (item.body.password) expect(item.body.password).toBe("[redacted]");
    if (item.body.code) expect(item.body.code).toBe("[redacted]");
  }
});

test("auditor overview does not fetch the private company queue", async ({ page, request }) => {
  await configure(request, { enabled: true, admin_role: "auditor", mfa_enrolled: true, mfa_verified: true });
  await login(page);
  await expect(page).toHaveURL(/\/swx-command-centre\/overview$/);
  await expect(page.getByRole("heading", { name: "Platform command centre" })).toBeVisible();
  await expect(page.getByText("Verification queue", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Inspect system health →" })).toHaveCount(0);
  const logged = await (await request.get(mock + "/__e2e/requests")).json();
  expect(logged.items.some((item: { path: string }) => item.path === "/api/v1/admin/company-verifications")).toBe(false);
  await page.goto("/swx-command-centre/users");
  await expect(page).toHaveURL(/\/swx-command-centre\/access$/);
});

test("finance role reads thresholds but cannot edit them", async ({ page, request }) => {
  await configure(request, { enabled: true, admin_role: "finance_admin", mfa_enrolled: true, mfa_verified: true });
  await login(page);
  await expect(page).toHaveURL(/\/swx-command-centre\/access$/);
  await page.getByRole("link", { name: "System health", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Platform health & budget" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save guardrails" })).toHaveCount(0);
});

test("expired MFA returns to confirmation before any data request", async ({ page, request }) => {
  await configure(request, { enabled: true, admin_role: "super_admin", mfa_enrolled: true, mfa_verified: false });
  await login(page);
  await expect(page).toHaveURL(/\/swx-command-centre\/security$/);
  await expect(page.getByRole("heading", { name: "Confirm your authenticator" })).toBeVisible();
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "../output/admin-security-confirmation-" + width + ".png", fullPage: true });
  }
  await expect(page.getByRole("button", { name: "Start authenticator setup" })).toHaveCount(0);
  await confirm(page);
  await page.locator('a[href="/swx-command-centre/users"]').click();
  await expect(page.getByRole("button", { name: "Suspend", exact: true })).toBeVisible();
  await configure(request, { mfa_verified: false });
  await page.reload();
  await expect(page).toHaveURL(/\/swx-command-centre\/security$/);
});

test("security service failure stays closed with a usable sign-out", async ({ page, request }) => {
  await login(page);
  await expect(page).toHaveURL(/\/swx-command-centre\/overview$/);
  await configure(request, { enabled: true, fail: true });
  await page.goto("/swx-command-centre/users");
  await expect(page).toHaveURL(/\/swx-command-centre\/security$/);
  await expect(page.getByRole("alert", { name: "Administrator session unavailable" })).toContainText("Session could not be verified");
  await expect(page.getByLabel("Current password")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});
