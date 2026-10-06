import { expect, test } from "@playwright/test";
import {
  login,
  MOCK_API,
  recordedRequests,
  resetE2E,
  waitForRecordedRequest,
} from "./helpers";

const jobID = "60000000-0000-4000-8000-000000000001";
const javaID = "22222222-2222-4222-8222-222222222201";
const locationID = "b0000000-0000-4000-8000-000000000001";
const terms = [
  {
    id: javaID,
    entity_type: "skill",
    canonical_name: "Java",
    matched_value: "Java",
    match_kind: "canonical",
    confidence: 1,
  },
  {
    id: "22222222-2222-4222-8222-222222222202",
    entity_type: "skill",
    canonical_name: "JavaScript",
    matched_value: "JavaScript",
    match_kind: "canonical",
    confidence: 1,
  },
  {
    id: "22222222-2222-4222-8222-222222222203",
    entity_type: "competency",
    canonical_name: "Critical Care Nursing",
    matched_value: "ICU Nursing",
    match_kind: "alias",
    confidence: 1,
  },
];
test.beforeEach(async ({ request }) => resetE2E(request));

test("comma, Enter and paste create removable structured tags without duplicate canonical terms", async ({
  page,
  request,
}) => {
  await page.route(/\/api\/v1\/workforce\/taxonomy\/suggest/, async (route) => {
    const q = (
      new URL(route.request().url()).searchParams.get("q") ?? ""
    ).toLowerCase();
    await route.fulfill({
      json: {
        items: terms.filter((item) =>
          `${item.canonical_name} ${item.matched_value}`
            .toLowerCase()
            .includes(q),
        ),
      },
    });
  });
  await login(page, "candidate");
  await page.goto("/candidate/jobs");
  const keywords = page.getByRole("combobox", {
    name: "Role or keyword",
    exact: true,
  });
  await keywords.fill("Java");
  await keywords.press(",");
  await expect(
    page.getByRole("button", {
      name: "Remove Java from Role or keyword",
      exact: true,
    }),
  ).toBeVisible();
  await keywords.fill("JAVA");
  await keywords.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Remove Java from Role or keyword",
      exact: true,
    }),
  ).toHaveCount(1);
  await keywords.evaluate((element) => {
    const event = new ClipboardEvent("paste", {
      clipboardData: new DataTransfer(),
      bubbles: true,
      cancelable: true,
    });
    event.clipboardData!.setData(
      "text/plain",
      "Recruitment, ICU Nursing, Financial Modelling, CNC Programming",
    );
    element.dispatchEvent(event);
  });
  await expect(
    page.getByRole("button", {
      name: "Remove Critical Care Nursing from Role or keyword",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Remove Financial Modelling from Role or keyword",
    }),
  ).toBeVisible();
  await keywords.press("Backspace");
  await expect(
    page.getByRole("button", {
      name: "Remove CNC Programming from Role or keyword",
    }),
  ).toBeVisible();
  await keywords.press("Backspace");
  await expect(
    page.getByRole("button", {
      name: "Remove CNC Programming from Role or keyword",
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Remove Recruitment from Role or keyword" })
    .click();
  await expect(keywords).toBeFocused();
  await keywords.fill("Supply Chain"); // Final draft must be committed before navigation.
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.getAll("keyword_id"))
    .toContain(javaID);
  expect(new URL(page.url()).searchParams.getAll("keyword")).toEqual([
    "Financial Modelling",
    "Supply Chain",
  ]);
  expect(new URL(page.url()).searchParams.has("q")).toBe(false);
  const search = await waitForRecordedRequest(
    request,
    (item) =>
      item.path === "/api/v1/candidate/jobs" &&
      item.search.includes("keyword_id="),
  );
  const params = new URLSearchParams(search.search);
  expect(params.getAll("keyword_id")).toHaveLength(2);
  expect(params.getAll("keyword")).toEqual([
    "Financial Modelling",
    "Supply Chain",
  ]);
  expect(params.has("keyword_id_label")).toBe(false);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Remove Java from Role or keyword",
      exact: true,
    }),
  ).toBeVisible();
  await expect(keywords).toHaveValue("");
});

