import { expect, test } from "@playwright/test";

const apiURL = (process.env.AUDIT_API_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");

function required(name: string): string {
  const value = process.env[name]?.trim();
  test.skip(!value, `${name} is required for this live audit`);
  return value ?? "";
}

test.describe("live functional and security audit", () => {
  test("candidate token is forbidden from recruiter APIs and a tampered token is unauthorised", async ({ request }) => {
    const candidateToken = required("AUDIT_CANDIDATE_TOKEN");

    const forbidden = await request.get(`${apiURL}/api/v1/recruiter/dashboard`, {
      headers: { Authorization: `Bearer ${candidateToken}` },
    });
    expect(forbidden.status()).toBe(403);

    const final = candidateToken.at(-1) === "a" ? "b" : "a";
    const forgedToken = `${candidateToken.slice(0, -1)}${final}`;
    const forged = await request.get(`${apiURL}/api/v1/recruiter/dashboard`, {
      headers: { Authorization: `Bearer ${forgedToken}` },
    });
    expect(forged.status()).toBe(401);
  });

  test("bulk InMail accepts fifty recipients and reports fourteen-day anti-spam skips", async ({ request }) => {
    const recruiterToken = required("AUDIT_RECRUITER_TOKEN");
    const rawIDs = required("AUDIT_50_CANDIDATE_IDS");
    const candidateIDs = rawIDs.split(",").map((value) => value.trim()).filter(Boolean);
    expect(candidateIDs).toHaveLength(50);

    const response = await request.post(`${apiURL}/api/v1/recruiter/inmail/bulk`, {
      headers: { Authorization: `Bearer ${recruiterToken}` },
      data: {
        candidate_ids: candidateIDs,
        subject: "SapienWorx enterprise audit",
        body: "Automated QA message for the controlled audit environment.",
      },
    });
    expect(response.status()).toBe(202);
    const result = await response.json() as { recipient_count?: number; skipped_count?: number; status?: string };
    expect(result.recipient_count).toBeGreaterThanOrEqual(0);
    expect(result.skipped_count).toBeGreaterThanOrEqual(0);
    expect((result.recipient_count ?? 0) + (result.skipped_count ?? 0)).toBe(50);
  });

  test("candidate receives STAGE_CHANGE without reloading after recruiter pipeline update", async ({ page, request, context }) => {
    const recruiterToken = required("AUDIT_RECRUITER_TOKEN");
    const candidateToken = required("AUDIT_CANDIDATE_TOKEN");
    const applicationID = required("AUDIT_APPLICATION_ID");
    const cookieName = process.env.AUDIT_ACCESS_COOKIE_NAME ?? "swx_access";
    const url = new URL(apiURL);

    await context.addCookies([{
      name: cookieName,
      value: candidateToken,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    }]);

    await page.goto(process.env.AUDIT_WEB_URL ?? "http://127.0.0.1:3000");
    const wsURL = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}/api/v1/events/ws`;
    const eventPromise = page.evaluate((socketURL) => new Promise<Record<string, unknown>>((resolve, reject) => {
      const socket = new WebSocket(socketURL);
      const timer = window.setTimeout(() => {
        socket.close();
        reject(new Error("STAGE_CHANGE event was not received within 10 seconds"));
      }, 10_000);
      socket.addEventListener("message", (event) => {
        const parsed = JSON.parse(String(event.data)) as Record<string, unknown>;
        if (parsed.type === "STAGE_CHANGE" || parsed.type === "stage_change") {
          window.clearTimeout(timer);
          socket.close();
          resolve(parsed);
        }
      });
      socket.addEventListener("error", () => reject(new Error("event WebSocket failed")));
    }), wsURL);

    const update = await request.patch(`${apiURL}/api/v1/recruiter/applications/${applicationID}/stage`, {
      headers: { Authorization: `Bearer ${recruiterToken}` },
      data: { stage: "technical_interview" },
    });
    expect(update.status()).toBe(204);

    const event = await eventPromise;
    expect(String(event.type).toLowerCase()).toBe("stage_change");
    expect(JSON.stringify(event)).toContain(applicationID);
  });
});
