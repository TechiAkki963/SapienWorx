import { expect, test } from "@playwright/test";

const candidate = {
  email: "candidate.demo@sapienworx.local",
  password: "SapienDemo#2026",
};

const recruiter = {
  email: "recruiter.demo@sapienworx.local",
  password: "SapienDemo#2026",
};

async function signIn(page: import("@playwright/test").Page, role: "candidate" | "recruiter") {
  await page.goto(role === "candidate" ? "/login" : "/recruiter/login");
  await page.getByLabel(role === "recruiter" ? "Work email" : "Email").fill(role === "candidate" ? candidate.email : recruiter.email);
  await page.getByLabel("Password").fill(candidate.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(role === "candidate" ? /\/candidate(?:$|\?)/ : /\/recruiter(?:$|\?)/);
}

test.describe.serial("deployed staging acceptance", () => {
  test("serves public SSR and seeded job data through the gateway", async ({ page }) => {
    const home = await page.goto("/");
    expect(home?.status()).toBe(200);
    await expect(page.getByText("SapienWorx").first()).toBeVisible();

    const jobs = await page.goto("/jobs");
    expect(jobs?.status()).toBe(200);
    await expect(page.getByText("Senior Product Designer").first()).toBeVisible();
    await expect(page.getByText("Frontend Engineer").first()).toBeVisible();
  });

  test("authenticates candidate and recruiter through real cookies and SSR", async ({ browser }) => {
    const candidateContext = await browser.newContext();
    const candidatePage = await candidateContext.newPage();
    await signIn(candidatePage, "candidate");
    await expect(candidatePage.getByRole("heading", { name: /Good to see you, Ishita/ })).toBeVisible();
    await candidatePage.goto("/candidate/jobs");
    await expect(candidatePage.getByText("Senior Product Designer").first()).toBeVisible();
    const me = await candidatePage.evaluate(async () => {
      const response = await fetch("/api/v1/auth/me", { credentials: "include" });
      return { status: response.status, body: await response.json() };
    });
    expect(me.status).toBe(200);
    expect(me.body.role).toBe("candidate");
    await candidateContext.close();

    const recruiterContext = await browser.newContext();
    const recruiterPage = await recruiterContext.newPage();
    await signIn(recruiterPage, "recruiter");
    await expect(recruiterPage.getByRole("heading", { name: "Hiring workspace" })).toBeVisible();
    await expect(recruiterPage.getByText("Northstar Product Labs").first()).toBeVisible();
    await recruiterContext.close();
  });

  test("delivers recruiter InMail and establishes the deployed candidate WebSocket", async ({ browser }) => {
    const subject = `Step 6 staging acceptance ${Date.now()}`;
    const recruiterContext = await browser.newContext();
    const recruiterPage = await recruiterContext.newPage();
    await signIn(recruiterPage, "recruiter");

    const sendResult = await recruiterPage.evaluate(async ({ subject }) => {
      const response = await fetch("/api/v1/recruiter/inmail", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: "30000000-0000-4000-8000-000000000001",
          job_id: "40000000-0000-4000-8000-000000000001",
          subject,
          content: "Staging acceptance message from the deployed recruiter flow.",
        }),
      });
      return { status: response.status, body: await response.json() };
    }, { subject });

    expect(sendResult.status).toBe(201);
    expect(sendResult.body.thread?.id).toBeTruthy();
    await recruiterContext.close();

    const candidateContext = await browser.newContext();
    const candidatePage = await candidateContext.newPage();
    await signIn(candidatePage, "candidate");
    await candidatePage.goto("/candidate/inbox");
    await expect(candidatePage.getByText(subject).first()).toBeVisible();
    await expect(candidatePage.getByText("Staging acceptance message from the deployed recruiter flow.")).toBeVisible();
    await expect(candidatePage.getByText("Live", { exact: true })).toBeVisible();

    const reply = "Candidate staging acceptance reply.";
    await candidatePage.getByPlaceholder("Write a reply…").fill(reply);
    await candidatePage.getByRole("button", { name: "Send" }).click();
    await expect(candidatePage.getByText(reply)).toBeVisible();
    await candidateContext.close();
  });
});