test("autocomplete keyboard semantics and Bangalore geography aliases resolve canonical IDs", async ({
  page,
}) => {
  await page.route(/\/api\/v1\/workforce\/taxonomy\/suggest/, async (route) =>
    route.fulfill({ json: { items: terms.slice(0, 2) } }),
  );
  await page.route(/\/api\/v1\/candidate\/job-locations/, async (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: locationID,
            canonical_name: "Bengaluru",
            aliases: ["Bangalore", "Bengaluru City"],
            state: "Karnataka",
            country_code: "IN",
          },
        ],
      },
    }),
  );
  await login(page, "candidate");
  await page.goto("/candidate/jobs");
  const keywords = page.getByRole("combobox", {
    name: "Role or keyword",
    exact: true,
  });
  await keywords.fill("jav");
  await expect(keywords).toHaveAttribute("aria-expanded", "true");
  await keywords.press("ArrowDown");
  await expect(
    page.getByRole("option", { name: "Java", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(keywords).toHaveAttribute("aria-activedescendant", /-0$/);
  await keywords.press("ArrowDown");
  await keywords.press("ArrowUp");
  await keywords.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Remove Java from Role or keyword",
      exact: true,
    }),
  ).toBeVisible();
  await keywords.fill("jav");
  await expect(keywords).toHaveAttribute("aria-expanded", "true");
  await keywords.press("Escape");
  await expect(keywords).toHaveAttribute("aria-expanded", "false");
  await keywords.fill("");
  const locations = page.getByRole("combobox", {
    name: "Location",
    exact: true,
  });
  await locations.fill("Bangalore");
  await locations.press(",");
  await expect(
    page.getByRole("button", {
      name: "Remove Bengaluru from Location",
      exact: true,
    }),
  ).toBeVisible();
  await locations.fill("Bengaluru City");
  await locations.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Remove Bengaluru from Location",
      exact: true,
    }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.getAll("location_id"))
    .toEqual([locationID]);
  expect(new URL(page.url()).searchParams.has("location_text")).toBe(false);
});

test("unavailable suggestions retain honest text search and oversized input cannot submit silently", async ({
  page,
}) => {
  await page.route(/\/api\/v1\/workforce\/taxonomy\/suggest/, async (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: "Suggestions unavailable" } },
    }),
  );
  await login(page, "candidate");
  await page.goto("/candidate/jobs");
  const requirements = page.getByRole("combobox", {
    name: "Competency or requirement",
    exact: true,
  });
  await requirements.fill("Machine Operation");
  await requirements.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Remove Machine Operation from Competency or requirement",
    }),
  ).toBeVisible();
  const keywords = page.getByRole("combobox", {
    name: "Role or keyword",
    exact: true,
  });
  await keywords.fill("x".repeat(181));
  await keywords.press("Enter");
  await expect(
    page.getByText("Use a search term between 1 and 180 characters."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).not.toHaveURL(/competency_text=/);
  await keywords.fill("Retail Sales");
  await keywords.press("Enter");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("competency_text"))
    .toBe("Machine Operation");
});

