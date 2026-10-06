import { expect, test } from "@playwright/test";
import { login, MOCK_API, resetE2E } from "./helpers";

test.use({ viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ request }) => resetE2E(request));

test("profile uploads have one visible keyboard control per file picker", async ({
  page,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/profile");
  const photo = page.getByRole("button", {
    name: "Upload photo",
    exact: true,
  });
  await photo.focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Edit basic details", exact: true }),
  ).toBeFocused();
  for (const input of await page.locator('input[type="file"].sr-only').all()) {
    await expect(input).toHaveAttribute("tabindex", "-1");
    await expect(input).toHaveAttribute("aria-hidden", "true");
  }
  const picker = page.waitForEvent("filechooser");
  await photo.press("Enter");
  expect((await picker).isMultiple()).toBe(false);
});

for (const mode of ["Light", "Dark"] as const) {
  test(`first-login welcome preserves readable text and keyboard navigation in ${mode}`, async ({
    page,
    request,
  }) => {
    await login(page, "candidate");
    await page.getByTitle("Appearance").click();
    await page.getByTitle(`${mode} mode`).click();
    await request.post(`${MOCK_API}/__e2e/onboarding`, {
      data: { status: "not_started" },
    });
    await page.goto("/candidate");
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(
      page.getByRole("navigation", { name: "Candidate workspace" }),
    ).toHaveCount(0);
    const card = page.locator("main > div");
    await expect(page.locator("main h1")).toBeVisible();
    for (const text of [
      page.locator(".swx-wordmark-label"),
      page.getByRole("button", { name: "Sign out" }),
      page.getByText(
        "Your next career opportunity starts with your professional profile.",
      ),
    ]) {
      const background = await card.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
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
        const luminance = (value: string) =>
          rgb(value)
            .map((channel) => {
              const c = channel / 255;
              return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            })
            .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
        const style = getComputedStyle(element);
        const foreground = luminance(style.color);
        const background = luminance(
          style.backgroundColor === "rgba(0, 0, 0, 0)"
            ? fallback
            : style.backgroundColor,
        );
        return (
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05)
        );
      }, background);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    if (await page.getByRole("button", { name: "Continue with CV" }).count()) {
      await expect(
        page.getByRole("button", { name: "Continue with CV" }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
    } else {
      await expect(
        page.getByRole("button", { name: "CV setup unavailable" }),
      ).toBeDisabled();
      await expect(page.getByRole("note")).toContainText("safe processing");
    }
    await expect(
      page.getByRole("button", { name: "Create My Profile" }),
    ).toBeFocused();
    await page.screenshot({
      path: `test-results/candidate-welcome-${mode.toLowerCase()}.png`,
      fullPage: true,
    });
  });
}
