import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type Route,
} from "@playwright/test";
import { login, MOCK_API, resetE2E, recordedRequests } from "./helpers";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const photoFile = {
  name: "synthetic-candidate.png",
  mimeType: "image/png",
  buffer: png,
};
const expectedPhoto = `data:image/png;base64,${png.toString("base64")}`;
const state = async (request: APIRequestContext) =>
  (await request.get(`${MOCK_API}/__e2e/state`)).json();
const fixture = async (
  request: APIRequestContext,
  data: Record<string, unknown>,
) => {
  const response = await request.post(`${MOCK_API}/__e2e/workspace`, { data });
  expect(response.ok()).toBeTruthy();
};
async function upload(page: Page) {
  await page
    .locator('input[type="file"][accept*="image/jpeg"]')
    .first()
    .setInputFiles(photoFile);
  await expect(
    page.getByRole("status").filter({ hasText: /photo updated/ }),
  ).toBeVisible();
}

test.beforeEach(async ({ request }) => resetE2E(request));

test("profile photo persists and synchronizes Profile, Overview and account avatar; removal persists", async ({
  page,
  request,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/profile");
  await upload(page);
  await expect(page.locator(".candidate-account-trigger img")).toHaveAttribute(
    "src",
    expectedPhoto,
  );
  await expect(page.locator("main img").first()).toHaveAttribute(
    "src",
    expectedPhoto,
  );
  expect((await state(request)).candidatePhoto).toBe(expectedPhoto);
  await page.goto("/candidate");
  await expect(page.locator(".candidate-account-trigger img")).toHaveAttribute(
    "src",
    expectedPhoto,
  );
  await expect(
    page.getByRole("region", { name: "Your profile" }).locator("img"),
  ).toHaveAttribute("src", expectedPhoto);
  await page.reload();
  await expect(page.locator(".candidate-account-trigger img")).toHaveAttribute(
    "src",
    expectedPhoto,
  );
  await page.goto("/candidate/profile");
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Profile photo removed" }),
  ).toBeVisible();
  await expect(page.locator(".candidate-account-trigger img")).toHaveCount(0);
  expect((await state(request)).candidatePhoto).toBe("");
  await page.goto("/candidate");
  await expect(page.locator(".candidate-account-trigger img")).toHaveCount(0);
  expect(
    (await recordedRequests(request))
      .filter((item) => item.path === "/api/v1/candidate/profile/photo")
      .map((item) => item.method),
  ).toEqual(["POST", "DELETE"]);
});

test("failed upload and removal preserve the last saved photo and report errors", async ({
  page,
  request,
}) => {
  await fixture(request, { photo: expectedPhoto, fail: { photo_write: true } });
  await login(page, "candidate");
  await page.goto("/candidate/profile");
  await page
    .locator('input[type="file"][accept*="image/jpeg"]')
    .first()
    .setInputFiles(photoFile);
  await expect(
    page.getByRole("alert").filter({ hasText: "Photo storage unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".candidate-account-trigger img")).toHaveAttribute(
    "src",
    expectedPhoto,
  );
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Photo storage unavailable" }),
  ).toBeVisible();
  expect((await state(request)).candidatePhoto).toBe(expectedPhoto);
});

test("photo validation rejects unsupported and oversize files before an upload request", async ({
  page,
  request,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/profile");
  const input = page
    .locator('input[type="file"][accept*="image/jpeg"]')
    .first();
  for (const file of [
    {
      name: "avatar.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    },
    {
      name: "large.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    },
  ]) {
    await input.setInputFiles(file);
    await expect(
      page.getByRole("alert").filter({ hasText: /JPEG, PNG or WebP/ }),
    ).toBeVisible();
  }
  expect(
    (await recordedRequests(request)).filter(
      (item) => item.path === "/api/v1/candidate/profile/photo",
    ),
  ).toHaveLength(0);
});

test("mobile number remains unchanged until successful OTP verification, with resend cooldown", async ({
  page,
  request,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/settings");
  await page.getByRole("button", { name: "Change mobile number" }).click();
  const dialog = page.getByRole("dialog", { name: "Change mobile number" });
  await dialog
    .getByLabel("New mobile number (country code required)")
    .fill("+91 91111 10002");
  await dialog.getByRole("button", { name: "Send OTP", exact: true }).click();
  await expect(dialog.getByLabel("Verification code")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /^Resend in \d+s$/ }),
  ).toBeDisabled();
  expect((await state(request)).profile.phone).toBe("+919876543210");
  await dialog.getByLabel("Verification code").fill("000000");
  await dialog
    .getByRole("button", { name: "Verify and update number" })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Invalid or expired verification code",
  );
  expect((await state(request)).profile.phone).toBe("+919876543210");
  await dialog.getByLabel("Verification code").fill("123456");
  await dialog
    .getByRole("button", { name: "Verify and update number" })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Current mobile: +919111110002", { exact: true }),
  ).toBeVisible();
  expect((await state(request)).profile.phone).toBe("+919111110002");
  await page.reload();
  await expect(
    page.getByText("Current mobile: +919111110002", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /email/i })).toHaveCount(0);
});

