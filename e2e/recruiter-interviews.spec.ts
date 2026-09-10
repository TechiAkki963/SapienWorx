import { expect, test } from "@playwright/test";

type InterviewRequest = {
  applicationId: string;
  meetingLink: string;
  platformName: string;
  scheduledAt: string;
  durationMinutes: number;
};

test("schedules an interview with a recruiter-supplied external HTTPS meeting link", async ({ page }) => {
  const applicationId = "2fbd4be4-1bf2-4a1d-918d-500000000001";
  let posted: InterviewRequest | undefined;

  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf" } }));
  await page.route("**/api/recruiter/interviews", async (route) => {
    const request = route.request().postDataJSON() as InterviewRequest;
    posted = request;
    return route.fulfill({
      status: 201,
      json: {
        candidateName: "Asha Kumar",
        jobTitle: "Backend Engineer",
        platformName: request.platformName,
        meetingLink: request.meetingLink,
        scheduledAt: request.scheduledAt,
        durationMinutes: request.durationMinutes,
      },
    });
  });

  await page.goto(`/recruiter/interviews?application=${applicationId}`);

  await expect(page.getByRole("heading", { name: "Interviews" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schedule interview" })).toBeVisible();
  await expect(page.getByText("It does not create or control the external meeting.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Application ID")).toHaveValue(applicationId);

  await page.getByLabel("Interview date and time").fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 16));
  await page.getByLabel("External meeting URL").fill("http://meet.example.test/interview");
  await page.getByRole("button", { name: "Schedule Interview" }).click();
  await expect(page.getByText("Enter a valid HTTPS external meeting URL.")).toBeVisible();
  expect(posted).toBeUndefined();

  await page.getByLabel("External meeting URL").fill("https://meet.google.com/abc-defg-hij");
  await expect(page.getByText("Google Meet ↗", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Schedule Interview" }).click();

  await expect(page.getByText("Interview scheduled ✓", { exact: false })).toBeVisible();
  expect(posted).toBeDefined();
  const request = posted as InterviewRequest;
  expect(request.applicationId).toBe(applicationId);
  expect(request.meetingLink).toBe("https://meet.google.com/abc-defg-hij");
  expect(request.platformName).toBe("Google Meet");
});
