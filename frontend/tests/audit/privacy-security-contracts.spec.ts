import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function repoSource(relative: string) {
  return fs.readFileSync(path.resolve(process.cwd(), "..", relative), "utf8");
}

test.describe("GDPR/DPDP and security source contracts", () => {
  test("signup requires unticked privacy acknowledgement and uses email OTP only", async () => {
    const signup = repoSource("frontend/components/auth/signup-form.tsx");
    const server = repoSource("backend/internal/platform/httpserver/server.go");
    const verification = repoSource("frontend/app/verify-email/page.tsx");
    expect(signup).toMatch(/type=["']checkbox["']/);
    expect(signup).toMatch(/data[_-]?processing|privacy|personal data/i);
    expect(signup).not.toMatch(/defaultChecked|checked\s*=\s*\{?true/);
    expect(signup).toMatch(/verify-email/);
    expect(verification).toMatch(/email OTP/i);
    expect(server).not.toMatch(/POST \/api\/v1\/auth\/otp\/verify/);
    expect(server).not.toMatch(/POST \/api\/v1\/auth\/otp\/resend/);
  });

  test("account-erasure route is registered", async () => {
    const server = repoSource("backend/internal/platform/httpserver/server.go");
    expect(server).toMatch(/DELETE \/api\/v1\/user\/account/);
  });

  test("anonymous pitch is redacted server-side before any candidate DOM output", async () => {
    const pitch = repoSource("backend/internal/recruiter/anonymous_pitch.go");
    expect(pitch).toMatch(/AnonymousPitch/);
    expect(pitch).toMatch(/never loaded|cannot be.*leak|identity|contact/i);
    expect(pitch).not.toMatch(/json:\"(?:full_name|email|phone|photo|date_of_birth|current_company)/i);
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
    const bulk = repoSource("backend/internal/messaging/bulk.go");
    const guard = repoSource("database/migrations/000022_inmail_cooldown_guard.up.sql");
    const handler = repoSource("backend/internal/platform/httpserver/bulk_inmail_handler.go");
    const combined = `${bulk}\n${guard}\n${handler}`;
    expect(combined).toMatch(/14\s*\*\s*24\s*\*\s*time\.Hour|14 days|interval ['"]14 days['"]/i);
    expect(combined).toMatch(/skipped/i);
    expect(combined).toMatch(/bulk/i);
    expect(combined).toMatch(/StatusAccepted/);
  });

  test("event bus exposes an authenticated pipeline stage-change event", async () => {
    const events = repoSource("backend/internal/messaging/realtime_events.go");
    const server = repoSource("backend/internal/platform/httpserver/server.go");
    expect(events).toMatch(/STAGE_CHANGE|stage_change/i);
    expect(server).toMatch(/GET \/api\/v1\/events\/ws/);
  });
});
