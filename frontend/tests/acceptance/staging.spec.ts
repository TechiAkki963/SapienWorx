import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

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
  test("captures visual review of landing at phone, tablet and desktop sizes", async ({ page }) => {
    await mkdir("visual-review", { recursive: true });
    for (const width of [430, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto("/");
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: /Find work that feels right for you/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Practical advice for a brighter career." })).toBeVisible();
      const photographs = page.locator('img[src*="ChatGPT%20Image"]');
      await expect(photographs).toHaveCount(8);
      for (const photo of await photographs.all()) {
        await photo.scrollIntoViewIfNeeded();
        await expect.poll(() => photo.evaluate((image) => {
          const element = image as HTMLImageElement;
          return element.complete && element.naturalWidth >= 800 && element.naturalHeight >= 500;
        })).toBe(true);
      }
      // Full-page capture alone does not trip IntersectionObserver for offscreen Reveal components.
      // Scroll through the real page first and verify the dashboard and final CTA are painted.
      await page.getByRole("heading", { name: /Your career journey,/ }).scrollIntoViewIfNeeded();
      await expect(page.getByRole("heading", { name: /Your career journey,/ })).toBeVisible();
      await page.getByRole("heading", { name: "Your next chapter starts here." }).scrollIntoViewIfNeeded();
      await expect(page.getByRole("heading", { name: "Your next chapter starts here." })).toBeVisible();
      await page.evaluate(() => {
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(0, 0);
      });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      // Scrolling lazy images during validation also scrolls the mobile carousel.
      // Restore its initial visible card before capturing the reference screenshot.
      await page.locator(".swx-guide-grid").evaluate((element) => { element.scrollLeft = 0; });
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `visual-review/landing-${width}.jpg`, fullPage: true, type: "jpeg", quality: 82, animations: "disabled" });
    }
    await page.goto("/resources/build-a-resume");
    await expect(page.getByRole("heading", { name: "Build a résumé that sounds like you" })).toBeVisible();
    await page.screenshot({ path: "visual-review/knowledge-hub-guide.jpg", fullPage: true, type: "jpeg", quality: 82, animations: "disabled" });
  });

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
    await expect(candidatePage.getByRole("heading", { name: "Your search, with room to grow." })).toBeVisible();
    await expect(candidatePage.getByText("Ishita Rao", { exact: true })).toBeVisible();
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
    await expect(recruiterPage.getByRole("heading", { name: /Good (morning|afternoon|evening), Ananya\./ })).toBeVisible();
    await expect(recruiterPage.getByText("Hiring workspace.", { exact: false })).toBeVisible();
    await expect(recruiterPage.getByText("Northstar Product Labs").first()).toBeVisible();
    await recruiterContext.close();
  });

  test("delivers new threads and replies through deployed realtime messaging", async ({ browser }) => {
    const subject = `P2.2 realtime acceptance ${Date.now()}`;

    const candidateContext = await browser.newContext();
    const candidatePage = await candidateContext.newPage();
    await signIn(candidatePage, "candidate");
    await candidatePage.goto("/candidate/inbox");

    const recruiterContext = await browser.newContext();
    const recruiterPage = await recruiterContext.newPage();
    await signIn(recruiterPage, "recruiter");

    const csrfToken = (await recruiterContext.cookies()).find((cookie) => cookie.name === "sw_csrf")?.value;
    expect(csrfToken).toBeTruthy();

    const sendResult = await recruiterPage.evaluate(async ({ subject, csrfToken }) => {
      const response = await fetch("/api/v1/recruiter/inmail", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          candidate_id: "30000000-0000-4000-8000-000000000001",
          job_id: "40000000-0000-4000-8000-000000000001",
          subject,
          content: "P2.2 deployed recruiter message delivered while the candidate inbox is already open.",
        }),
      });
      return { status: response.status, body: await response.json() };
    }, { subject, csrfToken: csrfToken! });

    expect(sendResult.status).toBe(201);
    const threadID = String(sendResult.body.thread?.id ?? "");
    expect(threadID).toBeTruthy();

    // The candidate page was open before the InMail was sent. Seeing the
    // subject proves the user-scoped inbox socket refreshed the thread list.
    await expect(candidatePage.getByText(subject).first()).toBeVisible({ timeout: 5000 });
    await candidatePage.getByText(subject).first().click();
    await expect(candidatePage.getByRole("paragraph").filter({ hasText: "P2.2 deployed recruiter message delivered while the candidate inbox is already open." })).toBeVisible();
    await expect(candidatePage.getByText("Live", { exact: true })).toBeVisible();

    const notifications = await candidatePage.evaluate(async () => {
      const response = await fetch("/api/v1/candidate/notifications", { credentials: "include" });
      return { status: response.status, body: await response.json() };
    });
    expect(notifications.status).toBe(200);
    expect(notifications.body.items.some((item: { kind: string; action_url?: string }) =>
      item.kind === "inmail" && item.action_url === `/candidate/inbox?thread=${threadID}`)).toBeTruthy();

    await recruiterPage.goto(`/recruiter/messages?thread=${threadID}`);
    await expect(recruiterPage.getByText(subject).first()).toBeVisible();
    await recruiterPage.getByText(subject).first().click();
    await expect(recruiterPage.getByText("Live", { exact: true })).toBeVisible();

    const reply = "Candidate P2.2 realtime reply.";
    await candidatePage.getByPlaceholder("Write a reply…").fill(reply);
    await candidatePage.getByRole("button", { name: "Send" }).click();
    await expect(candidatePage.getByRole("paragraph").filter({ hasText: reply })).toBeVisible();

    // Recruiter conversation remains open; the thread socket must deliver the
    // candidate reply without navigation or polling delay.
    await expect(recruiterPage.getByRole("paragraph").filter({ hasText: reply })).toBeVisible({ timeout: 5000 });

    await recruiterContext.close();
    await candidateContext.close();
  });

  test("enforces Bulk InMail idempotency, cooldown and recipient budgets", async ({ browser }) => {
    const recruiterContext = await browser.newContext();
    const recruiterPage = await recruiterContext.newPage();
    await signIn(recruiterPage, "recruiter");

    const csrfToken = (await recruiterContext.cookies()).find((cookie) => cookie.name === "sw_csrf")?.value;
    expect(csrfToken).toBeTruthy();

    const subject = `P2.1 bulk acceptance ${Date.now()}`;
    const key = crypto.randomUUID();
    const candidateIDs = [
      "30000000-0000-4000-8000-000000000002",
      "30000000-0000-4000-8000-000000000003",
    ];

    async function bulk(payload: Record<string, unknown>, idempotencyKey: string) {
      return recruiterPage.evaluate(async ({ payload, idempotencyKey, csrfToken }) => {
        const response = await fetch("/api/v1/recruiter/inmail/bulk", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
            "X-Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(payload),
        });
        return {
          status: response.status,
          retryAfter: response.headers.get("Retry-After"),
          body: await response.json(),
        };
      }, { payload, idempotencyKey, csrfToken: csrfToken! });
    }

    const payload = {
      candidate_ids: candidateIDs,
      subject,
      body: "Hi {{CandidateName}}, this is the deployed P2.1 bulk acceptance message.",
    };

    const first = await bulk(payload, key);
    expect(first.status).toBe(200);
    expect(first.body.status).toBe("sent");
    expect(first.body.sent_count).toBe(2);
    expect(first.body.skipped_count).toBe(0);

    const retry = await bulk(payload, key);
    expect(retry.status).toBe(200);
    expect(retry.body).toEqual(first.body);

    const conflict = await bulk({ ...payload, subject: `${subject} changed` }, key);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error?.code).toBe("idempotency_conflict");

    const threads = await recruiterPage.evaluate(async () => {
      const response = await fetch("/api/v1/messaging/threads", { credentials: "include" });
      return { status: response.status, body: await response.json() };
    });
    expect(threads.status).toBe(200);
    expect(threads.body.items.filter((thread: { subject: string }) => thread.subject === subject)).toHaveLength(2);

    const cooldown = await bulk(payload, crypto.randomUUID());
    expect(cooldown.status).toBe(200);
    expect(cooldown.body.status).toBe("skipped");
    expect(cooldown.body.sent_count).toBe(0);
    expect(cooldown.body.skipped_count).toBe(2);

    const limited = await bulk({
      candidate_ids: ["30000000-0000-4000-8000-000000000004"],
      subject: `${subject} rate limit`,
      body: "Hi {{CandidateName}}, this request should hit the configured acceptance budget.",
    }, crypto.randomUUID());
    expect(limited.status).toBe(429);
    expect(limited.body.error?.code).toBe("rate_limited");
    expect(Number(limited.retryAfter)).toBeGreaterThan(0);

    await recruiterContext.close();
  });

});
