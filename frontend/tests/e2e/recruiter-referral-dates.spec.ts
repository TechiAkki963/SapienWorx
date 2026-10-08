import { expect, test } from "@playwright/test";
import { login, MOCK_API, resetE2E } from "./helpers";

for (const zone of ["Asia/Kolkata", "America/New_York"]) {
  test.describe(`Referral dates in ${zone}`, () => {
    test.use({ timezoneId: zone });
    test("populated tracker and activity use a consistent business date without hydration errors", async ({ page, request }) => {
      await resetE2E(request);
      const fixture = await request.post(`${MOCK_API}/__e2e/recruiter-referral-invitations`, { data: { items: [{
        id: "83000000-0000-4000-8000-000000000099", candidate_name: "Boundary invitee",
        job_title: "Synthetic boundary role", referrer_name: "Synthetic referrer", source: "candidate",
        status: "invitation_queued", reward_status: "not_eligible", can_view_candidate: false,
        created_at: "2026-10-07T22:30:00Z", updated_at: "2026-10-07T22:30:00Z", expires_at: "2026-10-14T22:30:00Z",
      }] } });
      expect(fixture.ok()).toBeTruthy();
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error" && /hydration|hydrated|server rendered|React error #418/i.test(message.text())) errors.push(message.text()); });
      await login(page, "recruiter");
      for (const width of [1440, 360]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/recruiter/referrals");
        await expect(page.locator("main")).toContainText("Submitted 08 Oct 2026");
        await expect(page.locator("main")).toContainText("Expires 15 Oct 2026");
        await page.getByRole("button", { name: "View invitation", exact: true }).click();
        const activity = page.getByRole("dialog", { name: "Referral invitation activity", exact: true });
        await expect(activity).toContainText("Submitted 08 Oct 2026 · Expires 15 Oct 2026");
        await page.keyboard.press("Escape");
        await expect(activity).not.toBeVisible();
        expect(errors).toEqual([]);
      }
    });
  });
}