test("saving from results persists through reload, role details and saved-list removal", async ({
  page,
  request,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/jobs");
  await page
    .getByRole("button", { name: "Save job", exact: true })
    .first()
    .click();
  await expect(
    page
      .getByRole("button", { name: "Remove from saved jobs", exact: true })
      .first(),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page
      .getByRole("button", { name: "Remove from saved jobs", exact: true })
      .first(),
  ).toBeVisible();
  await page.goto(`/candidate/jobs/${jobID}`);
  await expect(
    page.getByRole("button", { name: "Remove from saved jobs", exact: true }),
  ).toBeVisible();
  await page.goto("/candidate/saved");
  await expect(
    page.getByRole("link", {
      name: "Senior Go Platform Engineer",
      exact: true,
    }),
  ).toHaveAttribute("href", `/candidate/jobs/${jobID}`);
  await page
    .getByRole("button", { name: "Remove from saved jobs", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Nothing saved yet." }),
  ).toBeVisible();
  const requests = await recordedRequests(request);
  expect(
    requests.some(
      (item) =>
        item.method === "PUT" &&
        item.path === `/api/v1/candidate/saved-jobs/${jobID}`,
    ),
  ).toBe(true);
  expect(
    requests.some(
      (item) =>
        item.method === "DELETE" &&
        item.path === `/api/v1/candidate/saved-jobs/${jobID}`,
    ),
  ).toBe(true);
});

test("a failed save rolls back its optimistic status and gives a non-destructive error", async ({
  page,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/jobs");
  await page.route(/\/api\/v1\/candidate\/saved-jobs\/[^/]+$/, async (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: { message: "Saving is temporarily unavailable. Try again." },
      },
    }),
  );
  const save = page
    .getByRole("button", { name: "Save job", exact: true })
    .first();
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Saving is temporarily unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "All active roles" }),
  ).toBeVisible();
});

test("rapid duplicate clicks send a single idempotent save and do not toggle back", async ({
  page,
  request,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/jobs");
  await page
    .getByRole("button", { name: "Save job", exact: true })
    .first()
    .dblclick();
  await expect(
    page
      .getByRole("button", { name: "Remove from saved jobs", exact: true })
      .first(),
  ).toBeEnabled();
  const writes = (await recordedRequests(request)).filter(
    (item) =>
      item.path === `/api/v1/candidate/saved-jobs/${jobID}` &&
      ["PUT", "DELETE"].includes(item.method),
  );
  expect(writes.map((item) => item.method)).toEqual(["PUT"]);
});

test("a successful save with failed reconciliation remains saved and explains the refresh failure", async ({
  page,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/jobs");
  await page.route(/\/api\/v1\/candidate\/saved-jobs$/, async (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: "List unavailable" } },
    }),
  );
  await page
    .getByRole("button", { name: "Save job", exact: true })
    .first()
    .click();
  await expect(
    page
      .getByRole("button", { name: "Remove from saved jobs", exact: true })
      .first(),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("alert").filter({ hasText: "Your change was saved" }),
  ).toBeVisible();
});