test("unavailable mobile verification never changes the current number", async ({
  page,
  request,
}) => {
  await fixture(request, { fail: { phone_request: true } });
  await login(page, "candidate");
  await page.goto("/candidate/settings");
  await page.getByRole("button", { name: "Change mobile number" }).click();
  const dialog = page.getByRole("dialog", { name: "Change mobile number" });
  await dialog
    .getByLabel("New mobile number (country code required)")
    .fill("+919111110002");
  await dialog.getByRole("button", { name: "Send OTP", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Your existing number has not changed",
  );
  expect((await state(request)).profile.phone).toBe("+919876543210");
});

test("notification badge counts beyond visible page and mark-all reconciles with backend", async ({
  page,
  request,
}) => {
  await fixture(request, { notification_count: 105 });
  await login(page, "candidate");
  await expect(
    page.getByRole("button", { name: "Notifications, 105 unread" }),
  ).toBeVisible();
  await expect(page.locator(".candidate-notification-badge")).toHaveText("99+");
  await page.getByRole("button", { name: "Notifications, 105 unread" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Notifications",
    exact: true,
  });
  await expect(
    dialog.locator(".candidate-notification-list > button"),
  ).toHaveCount(8);
  await dialog.getByRole("button", { name: "Mark all as read" }).click();
  await expect(
    page.getByRole("button", { name: "Notifications, 0 unread" }),
  ).toBeVisible();
  await expect(page.locator(".candidate-notification-badge")).toHaveCount(0);
  expect(
    (await state(request)).candidateNotifications.filter(
      (note: { read_at?: string }) => !note.read_at,
    ),
  ).toHaveLength(0);
});

test("notification action marks read and preserves an authorized inbox UUID destination", async ({
  page,
  request,
}) => {
  const thread = "a1000000-0000-4000-8000-000000000001";
  await fixture(request, {
    notifications: [
      {
        id: "90000000-0000-4000-8000-000000000001",
        kind: "message",
        title: "Synthetic recruiter message",
        body: "Open your private inbox.",
        action_url: `/candidate/inbox?thread=${thread}`,
        created_at: new Date().toISOString(),
      },
    ],
  });
  await login(page, "candidate");
  await page.getByRole("button", { name: "Notifications, 1 unread" }).click();
  await page
    .getByRole("dialog", { name: "Notifications", exact: true })
    .getByRole("button", { name: /Synthetic recruiter message/ })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/candidate/inbox\\?thread=${thread}$`),
  );
  expect((await state(request)).candidateNotifications[0].read_at).toBeTruthy();
});

test("mark-all failure preserves unread state and shows a recoverable error", async ({
  page,
  request,
}) => {
  await fixture(request, {
    notification_count: 3,
    fail: { notifications_read: true },
  });
  await login(page, "candidate");
  await page.getByRole("button", { name: "Notifications, 3 unread" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Notifications",
    exact: true,
  });
  await dialog.getByRole("button", { name: "Mark all as read" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Read update failed");
  await expect(
    page.getByRole("button", { name: "Notifications, 3 unread" }),
  ).toBeVisible();
  expect(
    (await state(request)).candidateNotifications.filter(
      (note: { read_at?: string }) => !note.read_at,
    ),
  ).toHaveLength(3);
});

test("account menu supports keyboard/mobile, secure logout failure and successful revocation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page, "candidate");
  const account = page.getByRole("button", {
    name: "Candidate account",
    exact: true,
  });
  await account.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Your account" });
  await expect(
    dialog.getByText("candidate@example.com", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(account).toBeFocused();
  await expect(dialog).toHaveCount(0);
  const failure = async (route: Route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: "Session revocation unavailable" } },
    });
  await page.route("**/api/v1/auth/logout", failure);
  await account.click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Session revocation unavailable",
  );
  await expect(page).toHaveURL(/\/candidate$/);
  await page.unroute("**/api/v1/auth/logout", failure);
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/candidate/profile");
  await expect(page).toHaveURL(/\/login/);
});
