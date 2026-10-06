import { expect, test } from "@playwright/test";
import { login, resetE2E } from "./helpers";

test.beforeEach(async ({ request }) => resetE2E(request));

for (const mode of ["dark", "system"] as const) {
  test(`Command Centre ${mode} accents have readable contrast`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(value => localStorage.setItem("swx-theme", value), mode);
    await login(page, "master_admin");
    const measured = await page.locator('.admin-workspace').evaluate(root => {
      const luminance = (color: string) => {
        const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
          value /= 255;
          return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
        });
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      return Array.from(root.querySelectorAll<HTMLElement>('[class~="text-[#5262c9]"], [class~="text-[#3147c8]"], .text-indigo-600, [class*="bg-amber-50"][class*="text-amber-"]'))
        .filter(element => element.getBoundingClientRect().width > 0)
        .map(element => {
          let parent: HTMLElement | null = element;
          let background = "";
          while (parent) {
            background = getComputedStyle(parent).backgroundColor;
            if (background !== "rgba(0, 0, 0, 0)") break;
            parent = parent.parentElement;
          }
          const fg = luminance(getComputedStyle(element).color), bg = luminance(background);
          return { text: element.textContent, ratio: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) };
        });
    });
    expect(measured.length).toBeGreaterThan(3);
    for (const item of measured) expect(item.ratio, item.text || "Accent").toBeGreaterThanOrEqual(4.5);
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 428, height: 926 }, { width: 360, height: 800 }]) {
      await page.setViewportSize(viewport);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
    const account = page.locator('summary[aria-label="Master Admin account menu"]');
    await account.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  });
}

test("explicit Light preserves the Command Centre brand accents", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("swx-theme", "light"));
  await login(page, "master_admin");
  await expect(page.getByText("Command Centre", { exact: true })).toHaveCSS("color", "rgb(82, 98, 201)");
});
