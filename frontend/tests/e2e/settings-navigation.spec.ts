import { expect, test, type Locator } from "@playwright/test";
import { login, MOCK_API, resetE2E } from "./helpers";

test.beforeEach(async ({ request }) => resetE2E(request));

async function expectSettingsControl(control: Locator) {
  await expect(control).toBeVisible();
  const box = (await control.boundingBox())!;
  expect(box.width).toBe(40);
  expect(box.height).toBe(40);
  const icon = control.locator('svg[data-icon="settings"]');
  expect((await icon.boundingBox())!.width).toBe(22);
  await expect(icon).toHaveAttribute("fill", "none");
  await expect(icon).toHaveAttribute("stroke", "currentColor");
  await expect(icon).toHaveAttribute("stroke-width", "1.8");
  await expect(icon).toHaveAttribute("aria-hidden", "true");
}

test("recruiter gear has transparent, hover, active, dark and keyboard states", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await login(page, "recruiter");
  const gear = page.getByRole("banner").getByRole("link", { name: "Settings", exact: true });
  await expectSettingsControl(gear);
  await expect(gear).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(gear).toHaveCSS("color", "rgb(15, 23, 42)");
  await expect(gear).not.toHaveAttribute("aria-current");
  await gear.hover();
  await expect(gear).toHaveCSS("background-color", "rgb(219, 234, 254)");
  await gear.focus();
  await gear.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(gear).toBeFocused();
  await expect(gear).toHaveCSS("outline-style", "solid");
  await gear.press("Enter");
  await expect(page).toHaveURL(/\/recruiter\/settings$/);
  await expect(gear).toHaveAttribute("aria-current", "page");
  await expect(gear).toHaveCSS("color", "rgb(37, 99, 235)");
  await page.getByRole("region", { name: "Preferences", exact: true }).getByTitle("Dark mode").click();
  await expect(gear).toHaveCSS("color", "rgb(37, 99, 235)");
  await gear.hover();
  await expect(gear).toHaveCSS("background-color", "rgb(16, 31, 55)");
  const contrast = await gear.evaluate(node => {
    const style = getComputedStyle(node);
    const luminance = (color: string) => color.match(/\d+/g)!.slice(0, 3).map(Number).map(value => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const fg = luminance(style.color), bg = luminance(style.backgroundColor);
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(3);
  await page.goto("/recruiter/jobs");
  await expect(gear).toHaveCSS("color", "rgb(239, 246, 255)");
  await gear.hover();
  await expect(gear).toHaveCSS("background-color", "rgb(30, 58, 95)");
});

test("candidate gear opens Settings separately from the account menu without mobile collisions", async ({ page }) => {
  await login(page, "candidate");
  const header = page.getByRole("banner");
  const gear = header.getByRole("button", { name: "Settings", exact: true }).and(page.locator(".swx-settings-link"));
  for (const width of [1440, 768, 428, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await expectSettingsControl(gear);
    const brand = header.getByRole("link", { name: "SapienWorx Candidate home", exact: true });
    const actions = (await page.locator(".candidate-topbar-actions").boundingBox())!;
    if (width < 768) {
      await expect(brand).toBeVisible();
      const box = (await brand.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(actions.x);
    } else await expect(brand).toBeHidden();
    const search = (await page.locator(".candidate-global-search").boundingBox())!;
    expect(search.x + search.width).toBeLessThanOrEqual(actions.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.getByRole("button", { name: "Candidate account", exact: true }).click();
  const account = page.getByRole("dialog", { name: "Your account", exact: true });
  await expect(account.getByRole("link", { name: "Settings", exact: true })).toHaveCount(0);
  await expect(account.getByRole("link", { name: "View profile", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Candidate account", exact: true })).toBeFocused();
  await expect(account).toHaveCount(0);
  await gear.press("Enter");
  const choices = page.getByRole("navigation", { name: "Settings choices", exact: true });
  await expect(choices.getByRole("link")).toHaveCount(6);
  await choices.getByRole("link", { name: "Notification preferences", exact: true }).click();
  await expect(page).toHaveURL(/\/candidate\/settings#notifications$/);
  await expect(choices).toHaveCount(0);
  await expect(gear).toHaveAttribute("aria-current", "page");
});

test("company gear opens existing profile/settings and stays hidden from collaborators", async ({ page, request }) => {
  await login(page, "recruiter");
  await request.post(`${MOCK_API}/__e2e/company`, { data: {} });
  await page.goto("/company/team");
  const gear = page.getByRole("banner").getByRole("link", { name: "Company settings", exact: true });
  await expectSettingsControl(gear);
  await expect(gear).toHaveAttribute("href", "/company");
  await page.setViewportSize({ width: 360, height: 800 });
  expect((await page.getByRole("banner").boundingBox())!.height).toBe(65);
  const brand = (await page.getByRole("link", { name: "Company workspace", exact: true }).boundingBox())!;
  expect(brand.x + brand.width).toBeLessThan((await gear.boundingBox())!.x);
  await expect(gear).not.toHaveAttribute("aria-current");
  await gear.focus();
  await gear.press("Enter");
  await expect(page).toHaveURL(/\/company$/);
  await expect(gear).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Welcome to your company workspace", exact: true })).toBeVisible();
  await request.post(`${MOCK_API}/__e2e/company`, { data: { member: {
    company_id: "40000000-0000-4000-8000-000000000001", user_id: "20000000-0000-4000-8000-000000000001",
    name: "Synthetic Collaborator", role: "collaborator", status: "active", scope: { all: false }, talent_seat: false,
  } } });
  await page.reload();
  await expect(gear).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your assigned hiring work", exact: true })).toBeVisible();
});

test("Command Centre gear shares its navigation silhouette and preserves permission gating", async ({ page, request }) => {
  await request.post(`${MOCK_API}/__e2e/admin-security`, { data: { enabled: true, assigned: true, admin_role: "super_admin", mfa_enrolled: true, mfa_verified: true } });
  await login(page, "master_admin");
  const gear = page.getByRole("banner").getByRole("link", { name: "Command Centre settings", exact: true });
  await expectSettingsControl(gear);
  const navSettings = page.getByRole("navigation", { name: "Master Admin navigation", exact: true }).getByRole("link", { name: "Content, settings & costs", exact: true });
  expect(await navSettings.locator("svg path").getAttribute("d")).toBe(await gear.locator("svg path").getAttribute("d"));
  await gear.focus();
  await gear.press("Enter");
  await expect(page.getByRole("heading", { name: "Content, settings & cloud costs", exact: true })).toBeVisible();
  await expect(gear).toHaveAttribute("aria-current", "page");
  await request.post(`${MOCK_API}/__e2e/admin-security`, { data: { admin_role: "support_admin" } });
  await page.goto("/swx-command-centre/overview");
  await expect(gear).toHaveCount(0);
  await expect(page.locator('a[href="/swx-command-centre/content-settings"]')).toHaveCount(0);
  await page.goto("/swx-command-centre/content-settings");
  await expect(page).toHaveURL(/\/swx-command-centre\/access$/);
  await expect(page.getByRole("heading", { name: "Content, settings & cloud costs", exact: true })).toHaveCount(0);
});
