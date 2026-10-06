import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { login, resetE2E, recordedRequests, MOCK_API } from "./helpers";
import { profileV2Fixture } from "./profile-v2-fixture";
import { readFileSync } from "node:fs";
import { safeNotificationDestination } from "../../components/candidate/candidate-topbar";

async function fixture(
  request: APIRequestContext,
  data: Record<string, unknown>,
) {
  expect(
    (await request.post(`${MOCK_API}/__e2e/workspace`, { data })).ok(),
  ).toBeTruthy();
}
test.beforeEach(async ({ request }) => {
  await resetE2E(request);
  await request.post(`${MOCK_API}/__e2e/profile-fixture`, {
    data: {
      ...profileV2Fixture,
      details: {
        ...profileV2Fixture.details,
        key_skills: ["Go", "PostgreSQL", "TypeScript"],
      },
    },
  });
});
async function fit(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
}

for (const mode of ["Light", "Dark"] as const) {
  test(`workspace text actions meet normal-text contrast in ${mode}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await login(page, "candidate");
    await page.getByTitle("Appearance").click();
    await page.getByTitle(`${mode} mode`).click();
    await page.goto("/candidate/profile");
    await page.getByRole("button", { name: /^Notifications,/ }).click();
    for (const selector of [
      ".candidate-photo-actions button",
      ".candidate-notification-toolbar button",
      ".candidate-view-notifications",
      ".candidate-mobile-nav a[aria-current]",
    ]) {
      const ratio = await page
        .locator(selector)
        .first()
        .evaluate((element) => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const context = canvas.getContext("2d")!;
          const chain: Element[] = [];
          for (
            let current: Element | null = element;
            current;
            current = current.parentElement
          )
            chain.unshift(current);
          context.fillStyle = "#fff";
          context.fillRect(0, 0, 1, 1);
          for (const ancestor of chain) {
            context.fillStyle = getComputedStyle(ancestor).backgroundColor;
            context.fillRect(0, 0, 1, 1);
          }
          const background = Array.from(
            context.getImageData(0, 0, 1, 1).data,
          ).slice(0, 3);
          context.fillStyle = getComputedStyle(element).color;
          context.fillRect(0, 0, 1, 1);
          const foreground = Array.from(
            context.getImageData(0, 0, 1, 1).data,
          ).slice(0, 3);
          const luminance = (rgb: number[]) =>
            rgb
              .map((channel) => {
                const value = channel / 255;
                return value <= 0.04045
                  ? value / 12.92
                  : ((value + 0.055) / 1.055) ** 2.4;
              })
              .reduce(
                (sum, value, index) =>
                  sum + value * [0.2126, 0.7152, 0.0722][index],
                0,
              );
          const a = luminance(background),
            b = luminance(foreground);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
      expect(ratio, `${mode} ${selector}`).toBeGreaterThanOrEqual(4.5);
    }
  });
}
test("Overview uses actual aggregate metrics and exposes retryable unavailability instead of false zero", async ({
  page,
  request,
}) => {
  await fixture(request, {
    metrics: {
      profile_views: 17,
      search_appearances: 86,
      recruiter_actions: 4,
      period_days: 30,
    },
  });
  await login(page, "candidate");
  const performance = page.getByRole("region", { name: "Profile performance" });
  await expect(
    performance.locator("article").filter({ hasText: "Profile views" }),
  ).toContainText("17");
  await expect(
    performance.locator("article").filter({ hasText: "Search appearances" }),
  ).toContainText("86");
  await expect(
    performance.locator("article").filter({ hasText: "Recruiter actions" }),
  ).toContainText("4");
  await page.getByLabel("About Recruiter actions").click();
  await expect(performance).toContainText("Passive views are excluded");
  await fixture(request, { fail: { metrics_get: true } });
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: "metrics could not be loaded" }),
  ).toBeVisible();
  await expect(
    performance.getByText("Unavailable", { exact: true }),
  ).toHaveCount(3);
  await fixture(request, { fail: { metrics_get: false } });
  await page.getByRole("button", { name: /Try again/ }).click();
  await expect(
    performance.getByText("Unavailable", { exact: true }),
  ).toHaveCount(0);
});
test("expired access renews securely for applications and interviews; server outage keeps an honest retry", async ({
  page,
  request,
}) => {
  await login(page, "candidate");
  for (const route of ["applications", "interviews"]) {
    await fixture(request, { expire_access: true });
    await page.goto(`/candidate/${route}`);
    await expect(page.locator("main h1")).toHaveText(
      route === "applications" ? "Your applications" : "Your interviews",
    );
    await expect.poll(() => page.url()).not.toContain("_swxrenew");
  }
  expect(
    (await recordedRequests(request)).filter(
      (row) => row.path === "/api/v1/auth/refresh" && row.method === "POST",
    ).length,
  ).toBeGreaterThanOrEqual(2);
  await fixture(request, { fail: { session_get: true } });
  await page.goto("/candidate/applications");
  await expect(
    page.getByRole("heading", { name: "We couldn’t check your session." }),
  ).toBeVisible();
  expect(page.url()).toContain("/candidate/applications");
  await fixture(request, { fail: { session_get: false } });
  await page.getByRole("button", { name: /Try again/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your applications" }),
  ).toBeVisible();
});
test("session renewal and notification destinations reject external and invalid paths", async ({
  page,
}) => {
  expect(
    safeNotificationDestination(
      "/candidate/inbox?conversation_id=00000000-0000-4000-8000-000000000001",
    ),
  ).toContain("conversation_id=");
  for (const value of [
    "//evil.test",
    "https://evil.test",
    "/candidate/../../recruiter",
    "/candidate\\evil",
    "javascript:alert(1)",
  ])
    expect(safeNotificationDestination(value)).toBe("/candidate/notifications");
  await login(page, "candidate");
  await page.goto(
    "/session/renew?returnTo=" + encodeURIComponent("https://evil.test"),
  );
  await expect(page.locator("main h1")).toHaveText("Your overview");
  await expect.poll(() => page.url()).toMatch(/\/candidate$/);
});
test("new profile fields retain scoped data and compensation units preserve annual value", async ({
  page,
  request,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/profile");
  await page
    .getByRole("button", { name: "Edit career profile", exact: true })
    .click();
  await page
    .getByLabel("Preferred work mode", { exact: true })
    .selectOption("Hybrid");
  await page
    .getByLabel("Current salary unit", { exact: true })
    .selectOption("Monthly");
  await expect(page.getByLabel("Current salary", { exact: true })).toHaveValue(
    "150000",
  );
  await page
    .getByLabel("Expected salary unit", { exact: true })
    .selectOption("Monthly");
  await page.getByLabel("Expected salary", { exact: true }).fill("225000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#section-preferences")).toContainText(
    "INR 2,25,000 / month",
  );
  await page.getByRole("button", { name: "Add award", exact: true }).click();
  await page
    .getByLabel("Award title", { exact: true })
    .fill("Service excellence");
  await page
    .getByLabel("Awarding organization", { exact: true })
    .fill("Example Association");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add professional membership", exact: true })
    .click();
  await page
    .getByLabel("Membership title", { exact: true })
    .fill("Professional member");
  await page
    .getByLabel("Professional organization", { exact: true })
    .fill("Example Institute");
  await page.getByLabel("Current membership", { exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Edit employment 1: Example Labs",
      exact: true,
    })
    .click();
  await page.getByLabel("Location", { exact: true }).fill("Pune");
  await page
    .getByLabel("Achievements", { exact: true })
    .fill("Improved service reliability.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = await (await request.get(`${MOCK_API}/__e2e/state`)).json();
  expect(saved.profileDetails.current_salary_amount).toBe(1800000);
  expect(saved.profileDetails.expected_salary_amount).toBe(2700000);
  expect(saved.profileDetails.details.current_salary_unit).toBe("Monthly");
  expect(saved.profileDetails.details.preferred_work_mode).toBe("Hybrid");
  expect(saved.profileDetails.details.professional_memberships[0].current).toBe(
    "Yes",
  );
  expect(saved.profileDetails.details.employment[0]).toMatchObject({
    location: "Pune",
    achievements: "Improved service reliability.",
  });
  expect(saved.profileDetails.details.education).toEqual(
    profileV2Fixture.details.education,
  );
  expect(saved.profileDetails.details.legacy_extension).toEqual({
    retain: "unchanged",
  });
  await page.reload();
  await expect(page.locator("#section-accomplishments")).toContainText(
    "Professional member",
  );
  await page
    .getByRole("button", { name: "Preview profile", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toContainText("2,25,000");
});
test("System follows live OS appearance while explicit choices remain stable", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await login(page, "candidate");
  await page.goto("/candidate/profile");
  await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/swx-dark/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
  for (const mode of ["Dark", "Light"]) {
    await page.getByLabel(/Appearance:/).click();
    await page.getByRole("button", { name: mode, exact: true }).click();
    await page.emulateMedia({
      colorScheme: mode === "Dark" ? "light" : "dark",
    });
    if (mode === "Dark")
      await expect(page.locator("html")).toHaveClass(/swx-dark/);
    else await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
  }
});
test("notification page read state synchronizes badge and backend errors remain visible", async ({
  page,
  request,
}) => {
  await fixture(request, { notification_count: 3 });
  await login(page, "candidate");
  await page.goto("/candidate/notifications");
  await page
    .getByRole("button", { name: "Mark read", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Notifications, 2 unread" }),
  ).toBeVisible();
  await fixture(request, { fail: { notifications_read: true } });
  await page
    .getByRole("button", { name: "Mark all as read", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Read update failed" }),
  ).toBeVisible();
  await fixture(request, { fail: { notifications_read: false } });
  await page
    .getByRole("button", { name: "Mark all as read", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Notifications, 0 unread" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark read", exact: true }),
  ).toHaveCount(0);
});

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 428, height: 926 },
  { width: 360, height: 800 },
];
for (const viewport of viewports)
  for (const mode of ["light", "dark", "system"] as const) {
    test(`workspace profile visual ${viewport.width}x${viewport.height} ${mode}`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.setViewportSize(viewport);
      await page.addInitScript(
        (value) => localStorage.setItem("swx-theme", value),
        mode,
      );
      await page.emulateMedia({
        colorScheme: mode === "system" ? "dark" : "light",
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          /hydration|didn't match|server rendered/i.test(message.text())
        )
          errors.push(message.text());
      });
      const capture = async (name: string, fullPage = false) => {
        await fit(page);
        await page.screenshot({
          path: `visual-artifacts/candidate-workspace/${viewport.width}x${viewport.height}/${name}-${mode}.png`,
          fullPage,
        });
      };
      await login(page, "candidate");
      await capture("overview", true);
      await page.goto("/candidate/profile");
      const sidebar = page.getByRole("navigation", {
        name: "Candidate workspace",
      });
      if (viewport.width >= 768) {
        await expect(sidebar).toBeVisible();
        await expect(sidebar.getByRole("link")).toHaveCount(7);
      } else
        await expect(
          page.getByRole("navigation", { name: "Candidate mobile navigation" }),
        ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Public site", exact: true }),
      ).toHaveCount(0);
      await capture("profile", true);
      if ([1440, 428, 360].includes(viewport.width)) {
        for (const [label, name] of [
          ["Edit profile summary", "about-editor"],
          ["Edit employment 1: Example Labs", "experience-editor"],
          ["Edit skill 1: Go", "skills-editor"],
          ["Edit career profile", "preferences-editor"],
          ["Add award", "award-editor"],
          ["Add professional membership", "membership-editor"],
        ]) {
          await page.getByRole("button", { name: label, exact: true }).click();
          await expect(page.getByRole("dialog")).toBeVisible();
          expect(
            await page.evaluate(() =>
              document
                .querySelector("dialog[open]")!
                .contains(document.activeElement),
            ),
          ).toBeTruthy();
          await capture(name);
          await page
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
        }
        await page
          .getByRole("button", { name: "Profile Visibility", exact: true })
          .first()
          .click();
        await capture("visibility");
        await page.keyboard.press("Escape");
        await page
          .getByRole("button", { name: "Candidate account", exact: true })
          .click();
        await capture("account");
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: /^Notifications,/ }).click();
        await capture("notifications");
        await page.keyboard.press("Escape");
        await page
          .locator('input[type="file"][accept*="image/jpeg"]')
          .first()
          .setInputFiles({
            name: "approved-test-portrait.webp",
            mimeType: "image/webp",
            buffer: readFileSync(
              "public/images/people/candidate-dashboard.webp",
            ),
          });
        await expect(
          page.getByRole("status").filter({ hasText: /photo updated/ }),
        ).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, 0));
        await capture("photo-updated");
      }
      expect(errors).toEqual([]);
    });
  }
