import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function repoSource(relative: string) {
  return fs.readFileSync(path.resolve(process.cwd(), "..", relative), "utf8");
}

test.describe("GDPR/DPDP and security source contracts", () => {
  test("signup requires separate unticked processing and SMS consent controls", async () => {
    const signup = repoSource("frontend/components/auth/signup-form.tsx");
    expect(signup).toMatch(/type=["']checkbox["']/);
    expect(signup).toMatch(/data[_-]?processing|privacy|personal data/i);
    expect(signup).toMatch(/sms|text message/i);
    expect(signup).not.toMatch(/defaultChecked|checked\s*=\s*\{?true/);
  });

  test("account-erasure route is registered", async () => {
    const server = repoSource("backend/internal/platform/httpserver/server.go");
    expect(server).toMatch(/DELETE \/api\/v1\/user\/account/);
  });

  test("anonymous pitch mode redacts identifying fields before candidate DOM output", async () => {
    const profile = repoSource("frontend/components/recruiter/candidate-profile-view.tsx");
    const pipeline = repoSource("frontend/components/recruiter/pipeline-candidate-card.tsx");
    const combined = `${profile}\n${pipeline}`;
    expect(combined).toMatch(/anonymous.?pitch/i);
    expect(combined).toMatch(/redact|anonymous candidate|hidden identity/i);
  });

  test("role middleware rejects unauthorised roles with 403", async () => {
    const middleware = repoSource("backend/internal/platform/httpserver/middleware.go");
    expect(middleware).toContain("RequireRoles");
    expect(middleware).toContain("http.StatusForbidden");
  });

  test("CV object access uses expiring pre-signed S3 requests and server-side encryption", async () => {
    const presign = repoSource("backend/internal/storage/presign.go");
    expect(presign).toContain("PresignGet");
    expect(presign).toContain("PresignPut");
    expect(presign).toContain("X-Amz-Expires");
    expect(presign).toContain("X-Amz-Server-Side-Encryption");
    expect(presign).toContain("AES256");
  });

  test("database search paths use placeholders rather than interpolating user filters", async () => {
    const jobs = repoSource("backend/internal/candidate/job_search.go");
    expect(jobs).toMatch(/\$1|\$2/);
    expect(jobs).not.toMatch(/fmt\.Sprintf\([^\n]*(WHERE|ILIKE|SELECT)/i);
  });
});

test.describe("functional enterprise contracts", () => {
  test("bulk InMail backend enforces fourteen-day anti-spam and reports skipped recipients", async () => {
    const service = repoSource("backend/internal/messaging/service.go");
    const handlers = repoSource("backend/internal/platform/httpserver/messaging_handlers.go");
    const combined = `${service}\n${handlers}`;
    expect(combined).toMatch(/14\s*\*\s*24\s*\*\s*time\.Hour|14 days|interval ['"]14 days['"]/i);
    expect(combined).toMatch(/skipped/i);
    expect(combined).toMatch(/batch|bulk/i);
  });

  test("event bus exposes a pipeline stage-change event", async () => {
    const events = repoSource("backend/internal/messaging/events.go");
    expect(events).toMatch(/STAGE_CHANGE|stage_change/i);
  });
});
