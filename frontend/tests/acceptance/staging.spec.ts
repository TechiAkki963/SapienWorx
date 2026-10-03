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

const secondRecruiter = {
  email: "recruiter.second@sapienworx.local",
  password: "SapienDemo#2026",
};

async function signIn(page: import("@playwright/test").Page, role: "candidate" | "recruiter", emailOverride?: string) {
  await page.goto(role === "candidate" ? "/login" : "/recruiter/login");
  const account = role === "candidate" ? candidate : recruiter;
  await page.getByLabel(role === "recruiter" ? "Work email" : "Email").fill(emailOverride ?? account.email);
  await page.getByLabel("Password").fill(account.password);
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

    const notificationsPage = await candidateContext.newPage();
    await notificationsPage.goto("/candidate/notifications");
    await expect(notificationsPage.getByRole("heading", { name: "Notifications" })).toBeVisible();

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

    // The notifications page was also open before the send. It must refresh
    // from the authenticated user-scoped notification event without navigation.
    await expect(notificationsPage.getByText("New InMail from a recruiter").first()).toBeVisible({ timeout: 5000 });
    await expect(notificationsPage.getByText(subject).first()).toBeVisible({ timeout: 5000 });

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

  test("P2.5 blocks unauthorized and cross-company messaging access", async ({ browser, request }) => {
    const anonymous = await request.get("/api/v1/messaging/threads");
    expect(anonymous.status()).toBe(401);

    const candidateContext = await browser.newContext();
    const candidatePage = await candidateContext.newPage();
    await signIn(candidatePage, "candidate");
    const candidateCsrf = (await candidateContext.cookies()).find((cookie) => cookie.name === "sw_csrf")?.value;
    expect(candidateCsrf).toBeTruthy();

    const wrongRole = await candidatePage.evaluate(async (csrfToken) => {
      const response = await fetch("/api/v1/recruiter/inmail", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          candidate_id: "30000000-0000-4000-8000-000000000001",
          subject: "Forbidden candidate initiated recruiter message",
          content: "This must never be accepted.",
        }),
      });
      return { status: response.status, body: await response.json() };
    }, candidateCsrf!);
    expect(wrongRole.status).toBe(403);

    const primaryContext = await browser.newContext();
    const primaryPage = await primaryContext.newPage();
    await signIn(primaryPage, "recruiter");
    const primaryCsrf = (await primaryContext.cookies()).find((cookie) => cookie.name === "sw_csrf")?.value;
    expect(primaryCsrf).toBeTruthy();

    const created = await primaryPage.evaluate(async (csrfToken) => {
      const response = await fetch("/api/v1/recruiter/inmail", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          candidate_id: "30000000-0000-4000-8000-000000000001",
          job_id: "40000000-0000-4000-8000-000000000001",
          subject: "P2.5 tenant isolation thread",
          content: "Only the owning recruiter and candidate may access this thread.",
        }),
      });
      return { status: response.status, body: await response.json() };
    }, primaryCsrf!);
    expect(created.status).toBe(201);
    const threadID = String(created.body.thread?.id ?? "");
    expect(threadID).toBeTruthy();

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    await signIn(secondPage, "recruiter", secondRecruiter.email);
    const secondCsrf = (await secondContext.cookies()).find((cookie) => cookie.name === "sw_csrf")?.value;
    expect(secondCsrf).toBeTruthy();

    const foreignRead = await secondPage.evaluate(async (threadID) => {
      const response = await fetch(`/api/v1/messaging/threads/${threadID}/messages`, { credentials: "include" });
      return { status: response.status, body: await response.json() };
    }, threadID);
    expect(foreignRead.status).toBe(403);

    const foreignReply = await secondPage.evaluate(async ({ threadID, csrfToken }) => {
      const response = await fetch(`/api/v1/messaging/threads/${threadID}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ content: "Cross-company reply must be denied." }),
      });
      return { status: response.status, body: await response.json() };
    }, { threadID, csrfToken: secondCsrf! });
    expect(foreignReply.status).toBe(403);

    const foreignJob = await secondPage.evaluate(async (csrfToken) => {
      const response = await fetch("/api/v1/recruiter/inmail", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          candidate_id: "30000000-0000-4000-8000-000000000001",
          job_id: "40000000-0000-4000-8000-000000000001",
          subject: "Cross-company job context",
          content: "This must not cross tenant boundaries.",
        }),
      });
      return { status: response.status, body: await response.json() };
    }, secondCsrf!);
    expect([403, 404]).toContain(foreignJob.status);

    await secondContext.close();
    await primaryContext.close();
    await candidateContext.close();
  });

  test("creates and launches an outreach sequence through deployed anti-spam messaging", async ({ browser }) => {
    const recruiterContext = await browser.newContext();
    const recruiterPage = await recruiterContext.newPage();
    await signIn(recruiterPage, "recruiter");

    const csrfToken = (await recruiterContext.cookies()).find((cookie) => cookie.name === "sw_csrf")?.value;
    expect(csrfToken).toBeTruthy();

    async function request(path: string, method: string, payload?: Record<string, unknown>, headers?: Record<string, string>) {
      return recruiterPage.evaluate(async ({ path, method, payload, headers, csrfToken }) => {
        const response = await fetch(path, {
          method,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
            ...(headers ?? {}),
          },
          body: payload ? JSON.stringify(payload) : undefined,
        });
        return { status: response.status, body: await response.json() };
      }, { path, method, payload, headers, csrfToken: csrfToken! });
    }

    const suffix = Date.now();
    const intro = await request("/api/v1/recruiter/message-templates", "POST", {
      title: `P2.3 intro ${suffix}`,
      subject_template: "Operations leadership conversation",
      body_template: "Hi {{CandidateName}}, I would like to discuss an opportunity with you.",
    });
    expect(intro.status).toBe(201);

    const followup = await request("/api/v1/recruiter/message-templates", "POST", {
      title: `P2.3 follow-up ${suffix}`,
      subject_template: "Following up",
      body_template: "Hi {{CandidateName}}, following up on my earlier message.",
    });
    expect(followup.status).toBe(201);

    const sequence = await request("/api/v1/recruiter/outreach/sequences", "POST", {
      name: `P2.3 deployed sequence ${suffix}`,
      steps: [
        { template_id: intro.body.id, delay_hours: 0 },
        { template_id: followup.body.id, delay_hours: 24 },
      ],
    });
    expect(sequence.status).toBe(201);
    expect(sequence.body.status).toBe("active");

    const campaign = await request("/api/v1/recruiter/outreach/campaigns", "POST", {
      name: `P2.3 deployed campaign ${suffix}`,
      sequence_id: sequence.body.id,
      candidate_ids: ["30000000-0000-4000-8000-000000000004"],
    });
    expect(campaign.status).toBe(201);
    expect(campaign.body.status).toBe("draft");
    expect(campaign.body.total_recipients).toBe(1);

    const edited = await request(`/api/v1/recruiter/message-templates/${intro.body.id}`, "PATCH", {
      title: `P2.3 intro edited ${suffix}`,
      subject_template: "Edited after campaign review",
      body_template: "Hi {{CandidateName}}, edited reusable template content.",
    });
    expect(edited.status).toBe(200);

    const key = crypto.randomUUID();
    const launched = await request(
      `/api/v1/recruiter/outreach/campaigns/${campaign.body.id}/launch`,
      "POST",
      undefined,
      { "X-Idempotency-Key": key },
    );
    expect(launched.status).toBe(200);
    expect(launched.body.campaign.status).toBe("running");
    expect(launched.body.delivery.sent_count).toBe(1);
    expect(launched.body.delivery.deliveries).toHaveLength(1);
    expect(launched.body.delivery.deliveries[0].candidate_id).toBe("30000000-0000-4000-8000-000000000004");
    expect(launched.body.delivery.deliveries[0].thread_id).toBeTruthy();
    const threadID = launched.body.delivery.deliveries[0].thread_id;
    const snapshotMessages = await request(`/api/v1/messaging/threads/${threadID}/messages`, "GET");
    expect(snapshotMessages.status).toBe(200);
    expect(snapshotMessages.body.items[0].content).toContain("I would like to discuss an opportunity with you.");

    const retry = await request(
      `/api/v1/recruiter/outreach/campaigns/${campaign.body.id}/launch`,
      "POST",
      undefined,
      { "X-Idempotency-Key": key },
    );
    expect(retry.status).toBe(200);
    expect(retry.body.delivery).toEqual(launched.body.delivery);

    const conflictingRetry = await request(
      `/api/v1/recruiter/outreach/campaigns/${campaign.body.id}/launch`,
      "POST",
      undefined,
      { "X-Idempotency-Key": crypto.randomUUID() },
    );
    expect(conflictingRetry.status).toBe(409);
    expect(conflictingRetry.body.error?.code).toBe("idempotency_conflict");

    const paused = await request(
      `/api/v1/recruiter/outreach/campaigns/${campaign.body.id}`,
      "PATCH",
      { status: "paused" },
    );
    expect(paused.status).toBe(200);
    expect(paused.body.status).toBe("paused");

    const resumed = await request(
      `/api/v1/recruiter/outreach/campaigns/${campaign.body.id}`,
      "PATCH",
      { status: "running" },
    );
    expect(resumed.status).toBe(200);
    expect(resumed.body.status).toBe("running");

    const campaigns = await request("/api/v1/recruiter/outreach/campaigns", "GET");
    expect(campaigns.status).toBe(200);
    expect(campaigns.body.items.some((item: { id: string; sent_count: number }) =>
      item.id === campaign.body.id && item.sent_count === 1)).toBeTruthy();

    await recruiterContext.close();
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
    expect(first.body.sent_count).toBe(1);
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
    expect(threads.body.items.filter((thread: { subject: string }) => thread.subject === subject)).toHaveLength(1);

    const cooldown = await bulk(payload, crypto.randomUUID());
    expect(cooldown.status).toBe(200);
    expect(cooldown.body.status).toBe("skipped");
    expect(cooldown.body.sent_count).toBe(0);
    expect(cooldown.body.skipped_count).toBe(1);

    const limited = await bulk({
      candidate_ids: ["30000000-0000-4000-8000-000000000003"],
      subject: `${subject} rate limit`,
      body: "Hi {{CandidateName}}, this request should hit the configured acceptance budget.",
    }, crypto.randomUUID());
    expect(limited.status).toBe(429);
    expect(limited.body.error?.code).toBe("rate_limited");
    expect(Number(limited.retryAfter)).toBeGreaterThan(0);

    await recruiterContext.close();
  });

});
