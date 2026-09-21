import { expect, test } from "@playwright/test";

import { resetE2E } from "./helpers";

test.describe("email verification", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("verifies the registration email challenge without a mobile step", async ({ page }) => {
    await page.goto("/verify-email?email=aarav%40example.com&role=candidate");
    await expect(page.getByText("Email verification · Required")).toBeVisible();
    await page.getByLabel("Email verification code").fill("123456");
    await expect(page.getByLabel("Email verification code")).toHaveValue("123456");

    const verification = page.waitForRequest((request) => request.url().endsWith("/api/v1/auth/email/verify") && request.method() === "POST");
    await page.getByRole("button", { name: "Verify email" }).click();
    expect((await verification).postDataJSON()).toEqual({ email: "aarav@example.com", code: "123456" });
    await expect(page).toHaveURL(/\/login\?verified=1/);
  });
});
