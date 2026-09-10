import { expect, test } from "@playwright/test";

const pipelineResponse = {
  content: [
    {
      applicationId: "2fbd4be4-1bf2-4a1d-918d-500000000001",
      candidateId: "candidate-1",
      fullName: "Asha Kumar",
      headline: "Senior backend engineer",
      jobId: "SWX-100",
      jobTitle: "Backend Engineer",
      skills: ["Node.js", "TypeScript", "PostgreSQL"],
      maskedEmail: "a***@example.com",
      maskedMobile: "+91******1234",
      pipelineStage: "SCREENING",
      recentNotes: ["Strong backend systems experience."],
      profileLastUpdatedAt: "2026-09-08T10:00:00Z",
      lastActiveAt: "2026-09-09T10:00:00Z",
      applicationSource: "DIRECT",
      referralCode: null,
    },
  ],
  totalElements: 1,
  totalPages: 1,
  number: 0,
  size: 20,
  first: true,
  last: true,
  numberOfElements: 1,
  empty: false,
};

test("uses a responsive list-only candidate pipeline with 10 20 40 80 pagination", async ({ page }) => {
  await page.route("**/api/recruiter/pipeline**", async (route) => {
    if (route.request().method() === "PATCH") {
      return route.fulfill({ status: 200, json: { ...pipelineResponse.content[0], pipelineStage: "INTERVIEWING" } });
    }
    const url = new URL(route.request().url());
    const size = Number(url.searchParams.get("pageSize") || "20");
    return route.fulfill({ status: 200, json: { ...pipelineResponse, size } });
  });

  await page.goto("/recruiter/pipeline");

  await expect(page.getByRole("heading", { name: "Candidate Pipeline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Asha Kumar" })).toBeVisible();
  await expect(page.getByText("Backend Engineer", { exact: true })).toBeVisible();
  await expect(page.getByText("Node.js", { exact: true })).toBeVisible();
  await expect(page.getByText("Strong backend systems experience.", { exact: false })).toBeVisible();
  await expect(page.getByText("Kanban", { exact: true })).toHaveCount(0);

  const pageSize = page.getByLabel("Candidates per page");
  for (const size of ["10", "20", "40", "80"]) {
    await pageSize.selectOption(size);
    await expect(pageSize).toHaveValue(size);
  }

  await page.getByLabel("Move Asha Kumar to").selectOption("INTERVIEWING");
  await expect(page.getByText("Asha Kumar moved to Interviewing.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Schedule interview" })).toHaveAttribute("href", "/recruiter/interviews?application=2fbd4be4-1bf2-4a1d-918d-500000000001");
});
