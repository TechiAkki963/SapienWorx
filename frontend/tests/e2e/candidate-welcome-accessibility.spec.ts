import { expect, test } from "@playwright/test";
import { login, MOCK_API, resetE2E } from "./helpers";

test.beforeEach(async ({ request }) => resetE2E(request));

for (const mode of ["Light", "Dark"] as const) {
  test(`first-login welcome preserves readable text and keyboard navigation in ${mode}`, async ({ page, request }) => {
    await login(page, "candidate");
    await page.getByTitle("Appearance").click();
    await page.getByTitle(`${mode} mode`).click();
    await request.post(`${MOCK_API}/__e2e/onboarding`, { data: { status: "not_started" } });
    await page.goto("/candidate");
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole("navigation", { name: "Candidate workspace" })).toHaveCount(0);
    const card = page.locator("main > div");
    await expect(page.locator("main h1")).toBeVisible();
    for (const text of [page.locator(".swx-wordmark-label"), page.getByRole("button", { name: "Sign out" }), page.getByText("Your next career opportunity starts with your professional profile.")]) {
      const background = await card.evaluate(element => getComputedStyle(element).backgroundColor);
      const contrast = await text.evaluate((element, fallback) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d")!;
        const rgb = (value: string) => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = fallback;
          context.fillRect(0, 0, 1, 1);
          context.fillStyle = value;
          context.fillRect(0, 0, 1, 1);
          return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
        };
        const luminance = (value: string) => rgb(value).map(channel => {
          const c = channel / 255;
          return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
        }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
        const style = getComputedStyle(element);
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor === "rgba(0, 0, 0, 0)" ? fallback : style.backgroundColor);
        return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
      }, background);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Continue with CV" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Create My Profile" })).toBeFocused();
    await page.screenshot({ path: `test-results/candidate-welcome-${mode.toLowerCase()}.png`, fullPage: true });
  });
}
