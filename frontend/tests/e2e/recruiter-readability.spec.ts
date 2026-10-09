import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import { login, resetE2E } from "./helpers";

test.beforeEach(async ({ request }) => resetE2E(request));

test("recruiter typography is loaded locally, consistent and responsive", async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await login(page, "recruiter");
  await fs.mkdir("visual-artifacts/recruiter-readability", { recursive: true });
  const routes = ["/recruiter", "/recruiter/jobs", "/recruiter/pipeline", "/recruiter/interviews", "/recruiter/offers", "/recruiter/messages", "/recruiter/discover", "/recruiter/analytics"];
  for (const [width, height] of [[1440,900], [1366,768], [768,1024], [360,800]]) {
    await page.setViewportSize({ width, height });
    for (const mode of ["light", "dark"] as const) {
      await page.evaluate(mode => { localStorage.setItem("swx-theme", mode); }, mode);
      for (const route of routes) {
        await page.goto(route);
        const heading = page.locator("main h1");
        await expect(heading).toBeVisible();
        await expect(heading).toHaveCSS("font-size", width < 640 ? "24px" : "28px");
        await expect(heading).toHaveCSS("font-weight", "700");
        await expect(heading).toHaveClass(/swx-type-page-title/);
        const metrics = await heading.evaluate(async node => {
          await document.fonts.ready;
          const family = getComputedStyle(node).fontFamily.split(",")[0].replaceAll('"', "").trim();
          return { family, loaded: Array.from(document.fonts).some(font => font.status === "loaded" && font.family.replaceAll('"', "") === family), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
        });
        expect(metrics.loaded, metrics.family).toBeTruthy();
        expect(metrics.overflow, `${route} at ${width}`).toBeFalsy();
        for (const label of await page.locator("main label:visible, main th:visible").all()) {
          expect(await label.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(13);
        }
        await page.screenshot({ path: `visual-artifacts/recruiter-readability/${route.split("/").at(-1) || "home"}-${width}-${mode}.png`, fullPage: true, animations: "disabled" });
      }
    }
  }
  expect(errors).toEqual([]);
});