test("applications use canonical stages, safe history and confirmed withdrawal", async ({
  page,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/applications");
  await expect(
    page.getByRole("heading", { name: "Your applications" }),
  ).toBeVisible();
  const application = page
    .locator("section, article, div")
    .filter({
      has: page.getByRole("heading", {
        name: "Senior Go Platform Engineer",
        exact: true,
      }),
    })
    .filter({
      has: page.getByRole("button", { name: "Withdraw", exact: true }),
    })
    .last();
  await expect(
    page.getByText("Applied", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/Mumbai, Maharashtra/).first()).toBeVisible();
  await application
    .getByRole("button", { name: "Withdraw", exact: true })
    .click();
  await expect(
    page.getByText("Withdraw this application? This cannot be undone here."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep application" }).click();
  await application
    .getByRole("button", { name: "Withdraw", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm withdrawal" }).click();
  await expect(page.getByText("Withdrawn", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Withdrawn", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/internal recruiter|fraud intelligence|risk flags/i),
  ).toHaveCount(0);
});

test("applications retain last known data and expose an update error", async ({
  page,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/applications");
  await page.route(
    /\/api\/v1\/candidate\/applications(?:\?|$)/,
    async (route) =>
      route.fulfill({
        status: 503,
        json: { error: { message: "Updates unavailable" } },
      }),
  );
  await page.getByRole("button", { name: "Refresh applications" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Updates unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Senior Go Platform Engineer",
      exact: true,
    }),
  ).toBeVisible();
});

test("historic applications remain recognized on candidate/public role details and paginated history", async ({
  page,
  request,
}) => {
  const applications = Array.from({ length: 33 }, (_, index) => ({
    id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    job_id:
      index === 32
        ? jobID
        : `60000000-0000-4000-8000-${String(index + 2).padStart(12, "0")}`,
    job_title:
      index === 32
        ? "Senior Go Platform Engineer"
        : `Historic role ${index + 1}`,
    company_name: "Example Hiring",
    work_mode: "hybrid",
    city: "Mumbai",
    state: "Maharashtra",
    country_code: "IN",
    job_status: "active",
    stage: index === 32 ? "hired" : "screening",
    applied_at: "2026-01-01T09:00:00Z",
    updated_at: "2026-02-01T09:00:00Z",
  }));
  await request.post(`${MOCK_API}/__e2e/workspace`, { data: { applications } });
  await login(page, "candidate");
  for (const path of [`/candidate/jobs/${jobID}`, `/jobs/${jobID}`]) {
    await page.goto(path);
    await expect(
      page.getByRole("button", { name: "Applied ✓" }),
    ).toBeDisabled();
  }
  const requestEntry = await waitForRecordedRequest(
    request,
    (item) =>
      item.path === "/api/v1/candidate/applications" &&
      item.search.includes(`job_id=${jobID}`),
  );
  expect(new URLSearchParams(requestEntry.search).get("limit")).toBe("1");
  await page.goto("/candidate/applications");
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Senior Go Platform Engineer",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Senior Go Platform Engineer",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Hired", { exact: true })).toBeVisible();
});

test("server API failures remain visible and Retry genuinely reloads the same workspace", async ({
  page,
  request,
}) => {
  await login(page, "candidate");
  for (const [route, failKey, errorTitle, loadedTitle] of [
    ["saved", "saved_get", "We couldn’t load your saved jobs.", "Saved jobs"],
    [
      "applications",
      "applications_get",
      "We couldn’t load your applications.",
      "Your applications",
    ],
    [
      "interviews",
      "interviews_get",
      "We couldn’t load your interviews.",
      "Your interviews",
    ],
  ]) {
    await request.post(`${MOCK_API}/__e2e/workspace`, {
      data: { fail: { [failKey]: true } },
    });
    await page.goto(`/candidate/${route}`);
    await expect(
      page.getByRole("heading", { name: errorTitle, exact: true }),
    ).toBeVisible();
    await request.post(`${MOCK_API}/__e2e/workspace`, {
      data: { fail: { [failKey]: false } },
    });
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: loadedTitle, exact: true }),
    ).toBeVisible();
  }
});

test("empty saved jobs, applications and interviews contain useful real next actions", async ({
  page,
  request,
}) => {
  await request.post(`${MOCK_API}/__e2e/workspace`, {
    data: { saved_job_ids: [], applications: [], interviews: [] },
  });
  await login(page, "candidate");
  await page.goto("/candidate/saved");
  await expect(
    page.getByRole("heading", { name: "Nothing saved yet." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explore jobs", exact: true }),
  ).toHaveAttribute("href", "/candidate/jobs");
  await page.goto("/candidate/applications");
  await expect(
    page.getByRole("heading", { name: "Your tracker is ready." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Find a role", exact: true }),
  ).toHaveAttribute("href", "/candidate/jobs");
  await page.goto("/candidate/interviews");
  await expect(
    page.getByRole("heading", { name: "No interviews scheduled yet." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View applications", exact: true }),
  ).toHaveAttribute("href", "/candidate/applications");
});

test.describe("candidate job search touch interaction", () => {
  test.use({ viewport: { width: 360, height: 800 }, hasTouch: true });
  test("touch selection keeps canonical suggestions usable at 360px", async ({
    page,
  }) => {
    await login(page, "candidate");
    await page.goto("/candidate/jobs");
    const keywords = page.getByRole("combobox", {
      name: "Role or keyword",
      exact: true,
    });
    await keywords.fill("ICU");
    await page
      .getByRole("option", { name: "Critical Care Nursing", exact: true })
      .tap();
    await expect(
      page.getByRole("button", {
        name: "Remove Critical Care Nursing from Role or keyword",
        exact: true,
      }),
    ).toBeVisible();
    const location = page.getByRole("combobox", {
      name: "Location",
      exact: true,
    });
    await location.fill("Pun");
    await page.getByRole("option", { name: "Pune", exact: true }).tap();
    await expect(
      page.getByRole("button", {
        name: "Remove Pune from Location",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  });
});

test("interviews expose trustworthy times, safe meeting links and an offline calendar file", async ({
  page,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/interviews");
  await expect(
    page.getByText("Times shown in India Standard Time (Asia/Kolkata)."),
  ).toBeVisible();
  await expect(
    page.getByText("Upcoming", { exact: true }).first(),
  ).toBeVisible();
  const join = page.getByRole("link", { name: /Join interview/ }).first();
  await expect(join).toHaveAttribute("href", /^https?:\/\//);
  await expect(join).toHaveAttribute("rel", "noopener noreferrer");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add to calendar" }).first().click();
  expect((await download).suggestedFilename()).toBe("sapienworx-interview.ics");
  await page.getByText("Interview details", { exact: true }).first().click();
  await expect(page.getByText(/Scheduled instant:/).first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Discuss a schedule change" }).first(),
  ).toHaveAttribute("href", "/candidate/inbox");
});

test("unsafe interview URLs are unavailable and background failures preserve schedule", async ({
  page,
}) => {
  await page.route(/\/api\/v1\/candidate\/interviews$/, async (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "80000000-0000-4000-8000-000000000099",
            application_id: "70000000-0000-4000-8000-000000000001",
            job_id: jobID,
            job_title: "Synthetic interview",
            company_name: "Example Hiring",
            scheduled_at: "2027-01-10T09:00:00Z",
            duration_minutes: 45,
            meeting_url: "javascript:alert(1)",
            status: "scheduled",
          },
        ],
      },
    }),
  );
  await login(page, "candidate");
  await page.goto("/candidate/interviews");
  await page.getByRole("button", { name: "Refresh interviews" }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic interview" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Join interview/ })).toHaveCount(
    0,
  );
  await page.unroute(/\/api\/v1\/candidate\/interviews$/);
  await page.route(/\/api\/v1\/candidate\/interviews$/, async (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: "Schedule unavailable" } },
    }),
  );
  await page.getByRole("button", { name: "Refresh interviews" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Schedule unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Synthetic interview" }),
  ).toBeVisible();
});

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 428, height: 926 },
  { width: 360, height: 800 },
]) {
  for (const mode of ["light", "dark", "system"] as const)
    test(`jobs and trackers ${viewport.width}x${viewport.height} ${mode} remain within workspace`, async ({
      page,
    }) => {
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
      await login(page, "candidate");
      for (const route of ["jobs", "saved", "applications", "interviews"]) {
        await page.goto(`/candidate/${route}`);
        await expect(page.locator("main h1")).toBeVisible();
        if (route === "jobs") {
          const keywords = page.getByRole("combobox", {
            name: "Role or keyword",
            exact: true,
          });
          await keywords.fill("Patient Care");
          await keywords.press("Enter");
          await expect(
            page.getByRole("button", {
              name: "Remove Patient Care from Role or keyword",
            }),
          ).toBeVisible();
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
        ).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: `visual-artifacts/candidate-workspace/${viewport.width}x${viewport.height}/${route}-${mode}.png`,
          fullPage: true,
        });
      }
      expect(errors).toEqual([]);
    });
}
