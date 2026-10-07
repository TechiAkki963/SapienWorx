import { expect, test } from "@playwright/test";
import { login, resetE2E } from "./helpers";

// Server and browser must render identical timestamps even outside India.
test.use({ timezoneId: "America/Los_Angeles" });
test.beforeEach(async ({ request }) => { await resetE2E(request); });

for (const role of ["candidate", "recruiter"] as const) {
  test(`${role} timestamps hydrate across time zones`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await login(page, role);
    const routes = role === "candidate"
      ? ["/candidate/applications", "/candidate/notifications", "/candidate/inbox"]
      : ["/recruiter/talent-pool", "/recruiter/pipeline", "/recruiter/messages", "/recruiter/saved-searches", "/recruiter/offers"];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator("main")).not.toContainText("Invalid Date");
      await page.waitForLoadState("networkidle");
    }
    expect(errors.filter(error => /hydration|hydrated|Minified React error #418/i.test(error))).toEqual([]);
  });
}

test("recruiter dashboard actions remain readable in dark mode", async ({ page }) => {
  await login(page, "recruiter");
  await page.getByTitle("Appearance").click();
  await page.getByTitle("Dark mode").click();
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  const manageJobs = page.getByRole("link", { name: "All active jobs", exact: true });
  await expect(manageJobs).toBeVisible();
  const notice = page.getByText("No open application, message, offer or deadline queues need attention right now.");
  await expect(notice).toBeVisible();
  for (const target of [manageJobs, notice]) {
  const contrast = await target.evaluate(element => {
    const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminance = (value: number[]) => value.map(channel => {
      const c = channel / 255;
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    }).reduce((sum, c, index) => sum + c * [.2126, .7152, .0722][index], 0);
    const style = getComputedStyle(element);
    const foreground = luminance(rgb(style.color));
    let surface: Element | null = element;
    while (surface && getComputedStyle(surface).backgroundColor === "rgba(0, 0, 0, 0)") surface = surface.parentElement;
    const background = luminance(rgb(getComputedStyle(surface!).backgroundColor));
    return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  }
});

test("admin security notice remains readable in dark mode", async ({ page }) => {
  await login(page, "master_admin");
  await page.getByTitle("Appearance").click();
  await page.getByTitle("Dark mode").click();
  const notice = page.getByRole("note").filter({ hasText: "Legacy master-admin access" });
  await expect(notice).toHaveCSS("color", "rgb(253, 230, 138)");
  await expect(notice).toHaveCSS("background-color", "rgb(51, 39, 15)");
});
