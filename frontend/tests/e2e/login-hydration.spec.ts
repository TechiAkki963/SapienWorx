import { expect, test } from "@playwright/test";
import { resetE2E } from "./helpers";

test.beforeEach(async ({ request }) => resetE2E(request));

for (const role of ["candidate", "recruiter", "master_admin"] as const) {
  test(`${role}: sign-in waits for hydration and preserves autofilled credentials`, async ({ page }) => {
    let releaseScripts!: () => void;
    const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve; });
    await page.route("**/_next/static/**", async route => {
      if (route.request().resourceType() === "script") await scriptsReady;
      await route.continue();
    });
    const path = role === "candidate" ? "/login" : role === "recruiter" ? "/recruiter/login" : "/swx-command-centre";
    const button = page.getByRole("button", { name: role === "master_admin" ? "Enter command centre" : "Sign in", exact: true });
    let nativePosts = 0;
    page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === path) nativePosts++; });
    try {
      await page.goto(path, { waitUntil: "commit" });
      await expect(button).toBeVisible();
      await expect(button).toBeDisabled();
      await page.getByLabel(role === "recruiter" ? "Work email" : "Email", { exact: true }).fill(`${role}@example.invalid`);
      await page.getByLabel("Password", { exact: true }).fill("E2e-password-123!");
      await page.getByLabel("Password", { exact: true }).press("Enter");
      expect(nativePosts).toBe(0);
    } finally {
      releaseScripts();
    }
    await expect(button).toBeEnabled();
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("E2e-password-123!");
    const authenticated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/auth/login" && response.request().method() === "POST");
    await button.click();
    expect((await authenticated).status()).toBe(200);
    await expect(page).toHaveURL(role === "candidate" ? /\/candidate(?:$|\?)/ : role === "recruiter" ? /\/recruiter(?:$|\?)/ : /\/swx-command-centre\/overview$/);
    expect(nativePosts).toBe(0);
  });
}
