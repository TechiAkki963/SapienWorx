import { expect, test } from "@playwright/test";

const profile = {
  fullName: "Asha Raman", emailMasked: "a••••@example.com", mobileMasked: "+••••••123", headline: "Software Engineer", currentCompany: "Nexora Cloud",
  departmentRole: "Engineering / Platform", industry: "Software product", previousRole: "Associate Engineer", previousCompany: "Vertex Systems",
  location: "Bengaluru", preferredLocations: ["Bengaluru", "Remote"], overallExperienceYears: 4, expectedSalaryLakhs: 18, noticePeriodDays: 30,
  gender: "female", profileSummary: "Backend engineer building reliable hiring systems.", profileSearchable: true, emailVerified: true, mobileVerified: true, cvAvailable: true,
  domainCategory: "TECH", workLinks: ["https://github.com/asha"], profileLastUpdatedAt: "2026-08-27T10:00:00Z",
  skills: [{ skill: "TypeScript", rating: 4, yearsOfExperience: 3, experienceMonths: 6, softwareVersion: "5.x", lastUsedYear: 2026 }],
  education: [{ level: "BACHELORS", degreeName: "B.Tech Computer Science", institutionName: "Sapien Institute", graduationYear: 2022, courseStartYear: 2018, specialization: "Computer Science", studyType: "FULL_TIME", grade: "8.5 CGPA" }],
  profileDetails: { resumeHeadline: "Backend engineer", personalDetails: { hometown: "Mysuru" }, inclusionDetails: {}, employment: [], projects: [], accomplishments: [], languages: [] },
};

test("builds a recruiter-searchable profile and persists filter-aligned details", async ({ page, context }) => {
  await context.addCookies([{ name: "XSRF-TOKEN", value: "test-csrf", domain: "localhost", path: "/" }]);
  await page.addInitScript(() => window.localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
  let savedBody: Record<string, unknown> | undefined;
  await page.route("**/api/candidate/profile", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, json: profile });
    savedBody = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({ status: 200, json: { ...profile, ...savedBody } });
  });
  await page.goto("/candidate/profile");

  await expect(page.getByRole("heading", { name: "Your professional profile" })).toBeVisible();
  await expect(page.getByLabel("Department and role")).toHaveValue("Engineering / Platform");
  await expect(page.getByLabel("Industry")).toHaveValue("Software product");
  await expect(page.getByLabel("Course type")).toHaveValue("FULL_TIME");
  await expect(page.getByText("Private contact information")).toBeVisible();
  await expect(page.getByLabel("Hometown")).toHaveValue("Mysuru");

  await page.getByLabel("Department and role").fill("Engineering / Data platform");
  await page.getByLabel("Industry").fill("Enterprise software");
  await page.getByLabel("Course type").selectOption("PART_TIME");
  await page.getByLabel("Hometown").fill("Kochi");
  await page.getByRole("button", { name: "Save full profile" }).click();

  await expect(page.getByText("Profile saved — these are your confirmed details.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit profile" })).toBeVisible();
  await expect(page.getByText("Engineering / Data platform")).toBeVisible();
  await expect(page.getByLabel("Department and role")).toHaveCount(0);
  await expect.poll(() => savedBody?.departmentRole).toBe("Engineering / Data platform");
  await expect.poll(() => savedBody?.industry).toBe("Enterprise software");
  await expect.poll(() => (savedBody?.education as Array<{ studyType: string }>)?.[0]?.studyType).toBe("PART_TIME");
  await expect.poll(() => (savedBody?.profileDetails as { personalDetails: { hometown: string } })?.personalDetails.hometown).toBe("Kochi");
  expect(savedBody?.profileSearchable).toBe(true);

  await page.getByRole("button", { name: "Edit profile" }).click();
  await expect(page.getByLabel("Department and role")).toHaveValue("Engineering / Data platform");
  await expect(page.getByRole("button", { name: "Save full profile" })).toBeVisible();
});
