import { expect, test } from "@playwright/test";
import { login, resetE2E } from "./helpers";

test("recruiter stage controls and menu statuses meet normal-text contrast in System Light and Dark", async ({ page, request }) => {
  await resetE2E(request);
  await login(page, "recruiter");
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto("/recruiter/pipeline");
      await page.getByTitle("Appearance", { exact: true }).click();
      await page.getByTitle("System mode", { exact: true }).click();
      if (colorScheme === "dark") await expect(page.locator("html")).toHaveClass(/swx-dark/);
      else await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
      const trigger = page.getByRole("button", { name: /^Stage for / }).first();
      await trigger.click();
      const ratios = await page.locator('main summary[aria-label^="Stage for"], main details[open] button > span[class*="border"]').evaluateAll(nodes => {
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d")!;
        // Canvas resolves modern CSS Lab colours to sRGB before WCAG luminance calculation.
        const luminance = (colour: string) => {
          context.clearRect(0, 0, 1, 1); context.fillStyle = colour; context.fillRect(0, 0, 1, 1);
          const [r, g, b] = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
            const channel = value / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        return nodes.filter(node => node.getClientRects().length > 0).map(node => {
          const style = getComputedStyle(node), foreground = luminance(style.color), background = luminance(style.backgroundColor);
          return { label: node.textContent?.trim(), ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) };
        });
      });
      expect(ratios.length).toBeGreaterThan(10);
      for (const item of ratios) expect(item.ratio, `${width}px ${colorScheme} ${item.label}`).toBeGreaterThanOrEqual(4.5);
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    }
  }
});
