import { expect, test } from "@playwright/test";
import { login, MOCK_API, resetE2E } from "./helpers";

test.beforeEach(async ({ request }) => resetE2E(request));

for (const mode of ["system", "light", "dark"] as const) {
  test(`welcome ${mode} preference handles live OS appearance changes`, async ({ page, request }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.addInitScript(value => localStorage.setItem("swx-theme", value), mode);
    await page.emulateMedia({ colorScheme: "light" });
    await login(page, "candidate");
    await request.post(`${MOCK_API}/__e2e/onboarding`, { data: { status: "not_started" } });
    await page.goto("/candidate");
    await expect(page).toHaveURL(/\/welcome$/);
    const welcomeURL = page.url();
    // A marker proves all subsequent OS changes happen in the same document.
    const documentID = await page.evaluate(() => {
      document.documentElement.dataset.testDocument = crypto.randomUUID();
      return document.documentElement.dataset.testDocument;
    });
    for (const scheme of ["light", "dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
      if (mode === "dark" || (mode === "system" && scheme === "dark")) {
        await expect(page.locator("html")).toHaveClass(/swx-dark/);
      } else {
        await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
      }
      expect(page.url()).toBe(welcomeURL);
      await expect(page.locator("html")).toHaveAttribute("data-test-document", documentID);
    }
    expect(errors).toEqual([]);
  });
}

test("switching explicit appearance back to System uses current OS preference immediately", async ({ page }) => {
  await login(page, "candidate");
  for (const [explicit, scheme] of [["Light", "dark"], ["Dark", "light"]] as const) {
    await page.getByTitle("Appearance").click();
    await page.getByTitle(`${explicit} mode`).click();
    await page.emulateMedia({ colorScheme: scheme });
    await page.getByTitle("Appearance").click();
    await page.getByTitle("System mode").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
    if (scheme === "dark") await expect(page.locator("html")).toHaveClass(/swx-dark/);
    else await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
  }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 360, height: 800 }, { width: 428, height: 926 }, { width: 768, height: 1024 }]) {
  for (const appearance of [{ mode: "system", scheme: "light" }, { mode: "system", scheme: "dark" }, { mode: "light", scheme: "dark" }, { mode: "dark", scheme: "light" }] as const) {
    test(`welcome ${viewport.width}x${viewport.height} ${appearance.mode} OS ${appearance.scheme}`, async ({ page, request }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(value => localStorage.setItem("swx-theme", value), appearance.mode);
      await page.emulateMedia({ colorScheme: appearance.scheme });
      await login(page, "candidate");
      await request.post(`${MOCK_API}/__e2e/onboarding`, { data: { status: "not_started" } });
      await page.goto("/candidate");
      await expect(page).toHaveURL(/\/welcome$/);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      const dark = appearance.mode === "dark" || (appearance.mode === "system" && appearance.scheme === "dark");
      expect(await page.evaluate(() => document.documentElement.classList.contains("swx-dark"))).toBe(dark);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      // Sample successive rendered frames after hydration for an incorrect appearance.
      const frames = await page.evaluate(async () => {
        const values: boolean[] = [];
        for (let i = 0; i < 8; i++) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          values.push(document.documentElement.classList.contains("swx-dark"));
        }
        return values;
      });
      expect(frames.every(value => value === dark)).toBe(true);
      await page.screenshot({ path: `visual-artifacts/theme-runtime/welcome-${viewport.width}-${appearance.mode}-${appearance.scheme}.png`, fullPage: true });
    });
  }
}
